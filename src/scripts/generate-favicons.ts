/**
 * Generate favicons from source image
 *
 * Creates all necessary favicon sizes and formats for best practice:
 * - favicon.ico (multi-size: 16x16, 32x32, 48x48)
 * - favicon-16x16.png
 * - favicon-32x32.png
 * - apple-touch-icon.png (180x180)
 * - android-chrome-192x192.png
 * - android-chrome-512x512.png
 * - site.webmanifest
 *
 * Usage: npx tsx src/scripts/generate-favicons.ts
 */

import sharp from 'sharp'
import * as fs from 'fs'
import * as path from 'path'

const SOURCE_IMAGE = path.join(
  process.cwd(),
  'public/images/bottb-lightning.png'
)
const OUTPUT_DIR = path.join(process.cwd(), 'public')
const APP_DIR = path.join(process.cwd(), 'src/app')

// Favicon sizes to generate
const SIZES = {
  'favicon-16x16.png': 16,
  'favicon-32x32.png': 32,
  'apple-touch-icon.png': 180,
  'android-chrome-192x192.png': 192,
  'android-chrome-512x512.png': 512,
}

// Create a circular favicon with enlarged lightning bolt
async function createCircularFavicon(size: number): Promise<Buffer> {
  // Work at higher resolution for better quality, then scale down
  const workSize = 512
  const radius = workSize / 2

  // Create complete SVG with circle background and embedded image
  // Scale: 115% vertical, 126.5% horizontal (10% wider)
  const scaleY = 1.15
  const scaleX = 1.265 // 10% wider than scaleY
  const imgWidth = Math.round(workSize * scaleX)
  const imgHeight = Math.round(workSize * scaleY)

  const sourceBuffer = await sharp(SOURCE_IMAGE)
    .resize(imgWidth, imgHeight, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  const base64Image = sourceBuffer.toString('base64')
  // Center the image, with slight left adjustment (-8px at 512 scale)
  const imgOffsetX =
    Math.round((workSize - imgWidth) / 2) - Math.round(workSize * 0.016)
  const imgOffsetY = Math.round((workSize - imgHeight) / 2)

  // Create SVG with circular clip path containing the lightning bolt
  const svgWithClip = `
    <svg width="${workSize}" height="${workSize}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <defs>
        <clipPath id="circleClip">
          <circle cx="${radius}" cy="${radius}" r="${radius}"/>
        </clipPath>
      </defs>
      <g clip-path="url(#circleClip)">
        <rect width="${workSize}" height="${workSize}" fill="black"/>
        <image x="${imgOffsetX}" y="${imgOffsetY}" width="${imgWidth}" height="${imgHeight}" xlink:href="data:image/png;base64,${base64Image}"/>
      </g>
    </svg>
  `

  // Convert SVG to PNG and resize to target size
  const result = await sharp(Buffer.from(svgWithClip))
    .resize(size, size)
    .png()
    .toBuffer()

  return result
}

async function generateFavicons() {
  console.log('🎨 Generating circular favicons from:', SOURCE_IMAGE)

  // Verify source image exists
  if (!fs.existsSync(SOURCE_IMAGE)) {
    console.error('❌ Source image not found:', SOURCE_IMAGE)
    process.exit(1)
  }

  // Generate PNG favicons (circular)
  for (const [filename, size] of Object.entries(SIZES)) {
    const outputPath = path.join(OUTPUT_DIR, filename)
    const circularIcon = await createCircularFavicon(size)
    await sharp(circularIcon).toFile(outputPath)
    console.log(`✅ Generated ${filename} (${size}x${size}, circular)`)
  }

  // Generate ICO file
  const icoPath = path.join(OUTPUT_DIR, 'favicon.ico')
  const icoIcon = await createCircularFavicon(32)
  await sharp(icoIcon).toFile(icoPath)
  console.log('✅ Generated favicon.ico (32x32, circular)')

  // Also create icon.png in app directory for Next.js App Router
  const appIconPath = path.join(APP_DIR, 'icon.png')
  const appIcon = await createCircularFavicon(32)
  await sharp(appIcon).toFile(appIconPath)
  console.log('✅ Generated src/app/icon.png (32x32, circular)')

  // Create apple-icon.png in app directory
  const appleIconPath = path.join(APP_DIR, 'apple-icon.png')
  const appleIcon = await createCircularFavicon(180)
  await sharp(appleIcon).toFile(appleIconPath)
  console.log('✅ Generated src/app/apple-icon.png (180x180, circular)')

  // Generate site.webmanifest
  const manifest = {
    name: 'Battle of the Tech Bands',
    short_name: 'BOTTB',
    description:
      "Where technology meets rock 'n' roll. A community charity event supporting Youngcare.",
    icons: [
      {
        src: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
    theme_color: '#0a0a0a',
    background_color: '#0a0a0a',
    display: 'standalone',
    start_url: '/',
  }

  const manifestPath = path.join(OUTPUT_DIR, 'site.webmanifest')
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  console.log('✅ Generated site.webmanifest')

  console.log('\n🎉 All favicons generated successfully!')
  console.log('\nNext steps:')
  console.log(
    '1. The metadata in layout.tsx will automatically use src/app/icon.png and src/app/apple-icon.png'
  )
  console.log(
    '2. Update layout.tsx metadata to include manifest and theme color'
  )
}

generateFavicons().catch(console.error)
