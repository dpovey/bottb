/**
 * Schema Validation Script
 *
 * Validates structured data (JSON-LD) across pages using structured-data-testing-tool.
 * Run: pnpm schema:validate [options]
 *
 * Options:
 *   --url=<base-url>    Base URL to validate (default: http://localhost:3030)
 *   --json              Output results as JSON
 *   --verbose           Show detailed output for each page
 *   --max=<n>           Max pages per schema type to test (default: 3)
 *
 * Tests pages for Google Rich Results compliance.
 */

import { structuredDataTest } from 'structured-data-testing-tool'
import { Google } from 'structured-data-testing-tool/presets'
import { XMLParser } from 'fast-xml-parser'
import { fetch } from 'undici'

// Parse command line arguments
const args = process.argv.slice(2)
const getArg = (name: string, defaultValue: string): string => {
  const arg = args.find((a) => a.startsWith(`--${name}=`))
  return arg ? arg.split('=')[1] : defaultValue
}
const hasFlag = (name: string): boolean => args.includes(`--${name}`)

const BASE_URL = getArg('url', 'http://localhost:3030')
const JSON_OUTPUT = hasFlag('json')
const VERBOSE = hasFlag('verbose')
const MAX_PER_TYPE = parseInt(getArg('max', '3'), 10)

// Page types with known JSON-LD schemas
interface PageType {
  pattern: RegExp
  name: string
  expectedSchemas: string[]
}

const PAGE_TYPES: PageType[] = [
  {
    pattern: /^\/event\/[^/]+$/,
    name: 'Event',
    expectedSchemas: ['MusicEvent'],
  },
  {
    pattern: /^\/band\/[^/]+$/,
    name: 'Band',
    expectedSchemas: ['MusicGroup'],
  },
  {
    pattern: /^\/results\/[^/]+$/,
    name: 'Results',
    expectedSchemas: ['MusicEvent'],
  },
  {
    pattern: /^\/photos\/[^/]+$/,
    name: 'Photo',
    expectedSchemas: ['ImageObject'],
  },
  {
    pattern: /^\/faq$/,
    name: 'FAQ',
    expectedSchemas: ['FAQPage'],
  },
  {
    pattern: /^\/videos$/,
    name: 'Videos',
    expectedSchemas: ['VideoObject'],
  },
  {
    pattern: /^\/slideshow\/[^/]+$/,
    name: 'Slideshow',
    expectedSchemas: ['ImageGallery'],
  },
  // Homepage has Organization schema from layout
  {
    pattern: /^\/$/,
    name: 'Homepage',
    expectedSchemas: ['Organization'],
  },
]

interface SitemapUrl {
  loc: string
  path: string
}

interface ValidationResult {
  url: string
  pageType: string
  passed: number
  failed: number
  warnings: number
  schemasFound: string[]
  errors: string[]
}

interface AuditResult {
  timestamp: string
  baseUrl: string
  pagesValidated: number
  results: ValidationResult[]
  summary: {
    totalPassed: number
    totalFailed: number
    totalWarnings: number
    pagesPassed: number
    pagesFailed: number
  }
}

/**
 * Fetch and parse the sitemap
 */
async function fetchSitemap(baseUrl: string): Promise<SitemapUrl[]> {
  const sitemapUrl = `${baseUrl}/sitemap.xml`

  const response = await fetch(sitemapUrl)
  if (!response.ok) {
    throw new Error(
      `Failed to fetch sitemap: ${response.status} ${response.statusText}`
    )
  }

  const xml = await response.text()
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  })
  const result = parser.parse(xml)

  const urlset = result.urlset?.url || []
  const urls: { loc: string }[] = Array.isArray(urlset) ? urlset : [urlset]

  // Rewrite URLs to use our target baseUrl and extract paths
  return urls.map((u) => {
    const originalUrl = new URL(u.loc)
    const targetUrl = new URL(baseUrl)
    const rewrittenUrl = `${targetUrl.origin}${originalUrl.pathname}`

    return {
      loc: rewrittenUrl,
      path: originalUrl.pathname,
    }
  })
}

/**
 * Categorize URLs by page type
 */
function categorizeUrls(
  urls: SitemapUrl[]
): Map<string, { url: string; pageType: PageType }[]> {
  const categorized = new Map<string, { url: string; pageType: PageType }[]>()

  for (const { loc, path } of urls) {
    for (const pageType of PAGE_TYPES) {
      if (pageType.pattern.test(path)) {
        const existing = categorized.get(pageType.name) || []
        existing.push({ url: loc, pageType })
        categorized.set(pageType.name, existing)
        break
      }
    }
  }

  return categorized
}

/**
 * Validate a single page
 */
async function validatePage(
  url: string,
  pageType: PageType
): Promise<ValidationResult> {
  try {
    const result = await structuredDataTest(url, {
      presets: [Google],
    })

    return {
      url,
      pageType: pageType.name,
      passed: result.passed.length,
      failed: result.failed.length,
      warnings: result.warnings.length,
      schemasFound: result.schemas,
      errors: [],
    }
  } catch (err: unknown) {
    // Handle validation failures (tests ran but some failed)
    if (
      err &&
      typeof err === 'object' &&
      'type' in err &&
      err.type === 'VALIDATION_FAILED' &&
      'res' in err
    ) {
      const res = err.res as {
        passed: unknown[]
        failed: { description?: string; error?: string }[]
        warnings: unknown[]
        schemas: string[]
      }
      return {
        url,
        pageType: pageType.name,
        passed: res.passed.length,
        failed: res.failed.length,
        warnings: res.warnings.length,
        schemasFound: res.schemas,
        errors: res.failed.map(
          (f) => f.description || f.error || 'Unknown error'
        ),
      }
    }

    // Handle other errors (fetch failed, etc.)
    return {
      url,
      pageType: pageType.name,
      passed: 0,
      failed: 1,
      warnings: 0,
      schemasFound: [],
      errors: [err instanceof Error ? err.message : 'Unknown error'],
    }
  }
}

/**
 * Main validation function
 */
async function runValidation(): Promise<AuditResult> {
  if (!JSON_OUTPUT) {
    console.log('🔍 Schema Validation Starting...\n')
    console.log(`   Base URL: ${BASE_URL}`)
    console.log(`   Max per type: ${MAX_PER_TYPE}`)
    console.log(`   Verbose: ${VERBOSE}`)
    console.log('')
  }

  // Fetch sitemap
  if (!JSON_OUTPUT) {
    console.log('📄 Fetching sitemap...')
  }

  let sitemapUrls: SitemapUrl[]
  try {
    sitemapUrls = await fetchSitemap(BASE_URL)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (JSON_OUTPUT) {
      console.log(
        JSON.stringify({
          error: `Failed to fetch sitemap: ${message}`,
          timestamp: new Date().toISOString(),
        })
      )
    } else {
      console.error(`\n❌ ${message}`)
      console.error('\nMake sure the dev server is running:')
      console.error(`   pnpm dev:restart`)
    }
    process.exit(1)
  }

  if (!JSON_OUTPUT) {
    console.log(`   Found ${sitemapUrls.length} URLs in sitemap`)
  }

  // Categorize URLs by page type
  const categorized = categorizeUrls(sitemapUrls)

  if (!JSON_OUTPUT) {
    console.log('\n📊 Pages by type:')
    for (const [typeName, pages] of categorized) {
      console.log(`   ${typeName}: ${pages.length} pages`)
    }
    console.log('')
  }

  // Sample and validate pages
  const results: ValidationResult[] = []
  let totalValidated = 0

  for (const [typeName, pages] of categorized) {
    const sampled = pages.slice(0, MAX_PER_TYPE)

    if (!JSON_OUTPUT) {
      console.log(`\n🔎 Validating ${typeName} pages (${sampled.length})...`)
    }

    for (const { url, pageType } of sampled) {
      totalValidated++
      const result = await validatePage(url, pageType)
      results.push(result)

      if (!JSON_OUTPUT) {
        const path = new URL(url).pathname
        const status = result.failed === 0 ? '✓' : '✗'
        const schemas = result.schemasFound.join(', ') || 'none'

        if (VERBOSE || result.failed > 0) {
          console.log(
            `   ${status} ${path} - Schemas: ${schemas} (${result.passed} passed, ${result.failed} failed)`
          )
          if (result.errors.length > 0) {
            for (const error of result.errors.slice(0, 5)) {
              console.log(`      ❌ ${error}`)
            }
            if (result.errors.length > 5) {
              console.log(`      ... and ${result.errors.length - 5} more`)
            }
          }
        } else {
          process.stdout.write('.')
        }
      }
    }

    if (!JSON_OUTPUT && !VERBOSE) {
      console.log('') // New line after dots
    }
  }

  // Calculate summary
  const totalPassed = results.reduce((sum, r) => sum + r.passed, 0)
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0)
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings, 0)
  const pagesPassed = results.filter((r) => r.failed === 0).length
  const pagesFailed = results.filter((r) => r.failed > 0).length

  return {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    pagesValidated: totalValidated,
    results,
    summary: {
      totalPassed,
      totalFailed,
      totalWarnings,
      pagesPassed,
      pagesFailed,
    },
  }
}

/**
 * Output results
 */
function outputResults(result: AuditResult): void {
  if (JSON_OUTPUT) {
    console.log(JSON.stringify(result, null, 2))
    return
  }

  console.log('\n' + '═'.repeat(60))
  console.log('📋 SCHEMA VALIDATION SUMMARY')
  console.log('═'.repeat(60))

  console.log(`\n📊 Pages Validated: ${result.pagesValidated}`)
  console.log(`   ✓ Passed: ${result.summary.pagesPassed}`)
  console.log(`   ✗ Failed: ${result.summary.pagesFailed}`)

  console.log(`\n📈 Tests:`)
  console.log(`   ✓ Passed: ${result.summary.totalPassed}`)
  console.log(`   ✗ Failed: ${result.summary.totalFailed}`)
  console.log(`   ⚠ Warnings: ${result.summary.totalWarnings}`)

  // Show failed pages
  const failedPages = result.results.filter((r) => r.failed > 0)
  if (failedPages.length > 0) {
    console.log('\n❌ Failed Pages:')
    for (const page of failedPages) {
      const path = new URL(page.url).pathname
      console.log(`\n   ${page.pageType}: ${path}`)
      console.log(`   Schemas found: ${page.schemasFound.join(', ') || 'none'}`)
      for (const error of page.errors.slice(0, 3)) {
        console.log(`   • ${error}`)
      }
      if (page.errors.length > 3) {
        console.log(`   ... and ${page.errors.length - 3} more errors`)
      }
    }
  }

  console.log('\n' + '═'.repeat(60))

  if (result.summary.totalFailed === 0) {
    console.log('✅ All schema validation tests passed!')
  } else {
    console.log('❌ Schema validation found errors that should be fixed.')
  }

  console.log('═'.repeat(60) + '\n')
}

// Run the validation
runValidation()
  .then((result) => {
    outputResults(result)
    // Exit with error code if any tests failed
    if (result.summary.totalFailed > 0) {
      process.exit(1)
    }
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
