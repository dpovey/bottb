#!/usr/bin/env tsx

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'
import { uploadImage, generateEventImageFilename } from '../lib/blob'
import { readFileSync, existsSync } from 'fs'
import { extname, basename } from 'path'

// Load environment variables from .env.local
config({ path: '.env.local' })

async function uploadEventImage(eventId: string, filePath: string) {
  try {
    console.log(`🎪 Uploading image for event: ${eventId}`)
    console.log(`📁 Source file: ${filePath}`)

    // Check if file exists
    if (!existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`)
      process.exit(1)
    }

    // First, verify the event exists
    const { rows: eventRows } = await sql`
      SELECT id, name FROM events WHERE id = ${eventId}
    `

    if (eventRows.length === 0) {
      console.error(`❌ Event with ID ${eventId} not found`)
      process.exit(1)
    }

    const event = eventRows[0]
    console.log(`✅ Found event: ${event.name}`)

    // Read the file
    console.log('📥 Reading file...')
    const fileBuffer = readFileSync(filePath)
    const fileExtension = extname(filePath)
    const _fileName = basename(filePath, fileExtension)

    // Determine MIME type based on extension
    const mimeTypes: { [key: string]: string } = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
    }

    const mimeType = mimeTypes[fileExtension.toLowerCase()] || 'image/png'
    console.log(`📄 File type: ${mimeType}`)

    const imageFile = new File([fileBuffer], `image${fileExtension}`, {
      type: mimeType,
    })

    // Generate filename for blob storage with preserved extension
    const filename = generateEventImageFilename(
      eventId,
      `image${fileExtension}`,
      'image'
    )
    console.log(`📁 Blob filename: ${filename}`)

    // Upload to blob storage
    console.log('☁️  Uploading to Vercel Blob...')
    const result = await uploadImage(imageFile, filename, {
      access: 'public',
      addRandomSuffix: false,
      cacheControlMaxAge: 31536000, // 1 year
    })

    console.log(`✅ Upload successful!`)
    console.log(`🔗 Blob URL: ${result.url}`)

    // Update the event's info column with the image URL
    console.log('💾 Updating database...')
    await sql`
      UPDATE events 
      SET info = jsonb_set(
        COALESCE(info, '{}'::jsonb), 
        '{image_url}', 
        ${JSON.stringify(result.url)}::jsonb
      )
      WHERE id = ${eventId}
    `

    console.log('✅ Database updated successfully!')
    console.log(`🎉 Image uploaded and linked to event: ${event.name}`)
    console.log(`🔗 Image URL: ${result.url}`)
  } catch (error) {
    console.error('❌ Upload failed:', error)
    process.exit(1)
  }
}

async function main() {
  const args = process.argv.slice(2)

  if (args.length !== 2) {
    console.log('Usage: npm run upload-event-image <event-id> <file-path>')
    console.log('')
    console.log('Example:')
    console.log('npm run upload-event-image sydney-2025 ./event-photo.jpg')
    console.log(
      'npm run upload-event-image melbourne-2024 /path/to/event-image.png'
    )
    process.exit(1)
  }

  const [eventId, filePath] = args
  await uploadEventImage(eventId, filePath)
}

main()
