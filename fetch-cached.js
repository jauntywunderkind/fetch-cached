#!/usr/bin/env node
"use module"
import fetch_ from "fetch-h2"
import path from "path"
import URL_ from "url"
import xdg from "xdg-basedir"
const
	cacheDir= xdg.cache,
	fetch= fetch_.fetch,
	URL= URL_.URL

console.log({ URL})

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

export async function main( opts= {}){
	const
		url= urlize( opts),
		appName= opts.appName|| "fetch-cached",
		filename= path.join( cacheDir, appName, url.host, url.pathname),
		basedir= path.dirname( filename)

	console.log({ basedir, filename})

	const
		f= await fetch( url.href, opts),
		text= await f.text()
}
main()
