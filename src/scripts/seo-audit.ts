/**
 * SEO Audit Script
 *
 * Validates SEO across all public pages in the sitemap.
 * Run: pnpm seo:audit [options]
 *
 * Options:
 *   --url=<base-url>    Base URL to audit (default: http://localhost:3030)
 *   --json              Output results as JSON
 *   --verbose           Show detailed output for each page
 *   --max=<n>           Max pages to audit (for testing)
 *
 * Checks:
 *   - HTTP status (must be 200)
 *   - Page title (unique, under 60 chars, ends with site name)
 *   - Meta description (50-160 chars)
 *   - Canonical URL
 *   - OpenGraph tags (og:title, og:description)
 *   - H1 tag (exactly one)
 */

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
const MAX_PAGES = parseInt(getArg('max', '0'), 10) || Infinity

// SEO validation thresholds
const TITLE_MAX_LENGTH = 60
const TITLE_WARN_LENGTH = 55
const DESC_MIN_LENGTH = 50
const DESC_MAX_LENGTH = 160
const DESC_OPTIMAL_MIN = 120
const DESC_OPTIMAL_MAX = 155
const SITE_NAME = 'Battle of the Tech Bands'

interface SitemapUrl {
  loc: string
  lastmod?: string
  changefreq?: string
  priority?: number
}

interface PageSEOData {
  url: string
  status: number
  title: string | null
  description: string | null
  canonical: string | null
  ogTitle: string | null
  ogDescription: string | null
  ogImage: string | null
  h1Count: number
  h1Text: string | null
}

interface SEOIssue {
  url: string
  severity: 'error' | 'warning' | 'info'
  type: string
  message: string
  value?: string | number
}

interface AuditResult {
  timestamp: string
  baseUrl: string
  pagesAudited: number
  issues: SEOIssue[]
  duplicateTitles: { title: string; urls: string[] }[]
  summary: {
    errors: number
    warnings: number
    info: number
    pagesWithIssues: number
    pagesWithoutIssues: number
  }
}

/**
 * Fetch and parse the sitemap
 * Rewrites URLs to use the target baseUrl (sitemap may contain different host/port)
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

  // Handle sitemap structure
  const urlset = result.urlset?.url || []
  const urls: SitemapUrl[] = Array.isArray(urlset) ? urlset : [urlset]

  // Rewrite URLs to use our target baseUrl
  // (sitemap may contain production URLs or different port)
  return urls.map((u) => {
    const originalUrl = new URL(u.loc)
    const targetUrl = new URL(baseUrl)
    // Replace origin (protocol + host + port) but keep the path
    const rewrittenUrl = `${targetUrl.origin}${originalUrl.pathname}`

    return {
      loc: rewrittenUrl,
      lastmod: u.lastmod,
      changefreq: u.changefreq,
      priority: u.priority
        ? typeof u.priority === 'number'
          ? u.priority
          : parseFloat(u.priority)
        : undefined,
    }
  })
}

/**
 * Extract SEO data from HTML
 */
function extractSEOData(
  html: string,
  url: string,
  status: number
): PageSEOData {
  const getMetaContent = (name: string): string | null => {
    // Try both name and property attributes
    const nameMatch = html.match(
      new RegExp(
        `<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']+)["']`,
        'i'
      )
    )
    const propMatch = html.match(
      new RegExp(
        `<meta[^>]*property=["']${name}["'][^>]*content=["']([^"']+)["']`,
        'i'
      )
    )
    // Also try reverse order (content before name/property)
    const nameMatchRev = html.match(
      new RegExp(
        `<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${name}["']`,
        'i'
      )
    )
    const propMatchRev = html.match(
      new RegExp(
        `<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${name}["']`,
        'i'
      )
    )
    return (
      nameMatch?.[1] ||
      propMatch?.[1] ||
      nameMatchRev?.[1] ||
      propMatchRev?.[1] ||
      null
    )
  }

  const getTitle = (): string | null => {
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    return match?.[1]?.trim() || null
  }

  const getCanonical = (): string | null => {
    const match = html.match(
      /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i
    )
    const matchRev = html.match(
      /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i
    )
    return match?.[1] || matchRev?.[1] || null
  }

  const getH1Info = (): { count: number; text: string | null } => {
    // Match H1 tags including those with nested elements (br, span, etc.)
    // Use a simpler approach: find all H1 opening tags and closing tags
    const openTags = html.match(/<h1[^>]*>/gi) || []
    const closeTags = html.match(/<\/h1>/gi) || []
    // Count is minimum of open/close tags (properly nested H1s)
    const count = Math.min(openTags.length, closeTags.length)

    // Extract first H1 content for display
    let text: string | null = null
    if (count > 0) {
      // Find content between first <h1...> and </h1>
      const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
      if (h1Match) {
        // Strip HTML tags and normalize whitespace
        text = h1Match[1]
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      }
    }
    return { count, text }
  }

  const h1Info = getH1Info()

  return {
    url,
    status,
    title: getTitle(),
    description: getMetaContent('description'),
    canonical: getCanonical(),
    ogTitle: getMetaContent('og:title'),
    ogDescription: getMetaContent('og:description'),
    ogImage: getMetaContent('og:image'),
    h1Count: h1Info.count,
    h1Text: h1Info.text,
  }
}

/**
 * Validate SEO data and return issues
 */
function validateSEO(data: PageSEOData): SEOIssue[] {
  const issues: SEOIssue[] = []
  const { url } = data

  // Status check
  if (data.status !== 200) {
    issues.push({
      url,
      severity: 'error',
      type: 'http_status',
      message: `HTTP status ${data.status}`,
      value: data.status,
    })
    return issues // Don't continue if page is not accessible
  }

  // Title checks
  if (!data.title) {
    issues.push({
      url,
      severity: 'error',
      type: 'missing_title',
      message: 'Missing page title',
    })
  } else {
    if (data.title.length > TITLE_MAX_LENGTH) {
      issues.push({
        url,
        severity: 'warning',
        type: 'title_too_long',
        message: `Title exceeds ${TITLE_MAX_LENGTH} chars (${data.title.length})`,
        value: data.title.length,
      })
    } else if (data.title.length > TITLE_WARN_LENGTH) {
      issues.push({
        url,
        severity: 'info',
        type: 'title_near_limit',
        message: `Title approaching limit (${data.title.length}/${TITLE_MAX_LENGTH} chars)`,
        value: data.title.length,
      })
    }

    if (!data.title.includes(SITE_NAME)) {
      issues.push({
        url,
        severity: 'warning',
        type: 'title_missing_site_name',
        message: `Title should include "${SITE_NAME}"`,
        value: data.title,
      })
    }
  }

  // Description checks
  if (!data.description) {
    issues.push({
      url,
      severity: 'error',
      type: 'missing_description',
      message: 'Missing meta description',
    })
  } else {
    if (data.description.length < DESC_MIN_LENGTH) {
      issues.push({
        url,
        severity: 'warning',
        type: 'description_too_short',
        message: `Description too short (${data.description.length} chars, minimum ${DESC_MIN_LENGTH})`,
        value: data.description.length,
      })
    } else if (data.description.length > DESC_MAX_LENGTH) {
      issues.push({
        url,
        severity: 'warning',
        type: 'description_too_long',
        message: `Description too long (${data.description.length} chars, max ${DESC_MAX_LENGTH})`,
        value: data.description.length,
      })
    } else if (
      data.description.length < DESC_OPTIMAL_MIN ||
      data.description.length > DESC_OPTIMAL_MAX
    ) {
      issues.push({
        url,
        severity: 'info',
        type: 'description_suboptimal',
        message: `Description length ${data.description.length} chars (optimal: ${DESC_OPTIMAL_MIN}-${DESC_OPTIMAL_MAX})`,
        value: data.description.length,
      })
    }
  }

  // Canonical check
  if (!data.canonical) {
    issues.push({
      url,
      severity: 'warning',
      type: 'missing_canonical',
      message: 'Missing canonical URL',
    })
  }

  // OpenGraph checks
  if (!data.ogTitle) {
    issues.push({
      url,
      severity: 'warning',
      type: 'missing_og_title',
      message: 'Missing og:title',
    })
  }

  if (!data.ogDescription) {
    issues.push({
      url,
      severity: 'warning',
      type: 'missing_og_description',
      message: 'Missing og:description',
    })
  }

  // H1 check
  if (data.h1Count === 0) {
    issues.push({
      url,
      severity: 'warning',
      type: 'missing_h1',
      message: 'Missing H1 tag',
    })
  } else if (data.h1Count > 1) {
    issues.push({
      url,
      severity: 'warning',
      type: 'multiple_h1',
      message: `Multiple H1 tags found (${data.h1Count})`,
      value: data.h1Count,
    })
  }

  return issues
}

/**
 * Audit a single page
 */
async function auditPage(
  url: string
): Promise<{ data: PageSEOData; issues: SEOIssue[] }> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'BOTTB-SEO-Audit/1.0',
      },
    })
    const html = await response.text()
    const data = extractSEOData(html, url, response.status)
    const issues = validateSEO(data)
    return { data, issues }
  } catch (error) {
    return {
      data: {
        url,
        status: 0,
        title: null,
        description: null,
        canonical: null,
        ogTitle: null,
        ogDescription: null,
        ogImage: null,
        h1Count: 0,
        h1Text: null,
      },
      issues: [
        {
          url,
          severity: 'error',
          type: 'fetch_error',
          message: `Failed to fetch: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
    }
  }
}

/**
 * Find duplicate titles
 */
function findDuplicateTitles(
  pages: PageSEOData[]
): { title: string; urls: string[] }[] {
  const titleMap = new Map<string, string[]>()

  for (const page of pages) {
    if (page.title) {
      const urls = titleMap.get(page.title) || []
      urls.push(page.url)
      titleMap.set(page.title, urls)
    }
  }

  return Array.from(titleMap.entries())
    .filter(([, urls]) => urls.length > 1)
    .map(([title, urls]) => ({ title, urls }))
}

/**
 * Format issues for console output
 */
function formatIssue(issue: SEOIssue): string {
  const icon =
    issue.severity === 'error'
      ? '❌'
      : issue.severity === 'warning'
        ? '⚠️ '
        : 'ℹ️ '
  const path = new URL(issue.url).pathname
  return `${icon} ${path}: ${issue.message}`
}

/**
 * Main audit function
 */
async function runAudit(): Promise<AuditResult> {
  if (!JSON_OUTPUT) {
    console.log('🔍 SEO Audit Starting...\n')
    console.log(`   Base URL: ${BASE_URL}`)
    console.log(`   Verbose: ${VERBOSE}`)
    console.log(
      `   Max pages: ${MAX_PAGES === Infinity ? 'unlimited' : MAX_PAGES}`
    )
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
    console.log(`   Found ${sitemapUrls.length} URLs`)
  }

  // Limit pages if specified
  const urlsToAudit = sitemapUrls.slice(0, MAX_PAGES)

  if (!JSON_OUTPUT) {
    console.log(`\n📊 Auditing ${urlsToAudit.length} pages...\n`)
  }

  // Audit each page
  const allIssues: SEOIssue[] = []
  const allPageData: PageSEOData[] = []
  let completed = 0

  for (const sitemapUrl of urlsToAudit) {
    const { data, issues } = await auditPage(sitemapUrl.loc)
    allPageData.push(data)
    allIssues.push(...issues)
    completed++

    if (!JSON_OUTPUT) {
      const path = new URL(sitemapUrl.loc).pathname
      const status = data.status === 200 ? '✓' : '✗'
      const issueCount = issues.length

      if (VERBOSE) {
        console.log(`[${completed}/${urlsToAudit.length}] ${status} ${path}`)
        if (issueCount > 0) {
          for (const issue of issues) {
            console.log(`   ${formatIssue(issue)}`)
          }
        }
        console.log(`   Title: ${data.title || '(none)'}`)
        console.log(`   Desc: ${data.description?.slice(0, 60) || '(none)'}...`)
        console.log('')
      } else {
        // Progress indicator
        process.stdout.write(
          `\r   Progress: ${completed}/${urlsToAudit.length} (${issueCount} issues found)`
        )
      }
    }
  }

  if (!JSON_OUTPUT && !VERBOSE) {
    console.log('') // New line after progress
  }

  // Find duplicate titles
  const duplicateTitles = findDuplicateTitles(allPageData)
  for (const dup of duplicateTitles) {
    for (const url of dup.urls) {
      allIssues.push({
        url,
        severity: 'error',
        type: 'duplicate_title',
        message: `Duplicate title: "${dup.title}" (shared with ${dup.urls.length - 1} other page(s))`,
        value: dup.title,
      })
    }
  }

  // Calculate summary
  const errors = allIssues.filter((i) => i.severity === 'error').length
  const warnings = allIssues.filter((i) => i.severity === 'warning').length
  const info = allIssues.filter((i) => i.severity === 'info').length
  const pagesWithIssues = new Set(allIssues.map((i) => i.url)).size
  const pagesWithoutIssues = urlsToAudit.length - pagesWithIssues

  const result: AuditResult = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    pagesAudited: urlsToAudit.length,
    issues: allIssues,
    duplicateTitles,
    summary: {
      errors,
      warnings,
      info,
      pagesWithIssues,
      pagesWithoutIssues,
    },
  }

  return result
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
  console.log('📋 SEO AUDIT SUMMARY')
  console.log('═'.repeat(60))

  console.log(`\n📊 Pages Audited: ${result.pagesAudited}`)
  console.log(`   ✓ Without issues: ${result.summary.pagesWithoutIssues}`)
  console.log(`   ✗ With issues: ${result.summary.pagesWithIssues}`)

  console.log(`\n📈 Issues Found:`)
  console.log(`   ❌ Errors: ${result.summary.errors}`)
  console.log(`   ⚠️  Warnings: ${result.summary.warnings}`)
  console.log(`   ℹ️  Info: ${result.summary.info}`)

  if (result.duplicateTitles.length > 0) {
    console.log(`\n🔄 Duplicate Titles: ${result.duplicateTitles.length}`)
    for (const dup of result.duplicateTitles) {
      console.log(
        `   • "${dup.title.slice(0, 50)}..." (${dup.urls.length} pages)`
      )
    }
  }

  // Group errors by type
  if (result.summary.errors > 0 || result.summary.warnings > 0) {
    const issuesByType = new Map<string, SEOIssue[]>()
    for (const issue of result.issues.filter((i) => i.severity !== 'info')) {
      const issues = issuesByType.get(issue.type) || []
      issues.push(issue)
      issuesByType.set(issue.type, issues)
    }

    console.log('\n📝 Issues by Type:')
    for (const [type, issues] of issuesByType) {
      const severity = issues[0].severity
      const icon = severity === 'error' ? '❌' : '⚠️ '
      console.log(`\n${icon} ${type} (${issues.length}):`)
      for (const issue of issues.slice(0, 5)) {
        const path = new URL(issue.url).pathname
        console.log(`   • ${path}: ${issue.message}`)
      }
      if (issues.length > 5) {
        console.log(`   ... and ${issues.length - 5} more`)
      }
    }
  }

  console.log('\n' + '═'.repeat(60))

  if (result.summary.errors === 0 && result.summary.warnings === 0) {
    console.log('✅ All pages pass SEO checks!')
  } else if (result.summary.errors === 0) {
    console.log('⚠️  SEO audit completed with warnings.')
  } else {
    console.log('❌ SEO audit found errors that should be fixed.')
  }

  console.log('═'.repeat(60) + '\n')
}

// Run the audit
runAudit()
  .then(outputResults)
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
