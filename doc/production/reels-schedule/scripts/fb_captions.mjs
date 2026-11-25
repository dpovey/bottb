// Real Facebook captions from the Graph API (the ledger's are often blank), to data/fb_captions_<date>.json. Run from the repo root.
import { readFileSync, writeFileSync } from 'node:fs'
const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter((l) => /^[A-Z_0-9]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')] }))
const G = 'https://graph.facebook.com/v21.0', PAGE = env.META_PAGE_ID, TOK = env.META_PAGE_ACCESS_TOKEN
let url = `${G}/${PAGE}/published_posts?fields=id,created_time,message,permalink_url,attachments%7Btype%7D&limit=50&since=2026-08-25&access_token=${TOK}`
const out = []
while (url) {
  const j = await (await fetch(url)).json()
  if (j.error) throw new Error(j.error.message)
  for (const p of j.data) out.push({ id: p.id, t: p.created_time, type: p.attachments?.data?.[0]?.type ?? null, link: /(https?:\/\/|youtu\.be|www\.)/i.test(p.message ?? ''), len: (p.message ?? '').length, url: p.permalink_url, head: (p.message ?? '').slice(0, 50) })
  url = j.paging?.next
}
writeFileSync(`${'doc/production/reels-schedule'}/data/fb_captions_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(out, null, 1))
console.log(out.length, 'posts')
