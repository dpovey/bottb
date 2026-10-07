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

const file = process.argv[2]
if (!file) {
  console.error('usage: blob-upload.mjs <file> [blob-path]')
  process.exit(1)
}
const blobPath =
  process.argv[3] || `social/brisbane-2026/${path.basename(file)}`
const size = fs.statSync(file).size
console.log(`uploading ${file} (${(size / 1e9).toFixed(2)} GB) -> ${blobPath}`)
// Content type matters more than it looks. A cover image uploaded as
// application/octet-stream is served with `x-content-type-options: nosniff`,
// so Instagram cannot read it as an image and the Reels container dies with a
// bare "error code 2207053" naming nothing. Map the extension properly.
function contentTypeFor(f) {
  const ext = path.extname(f).toLowerCase()
  return (
    {
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
    }[ext] || 'application/octet-stream'
  )
}

const started = Date.now()
const opts = {
  access: 'public',
  token: env.BLOB_READ_WRITE_TOKEN,
  contentType: contentTypeFor(file),
  addRandomSuffix: false,
  allowOverwrite: true,
}
// `put(..., stream, { multipart: true })` buffers far ahead of the network: a 7.43 GB master reached
// a 6.1 GB footprint and mem-guard SIGTERMed it (3 Oct 2026). Big files therefore go up one fixed
// part at a time, so memory stays near PART bytes whatever the file size.
const PART = 64 * 1024 * 1024
let up
if (size <= 256 * 1024 * 1024) {
  up = await put(blobPath, fs.createReadStream(file), {
    ...opts,
    multipart: true,
  })
} else {
  const { createMultipartUploader } = await import('@vercel/blob')
  const mp = await createMultipartUploader(blobPath, opts)
  const fd = fs.openSync(file, 'r')
  const parts = []
  for (let n = 1, off = 0; off < size; n++, off += PART) {
    const buf = Buffer.alloc(Math.min(PART, size - off))
    fs.readSync(fd, buf, 0, buf.length, off)
    for (let attempt = 1; ; attempt++) {
      try {
        parts.push(await mp.uploadPart(n, buf))
        break
      } catch (e) {
        if (attempt >= 3) throw e
        console.log(`part ${n} failed (${e.message}), retry ${attempt}`)
      }
    }
    if (n % 10 === 0)
      console.log(
        `  ${((off + buf.length) / 1e9).toFixed(2)} / ${(size / 1e9).toFixed(2)} GB`
      )
  }
  fs.closeSync(fd)
  up = await mp.complete(parts)
}
console.log(`done in ${((Date.now() - started) / 1000).toFixed(0)}s`)
console.log('BLOB_URL', up.url)
