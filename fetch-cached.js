#!/usr/bin/env node
"use module"
import fetch_ from "fetch-h2"
import fs from "fs"
import path from "path"
import URL_ from "url"
import buffer from "buffer"
import xdg from "xdg-basedir"
const
	cacheDir= xdg.cache,
	fetch= fetch_.fetch,
	{ mkdir, open, readFile, truncate}= fs.promises,
	URL= URL_.URL

export function urlize( opts= {}){
	if( typeof opts=== "string"){
		return new URL( opts)
	}
	if( opts.host&& opts.path){
		return opts
	}
	let url= opts.url
	if( !url){
		let argv= opts.argv
		if( !argv){
			let process_= opts.process
			if( !process_){
				process_= process
			}
			argv= process_.argv
		}
		url= argv[ 2]
	}

	if( typeof url=== "string"){
		return new URL( url)
	}
	if( url&& url.host&& url.path){
		return url
	}
	throw new Error( "URL not found")
}

export function cachePath( opts, url= urlize( opts)){
	const
		appName= opts.appName|| "fetch-cached",
		filename_= path.join( cacheDir, appName, url.host, url.pathname),
		filename= filename_.endsWith("/")? filename_.slice( 0, filename_.length- 1): filename_
	return filename
}


function instrumentFetch( f, ctx){
	const saved= { text: f.text, json: f.json, arrayBuffer: f.arrayBuffer}
	f.text= async function(){
		const text= await saved.text.call( f)
		ctx.fd.write( text, "utf8")
		ctx.close()
		return text
	}
	f.json= async function(){
		const text= await saved.text.call( f)
		ctx.fd.write( text, "utf8")
		ctx.close()
		return JSON.stringify( text)
	}
	f.arrayBuffer= async function(){
		const arrayBuffer= await saved.arrayBuffer.call( f)
		ctx.fd.write( arrayBuffer)
		ctx.close()
		return arrayBuffer
	}
	return f
}

export async function fetchCached( opts= {}){
	// try to read file
	const
		url= urlize( opts),
		filename= cachePath( opts, url)
	try{
		const
			file= await readFile( filename),
			shim= {
				status: 200,
				text(){
					const text= file.toString( "utf8")
					return text
				},
				json(){
					const text= file.toString( "utf8")
					return JSON.stringify( text)
				},
				arrayBuffer(){
					return file
				}
			}
		return shim
	}catch( ex){
		console.log("nope", ex)
	}

	// try to make basedir
	const
		basedir= path.dirname( filename),
		mode= opts.mode|| 0o700
	try{
		await mkdir( basedir, { recursive: true, mode})
	}catch( ex){}
	// assume basedir now exists whatever happened

	// open the cache file for writing
	let fileMode= opts.fileMode|| mode
	const execBits= fileMode & 0o111
	if( !opts.fileMode&& execBits){
		fileMode-= execBits
	}
	console.log("OPEN")
	const fd= await open( filename, "w", fileMode)
	// we now should have a file we can write to

	// fetch
	let ctx= {
		closing: null,
		close: async function( truncate){
			console.log("CLOSE")
			if( this.closing){
				return this.closing
			}
			let res_, rej_
			this.closing= new Promise(function(res, rej){
				res_= res
				rej_= rej
			})
			try{
				console.log("FD CLOSE", fd.fd)
				await this.fd.close()
				if( truncate){
					await truncate( this.filename)
				}
			}catch(ex){
				rej_( ex)
			}
			res_()
			return this.closing
		},
		fd,
		filename
	}
	try{
		const f= await fetch( url.href, opts)
		if( f.status>= 300){
			throw new Error( "unexpected response")
		}
		console.log("got-fetch")
		return instrumentFetch( f, ctx)
	}catch(ex){
		console.log("CATCH-CLOSE")
		ctx.close( true)
		throw ex
	}
}
export default fetchCached

export async function main( opts){
	try{
		const
			f= await fetchCached( opts),
			text= await f.text()
	}catch(ex){
		console.error( ex)
		process.exit( 1)
	}
}
main()
