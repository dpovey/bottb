import pg from 'pg'
import fs from 'fs'
const url = fs
  .readFileSync('.env.local', 'utf8')
  .split('\n')
  .find((l) => l.startsWith('DATABASE_URL='))
  .split('=')
  .slice(1)
  .join('=')
  .replace(/^["']|["']$/g, '')
const c = new pg.Client({ connectionString: url })
await c.connect()
const r = await c.query(process.argv[2])
console.log(JSON.stringify(r.rows, null, 1))
await c.end()
