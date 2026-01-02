#!/usr/bin/env tsx

/**
 * Upload Photo Intelligence Results to Database
 *
 * Reads pipeline outputs (JSON/Parquet) and uploads to database.
 * Matches photos by filename and links intelligence data.
 *
 * Usage:
 *   npx tsx src/scripts/photo-intelligence/upload-intelligence.ts <output-dir> [options]
 *
 * Options:
 *   --dry-run          Show what would be uploaded without actually uploading
 *   --verbose          Show detailed progress
 *   --version <v>      Intelligence pipeline version (default: "1.0.0")
 */

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { parseArgs } from 'util'
import type {
  PhotoIntelligenceResult,
  ClusterData,
  PeopleCluster,
} from './types'

// Load environment variables
config({ path: '.env.local' })

interface PhotoRecord {
  id: string
  original_filename: string | null
}

interface UploadStats {
  photosProcessed: number
  cropsInserted: number
  hashesInserted: number
  embeddingsInserted: number
  facesInserted: number
  clustersInserted: number
  errors: number
}

async function loadPipelineResults(outputDir: string): Promise<{
  photos: PhotoIntelligenceResult[]
  clusters: ClusterData | null
  people: PeopleCluster[]
}> {
  const photosJsonPath = join(outputDir, 'photos.json')
  const clustersJsonPath = join(outputDir, 'clusters.json')
  const peopleJsonPath = join(outputDir, 'people.json')

  if (!existsSync(photosJsonPath)) {
    throw new Error(`Photos JSON not found: ${photosJsonPath}`)
  }

  const photosJson = await readFile(photosJsonPath, 'utf-8')
  const photos: PhotoIntelligenceResult[] = JSON.parse(photosJson)

  let clusters: ClusterData | null = null
  if (existsSync(clustersJsonPath)) {
    const clustersJson = await readFile(clustersJsonPath, 'utf-8')
    clusters = JSON.parse(clustersJson)
  }

  let people: PeopleCluster[] = []
  if (existsSync(peopleJsonPath)) {
    const peopleJson = await readFile(peopleJsonPath, 'utf-8')
    people = JSON.parse(peopleJson)
  }

  return { photos, clusters, people }
}

async function findPhotoByFilename(
  filename: string
): Promise<PhotoRecord | null> {
  const { rows } = await sql<PhotoRecord>`
    SELECT id, original_filename
    FROM photos
    WHERE original_filename = ${filename}
    LIMIT 1
  `
  return rows[0] || null
}

async function uploadPhotoIntelligence(
  photoId: string,
  result: PhotoIntelligenceResult,
  version: string,
  dryRun: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Upload crops
    for (const [aspectRatio, crop] of Object.entries(result.crops)) {
      if (dryRun) {
        console.log(`  Would insert crop: ${aspectRatio}`)
      } else {
        await sql`
          INSERT INTO photo_crops (
            photo_id, aspect_ratio, crop_box, confidence, method
          ) VALUES (
            ${photoId}::uuid,
            ${aspectRatio},
            ${JSON.stringify(crop.crop_box)}::jsonb,
            ${crop.confidence},
            ${crop.method}
          )
          ON CONFLICT (photo_id, aspect_ratio)
          DO UPDATE SET
            crop_box = EXCLUDED.crop_box,
            confidence = EXCLUDED.confidence,
            method = EXCLUDED.method,
            created_at = NOW()
        `
      }
    }

    // 2. Upload hashes
    if (result.hashes.phash && result.hashes.dhash) {
      if (dryRun) {
        console.log(`  Would insert hashes`)
      } else {
        await sql`
          INSERT INTO photo_hashes (photo_id, phash, dhash)
          VALUES (${photoId}::uuid, ${result.hashes.phash}, ${result.hashes.dhash})
          ON CONFLICT (photo_id)
          DO UPDATE SET
            phash = EXCLUDED.phash,
            dhash = EXCLUDED.dhash,
            created_at = NOW()
        `
      }
    }

    // 3. Upload image embedding
    if (result.image_embedding && result.image_embedding.length > 0) {
      if (dryRun) {
        console.log(
          `  Would insert image embedding (${result.image_embedding.length} dims)`
        )
      } else {
        await sql`
          INSERT INTO photo_embeddings (photo_id, embedding, model)
          VALUES (${photoId}::uuid, ${JSON.stringify(result.image_embedding)}::jsonb, 'clip')
          ON CONFLICT (photo_id, model)
          DO UPDATE SET
            embedding = EXCLUDED.embedding,
            created_at = NOW()
        `
      }
    }

    // 4. Upload face detections
    for (const faceEncoding of result.face_encodings) {
      if (dryRun) {
        console.log(`  Would insert face detection`)
      } else {
        await sql`
          INSERT INTO detected_faces (
            photo_id, face_box, face_embedding, confidence, quality_score
          ) VALUES (
            ${photoId}::uuid,
            ${JSON.stringify(faceEncoding.box)}::jsonb,
            ${JSON.stringify(faceEncoding.embedding)}::jsonb,
            ${faceEncoding.confidence},
            ${faceEncoding.quality_score}
          )
        `
      }
    }

    // 5. Update photo intelligence metadata
    if (!dryRun) {
      await sql`
        UPDATE photos
        SET intelligence_processed_at = NOW(),
            intelligence_version = ${version}
        WHERE id = ${photoId}::uuid
      `
    }

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message }
  }
}

async function uploadClusters(
  clusters: ClusterData,
  dryRun: boolean
): Promise<number> {
  let inserted = 0

  // Upload near-duplicate clusters
  for (const cluster of clusters.near_duplicates) {
    // Find photo IDs by filename
    const photoIds: string[] = []
    for (const filename of cluster.photo_filenames) {
      const photo = await findPhotoByFilename(filename)
      if (photo) {
        photoIds.push(photo.id)
      }
    }

    if (photoIds.length > 1) {
      // Find representative photo
      const repPhoto = await findPhotoByFilename(cluster.representative_photo)
      const repPhotoId = repPhoto?.id || photoIds[0]

      if (dryRun) {
        console.log(
          `  Would insert near-duplicate cluster: ${photoIds.length} photos`
        )
      } else {
        const photoIdsLiteral = `{${photoIds.join(',')}}`
        await sql`
          INSERT INTO photo_clusters (
            cluster_type, photo_ids, representative_photo_id, metadata
          ) VALUES (
            'near_duplicate',
            ${photoIdsLiteral}::uuid[],
            ${repPhotoId}::uuid,
            ${JSON.stringify({ cluster_id: cluster.cluster_id })}::jsonb
          )
        `
        inserted++
      }
    }
  }

  // Upload scene clusters
  for (const cluster of clusters.scenes) {
    const photoIds: string[] = []
    for (const filename of cluster.photo_filenames) {
      const photo = await findPhotoByFilename(filename)
      if (photo) {
        photoIds.push(photo.id)
      }
    }

    if (photoIds.length > 1) {
      const repPhoto = await findPhotoByFilename(cluster.representative_photo)
      const repPhotoId = repPhoto?.id || photoIds[0]

      if (dryRun) {
        console.log(`  Would insert scene cluster: ${photoIds.length} photos`)
      } else {
        const photoIdsLiteral = `{${photoIds.join(',')}}`
        await sql`
          INSERT INTO photo_clusters (
            cluster_type, photo_ids, representative_photo_id, metadata
          ) VALUES (
            'scene',
            ${photoIdsLiteral}::uuid[],
            ${repPhotoId}::uuid,
            ${JSON.stringify({ cluster_id: cluster.cluster_id })}::jsonb
          )
        `
        inserted++
      }
    }
  }

  return inserted
}

async function uploadPeopleClusters(
  people: PeopleCluster[],
  dryRun: boolean
): Promise<number> {
  let inserted = 0

  for (const personCluster of people) {
    // Find photo IDs by filename
    const photoIds: string[] = []
    for (const filename of personCluster.photo_filenames) {
      const photo = await findPhotoByFilename(filename)
      if (photo) {
        photoIds.push(photo.id)
      }
    }

    if (photoIds.length > 1) {
      // Find representative photo
      const repPhoto = await findPhotoByFilename(
        personCluster.representative_face.filename
      )
      const repPhotoId = repPhoto?.id || photoIds[0]

      if (dryRun) {
        console.log(`  Would insert person cluster: ${photoIds.length} photos`)
      } else {
        const photoIdsLiteral = `{${photoIds.join(',')}}`
        await sql`
          INSERT INTO photo_clusters (
            cluster_type, photo_ids, representative_photo_id, metadata
          ) VALUES (
            'person',
            ${photoIdsLiteral}::uuid[],
            ${repPhotoId}::uuid,
            ${JSON.stringify({
              person_id: personCluster.person_id,
              representative_face: personCluster.representative_face,
            })}::jsonb
          )
        `
        inserted++
      }
    }
  }

  return inserted
}

async function main() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'dry-run': { type: 'boolean' },
      verbose: { type: 'boolean', short: 'v' },
      version: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
  })

  if (values.help || positionals.length === 0) {
    console.log(`
Upload Photo Intelligence Results to Database

Usage:
  npx tsx src/scripts/photo-intelligence/upload-intelligence.ts <output-dir> [options]

Options:
  --dry-run          Show what would be uploaded without actually uploading
  -v, --verbose      Show detailed progress
  --version <v>      Intelligence pipeline version (default: "1.0.0")
  -h, --help         Show this help

Examples:
  npx tsx src/scripts/photo-intelligence/upload-intelligence.ts ./photo-intelligence-output
  npx tsx src/scripts/photo-intelligence/upload-intelligence.ts ./output --dry-run --verbose
`)
    process.exit(0)
  }

  const outputDir = positionals[0]
  const dryRun = values['dry-run'] || false
  const verbose = values.verbose || false
  const version = (values.version as string) || '1.0.0'

  if (!existsSync(outputDir)) {
    console.error(`❌ Output directory not found: ${outputDir}`)
    process.exit(1)
  }

  console.log('📤 Uploading photo intelligence results...\n')
  if (dryRun) {
    console.log('🧪 DRY RUN MODE - No data will be uploaded\n')
  }

  // Load pipeline results
  console.log('📂 Loading pipeline results...')
  const { photos, clusters, people } = await loadPipelineResults(outputDir)
  console.log(`   Found ${photos.length} photos`)
  if (clusters) {
    console.log(
      `   Found ${clusters.near_duplicates.length} near-duplicate clusters`
    )
    console.log(`   Found ${clusters.scenes.length} scene clusters`)
  }
  console.log(`   Found ${people.length} people clusters\n`)

  const stats: UploadStats = {
    photosProcessed: 0,
    cropsInserted: 0,
    hashesInserted: 0,
    embeddingsInserted: 0,
    facesInserted: 0,
    clustersInserted: 0,
    errors: 0,
  }

  // Upload photo intelligence data
  console.log('📷 Uploading photo intelligence data...')
  for (let i = 0; i < photos.length; i++) {
    const result = photos[i]

    if (verbose) {
      console.log(`[${i + 1}/${photos.length}] ${result.filename}`)
    }

    // Find photo in database
    const photo = await findPhotoByFilename(result.filename)
    if (!photo) {
      if (verbose) {
        console.log(`  ⚠️  Photo not found in database, skipping`)
      }
      stats.errors++
      continue
    }

    const uploadResult = await uploadPhotoIntelligence(
      photo.id,
      result,
      version,
      dryRun
    )

    if (uploadResult.success) {
      stats.photosProcessed++
      stats.cropsInserted += Object.keys(result.crops).length
      if (result.hashes.phash) stats.hashesInserted++
      if (result.image_embedding.length > 0) stats.embeddingsInserted++
      stats.facesInserted += result.face_encodings.length

      if (verbose) {
        console.log(`  ✅ Uploaded`)
      }
    } else {
      stats.errors++
      if (verbose) {
        console.log(`  ❌ Error: ${uploadResult.error}`)
      }
    }
  }

  // Upload clusters
  if (clusters) {
    console.log('\n🔗 Uploading clusters...')
    const clusterCount = await uploadClusters(clusters, dryRun)
    stats.clustersInserted += clusterCount
    console.log(`   Uploaded ${clusterCount} clusters`)
  }

  // Upload people clusters
  if (people.length > 0) {
    console.log('\n👥 Uploading people clusters...')
    const peopleCount = await uploadPeopleClusters(people, dryRun)
    stats.clustersInserted += peopleCount
    console.log(`   Uploaded ${peopleCount} people clusters`)
  }

  // Summary
  console.log('\n📊 Summary:')
  console.log(`   Photos processed: ${stats.photosProcessed}`)
  console.log(`   Crops inserted: ${stats.cropsInserted}`)
  console.log(`   Hashes inserted: ${stats.hashesInserted}`)
  console.log(`   Embeddings inserted: ${stats.embeddingsInserted}`)
  console.log(`   Faces inserted: ${stats.facesInserted}`)
  console.log(`   Clusters inserted: ${stats.clustersInserted}`)
  console.log(`   Errors: ${stats.errors}`)

  if (dryRun) {
    console.log('\n💡 Run without --dry-run to actually upload data')
  } else {
    console.log('\n✅ Done!')
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
