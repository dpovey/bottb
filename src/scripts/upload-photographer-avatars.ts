/**
 * Script: Upload photographer avatars from Instagram CDN to Vercel Blob
 *
 * Downloads profile pictures from Instagram CDN URLs and uploads them
 * to permanent blob storage, then updates the database.
 *
 * Usage: npx tsx src/scripts/upload-photographer-avatars.ts
 */

import { put } from '@vercel/blob'
import { sql } from '@vercel/postgres'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

interface PhotographerAvatar {
  slug: string
  name: string
  instagramCdnUrl: string
}

// Instagram CDN URLs for photographer profile pictures
// These are ephemeral and will expire - we're downloading and storing permanently
const photographerAvatars: PhotographerAvatar[] = [
  {
    slug: 'renee-andrews',
    name: 'Renee Andrews',
    instagramCdnUrl:
      'https://instagram.fbne11-1.fna.fbcdn.net/v/t51.2885-19/462772628_880256147153937_6515857655560063620_n.jpg?efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44MzguYzIifQ&_nc_ht=instagram.fbne11-1.fna.fbcdn.net&_nc_cat=109&_nc_oc=Q6cZ2QHkYt7OIIMZA-LVKNzqscOEYaqpRxRqskzjVveHiBk_HKwObKFjoTSGaFXZuHk740s&_nc_ohc=bvTAy-O2b-kQ7kNvwFjPWcJ&_nc_gid=Wl8rgT_e946uIdjTLVzZrg&edm=APoiHPcBAAAA&ccb=7-5&oh=00_AflBc6MK_p4NwPAdTv8tD5y7G_U89yuQEgYeqae0-6R1uA&oe=694D4789&_nc_sid=22de04',
  },
  {
    slug: 'jacob-briant',
    name: 'Jacob Briant',
    instagramCdnUrl:
      'https://instagram.fbne11-1.fna.fbcdn.net/v/t51.2885-19/347615006_131166533302476_7933377450810012617_n.jpg?efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4zMjAuYzIifQ&_nc_ht=instagram.fbne11-1.fna.fbcdn.net&_nc_cat=100&_nc_oc=Q6cZ2QEL784PiTw5HCoJ6z7kuzYX2ThKb-Y6yMWUxz3vWRafSj-sJQlU34Sko0MRoEIwrRw&_nc_ohc=iMKfhZ_4ytwQ7kNvwHAdqjp&_nc_gid=SYE2HwcCTBHJVjh75KyT1w&edm=APoiHPcBAAAA&ccb=7-5&oh=00_AfnvMat_ASFTFT8kmoaOs0CAfDMnVXkbZeKX-8m_-v1dLw&oe=694D28FD&_nc_sid=22de04',
  },
  {
    slug: 'eddy-hill',
    name: 'Eddy Hill',
    instagramCdnUrl:
      'https://instagram.fbne11-1.fna.fbcdn.net/v/t51.2885-19/463956695_539866495668744_4769136299325612410_n.jpg?efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDUzLmMyIn0&_nc_ht=instagram.fbne11-1.fna.fbcdn.net&_nc_cat=100&_nc_oc=Q6cZ2QEChTAyx1RazVli9yQtW9u75IWXfEv7o_TsL50NUnkwOaqhyAXDk9-tFwMf7THBpz0&_nc_ohc=IAwj_UxAJOQQ7kNvwE3xP_1&_nc_gid=OlfWXhJOoUCOMbhq8CMmXA&edm=AONqaaQBAAAA&ccb=7-5&oh=00_AfmMaUlbmHDQpLQRfApv-LLohGqwgnGOejlSxiuwlztfDA&oe=694D5602&_nc_sid=4e3341',
  },
  {
    slug: 'rod-hunt',
    name: 'Rod Hunt',
    instagramCdnUrl:
      'https://instagram.fbne11-1.fna.fbcdn.net/v/t51.2885-19/16585057_631752610361658_472073908636352512_a.jpg?efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4zMjAuYzIifQ&_nc_ht=instagram.fbne11-1.fna.fbcdn.net&_nc_cat=106&_nc_oc=Q6cZ2QGTajau3Hq7nV2oA7HqZubNJMOCCzF2Rq-1EvGqm7UJNNOoi53ojD37QVXlYJBycTo&_nc_ohc=ssaF6LF5-UUQ7kNvwHeQIHs&_nc_gid=64ikh01WcSyFHDM-ArjxsA&edm=APoiHPcBAAAA&ccb=7-5&oh=00_AfmYZ3sI1acJ2XNpIRJlRBU7y7j7DH98ggMfAsPm538XQQ&oe=694D2AF9&_nc_sid=22de04',
  },
]

async function downloadImage(url: string): Promise<Buffer> {
  console.log(`   📥 Downloading from Instagram CDN...`)

  const response = await fetch(url, {
    headers: {
      // Mimic a browser request to avoid being blocked
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

  const filename = `photographers/${slug}/avatar.jpg`

  const blob = await put(filename, imageBuffer, {
    access: 'public',
    addRandomSuffix: false, // We want a stable URL
    cacheControlMaxAge: 31536000, // 1 year
    contentType: 'image/jpeg',
  })

  return blob.url
}

async function updateDatabase(slug: string, avatarUrl: string): Promise<void> {
  console.log(`   💾 Updating database...`)

  await sql`
    UPDATE photographers 
    SET avatar_url = ${avatarUrl}
    WHERE slug = ${slug}
  `
}

async function main() {
  console.log('🚀 Starting photographer avatar upload...\n')

  const results: {
    name: string
    success: boolean
    url?: string
    error?: string
  }[] = []

  for (const photographer of photographerAvatars) {
    console.log(`📸 Processing ${photographer.name} (${photographer.slug})...`)

    try {
      // 1. Download from Instagram CDN
      const imageBuffer = await downloadImage(photographer.instagramCdnUrl)
      console.log(
        `   ✓ Downloaded ${(imageBuffer.length / 1024).toFixed(1)} KB`
      )

      // 2. Upload to Vercel Blob
      const blobUrl = await uploadToBlob(photographer.slug, imageBuffer)
      console.log(`   ✓ Uploaded to: ${blobUrl}`)

      // 3. Update database
      await updateDatabase(photographer.slug, blobUrl)
      console.log(`   ✓ Database updated`)

      results.push({ name: photographer.name, success: true, url: blobUrl })
      console.log(`   ✅ Done!\n`)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      console.error(`   ❌ Failed: ${errorMessage}\n`)
      results.push({
        name: photographer.name,
        success: false,
        error: errorMessage,
      })
    }
  }

  // Summary
  console.log('═'.repeat(60))
  console.log('📊 Summary:')
  console.log('═'.repeat(60))

  const successful = results.filter((r) => r.success)
  const failed = results.filter((r) => !r.success)

  if (successful.length > 0) {
    console.log(`\n✅ Successful (${successful.length}):`)
    for (const r of successful) {
      console.log(`   • ${r.name}: ${r.url}`)
    }
  }

  if (failed.length > 0) {
    console.log(`\n❌ Failed (${failed.length}):`)
    for (const r of failed) {
      console.log(`   • ${r.name}: ${r.error}`)
    }
  }

  console.log('\n✨ Done!')
  process.exit(failed.length > 0 ? 1 : 0)
}

main()
