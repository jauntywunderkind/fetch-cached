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

export async function fetchCached( opts= {}){
	// try to read file
	const
		url= urlize( opts),
		filename= cachePath( opts, url)
	try{
		const file= await readFile( filename)
		return file
	}catch( ex){}

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
	const fd= await open( filename, "w", fileMode)
	// we now should have a file we can write to

	// fetch
	let closing= false
	try{
		const f= await fetch( url.href, opts)
		if( f.status>= 300){
			throw new Error( "unexpected response")
		}
		const buf= await f.arrayBuffer()
		return buf
	}catch(ex){
		console.log("CATCH")
		closing= true
		await fd.close()
		await truncate( filename)
		throw ex
	}finally{
		if( !closing){
			await fd.close()
		}
	}
}
export default fetchCached

export async function main( opts){
	try{
		const
			buf= await fetchCached( opts),
			text= Buffer.from( buf).toString( "utf8")
		console.log( text)
	}catch(ex){
		console.error( ex)
		process.exit( 1)
	}
}
main()
