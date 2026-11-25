// Scheduled and recent Facebook reels from the Graph API: id, scheduled time and the caption the platform holds. Run from the repo root.
import { readFileSync } from 'node:fs'
const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter((l) => /^[A-Z_0-9]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')] }))
const G = 'https://graph.facebook.com/v21.0', PAGE = env.META_PAGE_ID, TOK = env.META_PAGE_ACCESS_TOKEN
const j = await (await fetch(`${G}/${PAGE}/videos?fields=id,created_time,published,scheduled_publish_time,description,status,length,permalink_url&type=uploaded&limit=8&access_token=${TOK}`)).json()
if (j.error) throw new Error(j.error.message)
for (const v of j.data) if (!v.published || Date.parse(v.created_time) > Date.now() - 864e5) console.log(JSON.stringify({ id: v.id, created: v.created_time, published: v.published, slot: v.scheduled_publish_time ?? null, secs: v.length, status: v.status?.video_status, link: v.permalink_url, caption: v.description }, null, 1))
