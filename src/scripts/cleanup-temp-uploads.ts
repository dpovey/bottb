#!/usr/bin/env tsx

import { cleanupTempUploads } from '../lib/blob'

async function main() {
  try {
    console.log('🧹 Starting cleanup of temporary uploads...')

    const deletedCount = await cleanupTempUploads()

    console.log(`✅ Cleanup complete! Deleted ${deletedCount} temporary files.`)
  } catch (error) {
    console.error('❌ Cleanup failed:', error)
    process.exit(1)
  }
}

main()
