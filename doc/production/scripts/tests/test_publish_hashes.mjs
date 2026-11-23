// Offline tests for `publish-video.mjs <post.json> hashes` (release-close sha256 record). No network, no database.
// Run from anywhere: node doc/production/scripts/tests/test_publish_hashes.mjs
import assert from 'assert'
import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'

const SCRIPT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'publish-video.mjs'
)
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex')
let pass = 0
const dirs = []
process.on('exit', () =>
  dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true }))
)

function setup(files, results = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'pvhash-'))
  dirs.push(d)
  fs.writeFileSync(path.join(d, '.env.local'), '')
  const paths = {}
  for (const [k, body] of Object.entries(files)) {
    paths[k] = path.join(d, `${k}.bin`)
    fs.writeFileSync(paths[k], body)
  }
  const post = {
    group: 'g',
    event: 'e',
    band: 'b',
    title: 't',
    copy: 'c.md',
    files: paths,
    results,
  }
  fs.writeFileSync(path.join(d, 'post.json'), JSON.stringify(post))
  const run = (...extra) =>
    spawnSync('node', [SCRIPT, 'post.json', 'hashes', ...extra], {
      cwd: d,
      encoding: 'utf8',
    })
  const read = () =>
    JSON.parse(fs.readFileSync(path.join(d, 'post.json'), 'utf8'))
  return { d, paths, run, read }
}
const test = (name, fn) => {
  fn()
  pass++
  console.log(`ok   ${name}`)
}

test('records vocal, mix master and uploads together', () => {
  const t = setup(
    { vocal: 'V', mix_master: 'M', ig: 'I', master: 'K' },
    { blob: { ig: { bytes: 1 } } }
  )
  const r = t.run()
  assert.equal(r.status, 0, r.stderr)
  const h = t.read().results.hashes
  assert.deepEqual(Object.keys(h.files), [
    'vocal',
    'mix_master',
    'ig',
    'master',
  ])
  assert.equal(h.files.vocal.sha256, sha('V'))
  assert.equal(h.files.master.bytes, 1)
  assert.ok(h.at)
})

test('a second run verifies and leaves the record alone', () => {
  const t = setup({ vocal: 'V', mix_master: 'M', ig: 'I' })
  t.run()
  const first = t.read().results.hashes
  const r = t.run()
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /matches the record/)
  assert.deepEqual(t.read().results.hashes, first)
})

test('a changed file fails and is not overwritten', () => {
  const t = setup({ vocal: 'V', mix_master: 'M', ig: 'I' })
  t.run()
  fs.writeFileSync(t.paths.mix_master, 'M2')
  const r = t.run()
  assert.equal(r.status, 1)
  assert.match(r.stderr, /changed since .*: mix_master/)
  assert.equal(t.read().results.hashes.files.mix_master.sha256, sha('M'))
})

test('needs the vocal and the mix master', () => {
  const r = setup({ mix_master: 'M', ig: 'I' }).run()
  assert.equal(r.status, 1)
  assert.match(r.stderr, /needs vocal/)
})

test('needs at least one upload file', () => {
  const r = setup({ vocal: 'V', mix_master: 'M' }).run()
  assert.equal(r.status, 1)
  assert.match(r.stderr, /no upload file/)
})

test('fails when the local file differs in size from the upload', () => {
  const r = setup(
    { vocal: 'V', mix_master: 'M', ig: 'II' },
    { blob: { ig: { bytes: 5 } } }
  ).run()
  assert.equal(r.status, 1)
  assert.match(r.stderr, /ig: 2 bytes here, 5 uploaded/)
})

test('--dry writes nothing', () => {
  const t = setup({ vocal: 'V', mix_master: 'M', ig: 'I' })
  const r = t.run('--dry')
  assert.equal(r.status, 0, r.stderr)
  assert.equal(t.read().results.hashes, undefined)
})

console.log(`${pass} passed`)
