import fs from 'fs'
import { put } from '@vercel/blob'
const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [
        l.slice(0, i).trim(),
        l
          .slice(i + 1)
          .trim()
          .replace(/^"|"$/g, ''),
      ]
    })
)
const TOK = env.META_PAGE_ACCESS_TOKEN,
  PAGE = env.META_PAGE_ID,
  IG = '17841461862790198',
  G = 'https://graph.facebook.com/v21.0'
const [, , postKey, localFile, whenIso, collabs] = process.argv
const S = process.env.S
const posts = JSON.parse(fs.readFileSync(S + '/posts.json', 'utf8'))
const p = posts[postKey]
const name = localFile.split('/').pop()
const up = await put(
  `social/brisbane-2026/${name}`,
  fs.readFileSync(localFile),
  {
    access: 'public',
    token: env.BLOB_READ_WRITE_TOKEN,
    contentType: 'video/mp4',
    addRandomSuffix: false,
    allowOverwrite: true,
  }
)
const videoUrl = up.url
console.log('blob', videoUrl)
const ts = Math.floor(new Date(whenIso).getTime() / 1000)
const j = async (u, o) => {
  const r = await fetch(u, o)
  const d = await r.json()
  if (!r.ok) throw new Error(JSON.stringify(d))
  return d
}
const q = (o) => new URLSearchParams(o).toString()
const fbCaption = p.ig_fb
  .replace(/@thetriffid/g, 'The Triffid')
  .replace(/@youngcareoz/g, 'Youngcare')
  .replace(/@rex_software/g, 'Rex Software')
  .replace(/@urbanx\.io/g, 'URBAN X')
  .replace(/@suncorp/g, 'Suncorp')
const st = await j(`${G}/${PAGE}/video_reels`, {
  method: 'POST',
  body: q({ upload_phase: 'start', access_token: TOK }),
})
await (
  await fetch(
    `https://rupload.facebook.com/video-upload/v21.0/${st.video_id}`,
    {
      method: 'POST',
      headers: { Authorization: `OAuth ${TOK}`, file_url: videoUrl },
    }
  )
).json()
for (let i = 0; i < 40; i++) {
  const s = await j(`${G}/${st.video_id}?fields=status&access_token=${TOK}`)
  if (s.status?.uploading_phase?.status === 'complete') break
  await new Promise((r) => setTimeout(r, 5000))
}
const fin = await j(`${G}/${PAGE}/video_reels`, {
  method: 'POST',
  body: q({
    upload_phase: 'finish',
    video_id: st.video_id,
    video_state: 'SCHEDULED',
    scheduled_publish_time: String(ts),
    description: fbCaption,
    access_token: TOK,
  }),
})
console.log('FB', fin.success, `https://www.facebook.com/reel/${st.video_id}`)
const params = {
  media_type: 'REELS',
  video_url: videoUrl,
  caption: p.ig_fb,
  share_to_feed: 'true',
  access_token: TOK,
}
if (collabs) params.collaborators = JSON.stringify(collabs.split(','))
const cr = await j(`${G}/${IG}/media`, { method: 'POST', body: q(params) })
let status = 'IN_PROGRESS'
for (let i = 0; i < 40 && status === 'IN_PROGRESS'; i++) {
  await new Promise((r) => setTimeout(r, 10000))
  status = (await j(`${G}/${cr.id}?fields=status_code&access_token=${TOK}`))
    .status_code
}
console.log('IG container', cr.id, status)
fs.appendFileSync(
  S + '/schedule-log.json',
  JSON.stringify({
    postKey,
    videoUrl,
    when: whenIso,
    fb_video_id: st.video_id,
    fb_url: `https://www.facebook.com/reel/${st.video_id}`,
    ig_container: cr.id,
    ig_status: status,
    collabs,
  }) + '\n'
)
