#!/usr/bin/env node
/*
 * Run one SQL query against the prod database over Neon's HTTP endpoint (port 443) and print a table.
 * The runbook's "Database access" fallback, as a durable script (session scratchpads get wiped).
 *
 *   node doc/production/scripts/sql.mjs "select ... where x = $1" [param ...] [--json]
 *
 * Run from the repo root (reads .env.local). Cast reused params ($1::varchar) — Neon refuses one
 * $n deduced as two different types.
 */
import fs from 'fs'

const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]
    })
)
const args = process.argv.slice(2)
const JSON_OUT = args.includes('--json')
const [query, ...params] = args.filter((a) => a !== '--json')
if (!query) {
  console.error('usage: sql.mjs "<query>" [param ...] [--json]')
  process.exit(2)
}
const cs = env.POSTGRES_URL
const r = await fetch(`https://${new URL(cs).hostname}/sql`, {
  method: 'POST',
  headers: { 'Neon-Connection-String': cs, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query, params }),
})
const j = await r.json()
if (!j.rows) {
  console.error(JSON.stringify(j))
  process.exit(1)
}
if (JSON_OUT) console.log(JSON.stringify(j.rows, null, 2))
else console.table(j.rows)
