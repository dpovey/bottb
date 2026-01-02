#!/usr/bin/env tsx

/**
 * Photo Intelligence Pipeline Orchestrator (Node.js)
 *
 * Scans photo directory, calls Python pipeline for batches,
 * and manages progress and error handling.
 *
 * Usage:
 *   npx tsx src/scripts/photo-intelligence/run-pipeline.ts <photo-dir> [options]
 *
 * Options:
 *   --output-dir <dir>     Output directory (default: ./photo-intelligence-output)
 *   --batch-size <n>       Batch size for processing (default: 100)
 *   --python-venv <path>    Path to Python virtual environment
 *   --skip-clustering       Skip clustering step
 *   --verbose               Verbose output
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'
import { parseArgs } from 'util'

const execAsync = promisify(exec)

const PHOTOS_BASE_PATH = '/Volumes/Extreme SSD/Photos'
const PIPELINE_SCRIPT = join(
  __dirname,
  '../../../scripts/photo-intelligence/pipeline.py'
)

interface PipelineOptions {
  inputDir: string
  outputDir: string
  batchSize: number
  pythonVenv?: string
  skipClustering: boolean
  verbose: boolean
}

async function findPython(): Promise<string> {
  // Try python3 first, then python
  try {
    const { stdout } = await execAsync('which python3')
    return stdout.trim()
  } catch {
    try {
      const { stdout } = await execAsync('which python')
      return stdout.trim()
    } catch {
      throw new Error('Python not found. Please install Python 3.8+')
    }
  }
}

async function _checkPythonDependencies(pythonPath: string): Promise<boolean> {
  try {
    // Check core dependencies (mediapipe OR face_recognition for face detection)
    await execAsync(
      `${pythonPath} -c "import ultralytics, sentence_transformers, imagehash, sklearn, mediapipe"`
    )
    // If command succeeds (exit code 0), dependencies are installed
    return true
  } catch (_error: any) {
    // Try with face_recognition instead
    try {
      await execAsync(
        `${pythonPath} -c "import ultralytics, sentence_transformers, imagehash, sklearn, face_recognition"`
      )
      return true
    } catch {
      // Check if it's just a warning (like Ultralytics settings message)
      // If stderr contains warnings but no actual errors, consider it OK
      return false
    }
  }
}

async function runPipeline(options: PipelineOptions): Promise<void> {
  let pythonPath: string
  if (options.pythonVenv) {
    // Resolve to absolute path
    const venvPath = resolve(process.cwd(), options.pythonVenv)
    pythonPath = join(venvPath, 'bin', 'python')
    if (!existsSync(pythonPath)) {
      throw new Error(`Python virtual environment not found: ${pythonPath}`)
    }
  } else {
    pythonPath = await findPython()
  }

  // Check if pipeline script exists
  if (!existsSync(PIPELINE_SCRIPT)) {
    throw new Error(`Pipeline script not found: ${PIPELINE_SCRIPT}`)
  }

  // Check Python dependencies
  console.log('Checking Python dependencies...')
  console.log(`Using Python: ${pythonPath}`)
  try {
    const { stderr } = await execAsync(
      `${pythonPath} -c "import ultralytics, sentence_transformers, imagehash, sklearn, mediapipe"`
    )
    if (stderr && !stderr.includes('Ultralytics')) {
      // Ultralytics prints to stderr but it's not an error
      console.warn('Warning:', stderr)
    }
    console.log('✅ Python dependencies OK')
  } catch (_error: any) {
    // Try with face_recognition instead
    try {
      const { stderr } = await execAsync(
        `${pythonPath} -c "import ultralytics, sentence_transformers, imagehash, sklearn, face_recognition"`
      )
      if (stderr && !stderr.includes('Ultralytics')) {
        console.warn('Warning:', stderr)
      }
      console.log('✅ Python dependencies OK (using face_recognition)')
    } catch (err: any) {
      console.error('❌ Python dependencies not installed.')
      console.error(
        '   Install with: uv pip install -r scripts/photo-intelligence/requirements.txt'
      )
      console.error('   Error:', err?.message || 'Unknown error')
      if (err?.stderr) {
        console.error('   stderr:', err.stderr)
      }
      process.exit(1)
    }
  }

  // Create output directory
  if (!existsSync(options.outputDir)) {
    mkdirSync(options.outputDir, { recursive: true })
  }

  // Build command with proper quoting for paths with spaces
  const args = [
    `"${PIPELINE_SCRIPT}"`,
    `"${options.inputDir}"`,
    `"${options.outputDir}"`,
    '--batch-size',
    options.batchSize.toString(),
  ]

  if (options.skipClustering) {
    args.push('--skip-clustering')
  }

  if (options.verbose) {
    args.push('--verbose')
  }

  const command = `${pythonPath} ${args.join(' ')}`

  console.log(`\n🚀 Running pipeline...`)
  console.log(`   Input: ${options.inputDir}`)
  console.log(`   Output: ${options.outputDir}`)
  console.log(`   Batch size: ${options.batchSize}`)
  console.log(`\nCommand: ${command}\n`)

  // Run pipeline
  const { stdout, stderr } = await execAsync(command, {
    maxBuffer: 10 * 1024 * 1024, // 10MB buffer
  })

  if (stdout) {
    console.log(stdout)
  }

  if (stderr) {
    console.error(stderr)
  }

  console.log('\n✅ Pipeline complete!')
  console.log(`   Results saved to: ${options.outputDir}`)
}

async function main() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'output-dir': { type: 'string' },
      'batch-size': { type: 'string' },
      'python-venv': { type: 'string' },
      'skip-clustering': { type: 'boolean' },
      verbose: { type: 'boolean', short: 'v' },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
  })

  if (values.help || positionals.length === 0) {
    console.log(`
Photo Intelligence Pipeline Orchestrator

Usage:
  npx tsx src/scripts/photo-intelligence/run-pipeline.ts <photo-dir> [options]

Options:
  --output-dir <dir>       Output directory (default: ./photo-intelligence-output)
  --batch-size <n>         Batch size for processing (default: 100)
  --python-venv <path>      Path to Python virtual environment
  --skip-clustering         Skip clustering step
  -v, --verbose            Verbose output
  -h, --help               Show this help

Examples:
  npx tsx src/scripts/photo-intelligence/run-pipeline.ts "${PHOTOS_BASE_PATH}/Brisbane 2024"
  npx tsx src/scripts/photo-intelligence/run-pipeline.ts "${PHOTOS_BASE_PATH}/Brisbane 2024" --output-dir ./output
  npx tsx src/scripts/photo-intelligence/run-pipeline.ts "${PHOTOS_BASE_PATH}/Brisbane 2024" --batch-size 50 --verbose
`)
    process.exit(0)
  }

  const inputDir = positionals[0]
  const outputDir = values['output-dir'] || './photo-intelligence-output'
  const batchSize = parseInt((values['batch-size'] as string) || '100', 10)
  const pythonVenv = values['python-venv'] as string | undefined
  const skipClustering = values['skip-clustering'] || false
  const verbose = values.verbose || false

  if (!existsSync(inputDir)) {
    console.error(`❌ Input directory not found: ${inputDir}`)
    process.exit(1)
  }

  try {
    await runPipeline({
      inputDir: resolve(inputDir),
      outputDir: resolve(outputDir),
      batchSize,
      pythonVenv,
      skipClustering,
      verbose,
    })
  } catch (error) {
    console.error('❌ Pipeline failed:', error)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
