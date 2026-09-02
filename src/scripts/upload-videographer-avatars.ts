/**
 * Script: Upload videographer avatars to Vercel Blob
 *
 * Two ways in:
 *
 *   pnpm tsx src/scripts/upload-videographer-avatars.ts
 *     Re-hosts the hardcoded Instagram CDN URLs below. Those URLs are signed
 *     and expire, so paste fresh ones before running.
 *
 *   pnpm tsx src/scripts/upload-videographer-avatars.ts <slug> <file> [...]
 *     Uploads local image files — the practical route when Instagram won't
 *     serve its CDN URLs to a script. Each file is normalised to a square
 *     300px JPEG before upload.
 */

import { put } from '@vercel/blob'
import { sql } from '@vercel/postgres'
import { config } from 'dotenv'
import { readFile } from 'fs/promises'
import sharp from 'sharp'

// Load environment variables
config({ path: '.env.local' })

interface VideographerAvatar {
  slug: string
  name: string
  instagramCdnUrl: string
}

// Instagram CDN URLs for videographer profile pictures (ephemeral)
const videographerAvatars: VideographerAvatar[] = [
  {
    slug: 'ramsay-waterhouse',
    name: 'Ramsay Waterhouse',
    instagramCdnUrl:
      'https://instagram.fbne11-1.fna.fbcdn.net/v/t51.2885-19/485521825_9339455722801304_1805710942369769813_n.jpg?efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmV4cGVyaW1lbnRhbCJ9&_nc_ht=instagram.fbne11-1.fna.fbcdn.net&_nc_cat=108&_nc_oc=Q6cZ2gEpN3swD4Anzu_9HT0Tme-A_kNSATSxyzRmTjx2UIAkloU_R9Z8mpHt6VAl7uq1KmA&_nc_ohc=gEQpexfqdQIQ7kNvwF0DHTX&_nc_gid=Clz-_13nnMkNrpyNmV2jmg&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQDbMWCa-sKZ6uHY2FPENSLwByLeM-H9piUon9CywUGksQ&oe=6A624009&_nc_sid=7a9f4b',
  },
]

async function downloadImage(url: string): Promise<Buffer> {
  console.log(`   📥 Downloading from Instagram CDN...`)

  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept:
        'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: 'https://www.instagram.com/',
    },
  })

  if (!response.ok) {
    throw new Error(
      `Failed to download image: ${response.status} ${response.statusText}`
    )
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

async function uploadToBlob(
  slug: string,
  imageBuffer: Buffer
): Promise<string> {
  console.log(`   📤 Uploading to Vercel Blob...`)

  const filename = `videographers/${slug}/avatar.jpg`

  const blob = await put(filename, imageBuffer, {
    access: 'public',
    addRandomSuffix: false, // Stable URL
    allowOverwrite: true,
    cacheControlMaxAge: 31536000, // 1 year
    contentType: 'image/jpeg',
  })

  // Stable path + a year of cache means a re-upload needs a cache-buster to
  // actually show up.
  return `${blob.url}?v=${Date.now()}`
}

/** Square, 300px, JPEG — the shape every avatar slot on the site expects. */
async function normaliseAvatar(filePath: string): Promise<Buffer> {
  const input = await readFile(filePath)
  return sharp(input)
    .resize(300, 300, { fit: 'cover' })
    .jpeg({ quality: 88 })
    .toBuffer()
}

async function uploadLocalFiles(pairs: [string, string][]): Promise<number> {
  let failures = 0

  for (const [slug, filePath] of pairs) {
    console.log(`🎥 Processing ${slug} from ${filePath}...`)
    try {
      const imageBuffer = await normaliseAvatar(filePath)
      console.log(
        `   ✓ Resized to ${(imageBuffer.length / 1024).toFixed(1)} KB`
      )

      const blobUrl = await uploadToBlob(slug, imageBuffer)
      console.log(`   ✓ Uploaded to: ${blobUrl}`)

      await updateDatabase(slug, blobUrl)
      console.log(`   ✅ Database updated\n`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`   ❌ Failed: ${message}\n`)
      failures += 1
    }
  }

  return failures
}

async function updateDatabase(slug: string, avatarUrl: string): Promise<void> {
  console.log(`   💾 Updating database...`)

  await sql`
    UPDATE videographers
    SET avatar_url = ${avatarUrl}
    WHERE slug = ${slug}
  `
}

async function main() {
  console.log('🚀 Starting videographer avatar upload...\n')

  // Local-file mode: <slug> <file> pairs on the command line.
  const args = process.argv.slice(2)
  if (args.length > 0) {
    if (args.length % 2 !== 0) {
      console.error('Usage: upload-videographer-avatars.ts <slug> <file> [...]')
      process.exit(1)
    }
    const pairs: [string, string][] = []
    for (let i = 0; i < args.length; i += 2) {
      pairs.push([args[i], args[i + 1]])
    }
    const failed = await uploadLocalFiles(pairs)
    console.log('✨ Done!')
    process.exit(failed > 0 ? 1 : 0)
  }

  let failures = 0

  for (const videographer of videographerAvatars) {
    console.log(`🎥 Processing ${videographer.name} (${videographer.slug})...`)

    try {
      const imageBuffer = await downloadImage(videographer.instagramCdnUrl)
      console.log(
        `   ✓ Downloaded ${(imageBuffer.length / 1024).toFixed(1)} KB`
      )

      const blobUrl = await uploadToBlob(videographer.slug, imageBuffer)
      console.log(`   ✓ Uploaded to: ${blobUrl}`)

      await updateDatabase(videographer.slug, blobUrl)
      console.log(`   ✓ Database updated`)
      console.log(`   ✅ Done!\n`)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      console.error(`   ❌ Failed: ${errorMessage}\n`)
      failures += 1
    }
  }

  console.log('✨ Done!')
  process.exit(failures > 0 ? 1 : 0)
}

main()
