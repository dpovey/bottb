#!/usr/bin/env node
/**
 * Publish an already-built Instagram container.
 *   cd <repo> && node doc/production/scripts/ig-publish.mjs <container_id>
 *
 * Containers stay valid ~24h. Built ahead of time so that if the scheduled
 * publish is missed (session died, machine rebooted), this one command still
 * ships it without rebuilding or re-uploading anything.
 */
import fs from 'fs'
const env = Object.fromEntries(
  fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#'))
    .map(l=>{const i=l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^"|"$/g,'')]}))
const TOK=env.META_PAGE_ACCESS_TOKEN, IG='17841461862790198', G='https://graph.facebook.com/v21.0'
const id=process.argv[2]
if(!id){ console.error('usage: ig-publish.mjs <container_id>'); process.exit(1) }
const q=o=>new URLSearchParams(o).toString()
const j=async(u,o)=>{const r=await fetch(u,o); const d=await r.json(); if(!r.ok) throw new Error(JSON.stringify(d)); return d}
const st=await j(`${G}/${id}?fields=status_code&access_token=${TOK}`)
if(st.status_code!=='FINISHED') throw new Error('container not ready: '+st.status_code)
const pub=await j(`${G}/${IG}/media_publish`,{method:'POST',body:q({creation_id:id,access_token:TOK})})
const info=await j(`${G}/${pub.id}?fields=permalink,timestamp,media_type&access_token=${TOK}`)
console.log('IG_POST_ID', pub.id)
console.log('permalink', info.permalink)
console.log('posted', info.timestamp, info.media_type)
