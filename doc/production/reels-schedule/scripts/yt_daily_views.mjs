// Append today's YouTube view counts for every upload to data/yt_daily_views.csv. Run from the repo root; the launch agent runs it daily.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter((l) => /^[A-Z_0-9]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')] }))
const K = env.YOUTUBE_API_KEY, API = 'https://www.googleapis.com/youtube/v3', CSV = 'doc/production/reels-schedule/data/yt_daily_views.csv'
async function get(path) {
  const r = await fetch(`${API}/${path}&key=${K}`, { signal: AbortSignal.timeout(30000) })
  const j = await r.json()
  if (j.error) throw new Error(`YouTube API: ${j.error.message}`)
  return j
}
const ch = await get('channels?part=contentDetails&id=UCJVbMoGFRdQxVgHvW1heYCg')
const uploads = ch.items[0].contentDetails.relatedPlaylists.uploads
const ids = []
let page = ''
do {
  const j = await get(`playlistItems?part=contentDetails&playlistId=${uploads}&maxResults=50${page && `&pageToken=${page}`}`)
  ids.push(...j.items.map((i) => i.contentDetails.videoId))
  page = j.nextPageToken ?? ''
} while (page)
const now = new Date().toISOString()
const rows = []
for (let i = 0; i < ids.length; i += 50) {
  const j = await get(`videos?part=statistics&id=${ids.slice(i, i + 50).join(',')}`)
  for (const v of j.items) rows.push([now, v.id, v.statistics.viewCount ?? '', v.statistics.likeCount ?? '', v.statistics.commentCount ?? ''].join(','))
}
if (!rows.length) throw new Error('no videos returned')
if (!existsSync(CSV)) writeFileSync(CSV, 'captured_at,video_id,views,likes,comments\n')
appendFileSync(CSV, rows.join('\n') + '\n')
console.log(`${now} wrote ${rows.length} videos`)
