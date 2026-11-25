// Latest metrics per post plus whether its caption holds a link, to data/links_<date>.json. Run from the repo root.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
const dir = 'doc/production/reels-schedule'
const q = readFileSync(`${dir}/scripts/link_history.sql`, 'utf8').replace(/\s+/g, ' ')
const out = execFileSync('node', ['doc/production/scripts/sql.mjs', q, '--json'], { maxBuffer: 1 << 28 })
const date = new Date().toISOString().slice(0, 10)
writeFileSync(`${dir}/data/links_${date}.json`, out)
console.log(`wrote ${JSON.parse(out).length} rows`)
