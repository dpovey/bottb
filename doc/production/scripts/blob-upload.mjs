#!/usr/bin/env node
/**
 * Upload a local file to Vercel Blob and print its public URL.
 * MUST be run with the repo root as cwd — it resolves @vercel/blob and .env.local
 * from there. (Running a copy of this from the scratchpad fails with
 * ERR_MODULE_NOT_FOUND, which silently cost an upload on 7 Sep.)
 *
 *   cd <repo> && node doc/production/scripts/blob-upload.mjs <file> [blob-path]
 */
import fs from 'fs'
import path from 'path'
import { put } from '@vercel/blob'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] })
)

const file = process.argv[2]
if (!file) { console.error('usage: blob-upload.mjs <file> [blob-path]'); process.exit(1) }
const blobPath = process.argv[3] || `social/brisbane-2026/${path.basename(file)}`
const size = fs.statSync(file).size
console.log(`uploading ${file} (${(size / 1e9).toFixed(2)} GB) -> ${blobPath}`)
const started = Date.now()
const up = await put(blobPath, fs.createReadStream(file), {
  access: 'public',
  token: env.BLOB_READ_WRITE_TOKEN,
  contentType: file.endsWith('.mp4') ? 'video/mp4' : 'application/octet-stream',
  addRandomSuffix: false,
  allowOverwrite: true,
  multipart: true,
})
console.log(`done in ${((Date.now() - started) / 1000).toFixed(0)}s`)
console.log('BLOB_URL', up.url)
