/**
 * Smart E2E database restore script
 *
 * Checks if the pg_dump cache needs regeneration by comparing:
 * 1. Whether test-db.sql exists and has real content (not just placeholder)
 * 2. Whether any JSON fixture or seed script is newer than the dump
 *
 * If regeneration needed: runs seed + dump
 * Otherwise: runs fast restore from cache
 */

import { execSync } from 'child_process'
import { existsSync, statSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const E2E_DIR = join(__dirname)
const FIXTURES_DIR = join(E2E_DIR, 'fixtures')
const DATA_DIR = join(FIXTURES_DIR, 'data')
const DUMP_FILE = join(FIXTURES_DIR, 'test-db.sql')
const SEED_SCRIPT = join(E2E_DIR, 'seed-test-db.ts')

// Minimum size for a valid dump (placeholder is ~500 bytes, real dump is much larger)
const MIN_DUMP_SIZE = 5000

function log(message: string) {
  console.log(`[smart-restore] ${message}`)
}

function isDumpValid(): boolean {
  if (!existsSync(DUMP_FILE)) {
    log('Dump file does not exist')
    return false
  }

  const stats = statSync(DUMP_FILE)
  if (stats.size < MIN_DUMP_SIZE) {
    log(`Dump file too small (${stats.size} bytes) - likely placeholder`)
    return false
  }

  // Check if it starts with actual SQL (not just comments)
  const content = readFileSync(DUMP_FILE, 'utf-8').slice(0, 1000)
  if (!content.includes('CREATE') && !content.includes('INSERT')) {
    log('Dump file does not contain SQL statements')
    return false
  }

  return true
}

function getNewestFixtureTime(): number {
  let newest = 0

  // Check JSON fixture files
  if (existsSync(DATA_DIR)) {
    const files = readdirSync(DATA_DIR)
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = join(DATA_DIR, file)
        const mtime = statSync(filePath).mtimeMs
        if (mtime > newest) {
          newest = mtime
        }
      }
    }
  }

  // Check seed script
  if (existsSync(SEED_SCRIPT)) {
    const mtime = statSync(SEED_SCRIPT).mtimeMs
    if (mtime > newest) {
      newest = mtime
    }
  }

  return newest
}

function getDumpTime(): number {
  if (!existsSync(DUMP_FILE)) {
    return 0
  }
  return statSync(DUMP_FILE).mtimeMs
}

function needsRegeneration(): boolean {
  if (!isDumpValid()) {
    return true
  }

  const fixtureTime = getNewestFixtureTime()
  const dumpTime = getDumpTime()

  if (fixtureTime > dumpTime) {
    log(
      `Fixtures newer than dump (fixture: ${new Date(fixtureTime).toISOString()}, dump: ${new Date(dumpTime).toISOString()})`
    )
    return true
  }

  return false
}

function runCommand(command: string, description: string) {
  log(`Running: ${description}`)
  try {
    execSync(command, { stdio: 'inherit', cwd: join(__dirname, '..') })
  } catch (_error) {
    console.error(`Failed to run: ${description}`)
    process.exit(1)
  }
}

function main() {
  log('Checking if dump regeneration is needed...')

  if (needsRegeneration()) {
    log('Regenerating dump from fixtures...')
    runCommand('npm run e2e:seed', 'Seed database')
    runCommand('npm run e2e:dump', 'Generate dump')
    log('✅ Dump regenerated successfully')
  } else {
    log('Dump is up to date, restoring from cache...')
    runCommand('npm run e2e:restore', 'Restore from dump')
    log('✅ Database restored from cache')
  }
}

main()
