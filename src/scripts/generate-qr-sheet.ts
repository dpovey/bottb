#!/usr/bin/env tsx

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'
import * as QRCode from 'qrcode'
import { writeFile, mkdir, access } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'

config({ path: '.env.local' })

const DEFAULT_BASE_URL = 'https://www.battleofthetechbands.com'

interface EventRow {
  id: string
  name: string
  location: string | null
  date: string | Date
  timezone: string | null
}

type Audience = 'crowd' | 'judge'

interface CliOptions {
  eventId: string
  outDir: string
  baseUrl: string
  audiences: Audience[]
  htmlOnly: boolean
  pdfOnly: boolean
}

function parseArgs(argv: string[]): CliOptions {
  const args = argv.slice(2)
  const positional: string[] = []
  let outDir = 'scoring-sheets'
  let baseUrl = process.env.QR_BASE_URL || DEFAULT_BASE_URL
  let audiences: Audience[] = ['crowd', 'judge']
  let htmlOnly = false
  let pdfOnly = false

  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--out' || a === '-o') outDir = args[++i]
    else if (a === '--base-url' || a === '-u') baseUrl = args[++i]
    else if (a === '--crowd-only') audiences = ['crowd']
    else if (a === '--judge-only') audiences = ['judge']
    else if (a === '--html-only') htmlOnly = true
    else if (a === '--pdf-only') pdfOnly = true
    else if (a === '--help' || a === '-h') {
      printHelp()
      process.exit(0)
    } else if (a.startsWith('-')) {
      console.error(`Unknown option: ${a}`)
      process.exit(1)
    } else positional.push(a)
  }

  if (positional.length !== 1) {
    printHelp()
    process.exit(1)
  }

  return {
    eventId: positional[0],
    outDir,
    baseUrl: baseUrl.replace(/\/$/, ''),
    audiences,
    htmlOnly,
    pdfOnly,
  }
}

function printHelp(): void {
  console.log(`
Generate printable voting-QR PDFs for an event (crowd + judge).

Usage:
  pnpm generate-qr-sheet <eventId> [options]

Options:
  --base-url <url>   Override base URL (default: ${DEFAULT_BASE_URL})
  --crowd-only       Only generate the crowd voting QR
  --judge-only       Only generate the judge voting QR
  --out <dir>        Output directory (default: scoring-sheets)
  --html-only        Skip PDF generation
  --pdf-only         Skip writing the intermediate HTML

Examples:
  pnpm generate-qr-sheet melbourne-2026
  pnpm generate-qr-sheet melbourne-2026 --crowd-only
  pnpm generate-qr-sheet melbourne-2026 --base-url https://staging.example.com
`)
}

async function fetchEvent(eventId: string): Promise<EventRow> {
  const { rows } = await sql<EventRow>`
    SELECT id, name, location, date, timezone
    FROM events
    WHERE id = ${eventId}
  `
  if (rows.length === 0) throw new Error(`Event not found: ${eventId}`)
  return rows[0]
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatEventDate(date: string | Date, timezone: string | null): string {
  const d = typeof date === 'string' ? new Date(date) : date
  try {
    return new Intl.DateTimeFormat('en-AU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: timezone || 'Australia/Melbourne',
    }).format(d)
  } catch {
    return d.toDateString()
  }
}

interface SheetConfig {
  audience: Audience
  title: string
  subtitle: string
  url: string
  instructions: string[]
}

function buildConfig(
  audience: Audience,
  eventId: string,
  baseUrl: string
): SheetConfig {
  if (audience === 'crowd') {
    return {
      audience,
      title: 'Crowd Voting',
      subtitle: 'Scan to vote for your favourite band',
      url: `${baseUrl}/vote/crowd/${eventId}`,
      instructions: [
        'Scan the QR code with your phone camera',
        'Select your favourite band from the list',
        'Submit your vote',
        'One vote per person — make it count!',
      ],
    }
  }
  return {
    audience,
    title: 'Judge Scoring',
    subtitle: 'Scan to enter your judge scores',
    url: `${baseUrl}/vote/judge/${eventId}`,
    instructions: [
      'Scan the QR code with your phone camera',
      'Enter your name',
      'Score each band on the four judging criteria',
      'Submit all scores in one go',
    ],
  }
}

async function renderHtml(event: EventRow, cfg: SheetConfig): Promise<string> {
  const qrDataUrl = await QRCode.toDataURL(cfg.url, {
    width: 800,
    margin: 1,
    errorCorrectionLevel: 'H',
    color: { dark: '#000000', light: '#FFFFFF' },
  })

  const dateLine = formatEventDate(event.date, event.timezone)
  const steps = cfg.instructions
    .map(
      (s, i) =>
        `<li><span class="num">${i + 1}</span><span class="text">${escapeHtml(s)}</span></li>`
    )
    .join('')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(event.name)} — ${escapeHtml(cfg.title)}</title>
    <style>
      @page { size: A4 portrait; margin: 12mm; }
      * { box-sizing: border-box; }
      html, body {
        margin: 0; padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
        color: #111; font-size: 12pt;
      }
      .sheet { width: 186mm; margin: 0 auto; display: flex; flex-direction: column; }
      header {
        text-align: center; padding-bottom: 6mm; border-bottom: 2px solid #111;
        margin-bottom: 8mm;
      }
      header h1 { font-size: 28pt; margin: 0 0 2mm; line-height: 1.05; }
      header .meta { font-size: 12pt; color: #444; margin-top: 2mm; }
      header .meta span + span::before { content: ' \\00b7 '; color: #999; }

      .card-title { font-size: 22pt; font-weight: 700; margin: 0 0 1mm; }
      .card-sub { font-size: 13pt; color: #555; margin: 0 0 6mm; }

      .qr-wrap {
        text-align: center; padding: 6mm;
        border: 2px solid #111; border-radius: 3mm;
        margin: 0 auto 8mm; width: 130mm;
      }
      .qr-wrap img { width: 120mm; height: 120mm; display: block; margin: 0 auto; }
      .qr-url {
        margin-top: 4mm; font-family: ui-monospace, Menlo, monospace;
        font-size: 9pt; color: #333; word-break: break-all;
      }

      .body {
        display: grid; grid-template-columns: 1fr 1fr; gap: 8mm;
        align-items: start;
      }
      .body .left { text-align: center; }

      .steps { list-style: none; padding: 0; margin: 0; }
      .steps li {
        display: flex; align-items: flex-start; gap: 4mm;
        margin-bottom: 4mm; font-size: 12pt; line-height: 1.35;
      }
      .steps .num {
        flex: 0 0 9mm; height: 9mm; width: 9mm;
        border-radius: 50%; background: #111; color: #fff;
        display: inline-flex; align-items: center; justify-content: center;
        font-weight: 700; font-size: 11pt;
      }
      .steps .text { padding-top: 1mm; }

      .panel-title { font-size: 16pt; font-weight: 700; margin: 0 0 4mm; }

      footer {
        margin-top: auto; padding-top: 6mm; border-top: 1px solid #ccc;
        font-size: 9pt; color: #666; display: flex; justify-content: space-between;
      }

      @media screen {
        body { background: #e5e5e5; padding: 12mm 0; }
        .sheet { background: #fff; padding: 12mm; box-shadow: 0 2px 12px rgba(0,0,0,0.15); min-height: 270mm; }
      }
    </style>
  </head>
  <body>
    <div class="sheet">
      <header>
        <h1>${escapeHtml(event.name)}</h1>
        <div class="meta">
          ${event.location ? `<span>${escapeHtml(event.location)}</span>` : ''}
          <span>${escapeHtml(dateLine)}</span>
        </div>
      </header>

      <div class="body">
        <div class="left">
          <div class="card-title">${escapeHtml(cfg.title)}</div>
          <div class="card-sub">${escapeHtml(cfg.subtitle)}</div>
          <div class="qr-wrap">
            <img src="${qrDataUrl}" alt="${escapeHtml(cfg.title)} QR code" />
            <div class="qr-url">${escapeHtml(cfg.url)}</div>
          </div>
        </div>
        <div class="right">
          <div class="panel-title">How to ${cfg.audience === 'crowd' ? 'vote' : 'score'}</div>
          <ol class="steps">${steps}</ol>
        </div>
      </div>

      <footer>
        <div>${escapeHtml(event.name)} &middot; ${escapeHtml(cfg.audience === 'crowd' ? 'Crowd voting' : 'Judge scoring')}</div>
        <div>battleofthetechbands.com</div>
      </footer>
    </div>
  </body>
</html>
`
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

async function findChromeBinary(): Promise<string | null> {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ]
  for (const c of candidates) if (await fileExists(c)) return c
  return null
}

async function renderPdf(htmlPath: string, pdfPath: string): Promise<void> {
  const chrome = await findChromeBinary()
  if (!chrome) {
    console.warn(
      '⚠️  No Chrome/Chromium binary found — skipping PDF generation.'
    )
    return
  }
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(
      chrome,
      [
        '--headless',
        '--disable-gpu',
        '--no-pdf-header-footer',
        `--print-to-pdf=${pdfPath}`,
        `file://${htmlPath}`,
      ],
      { stdio: 'ignore' }
    )
    proc.on('error', reject)
    proc.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Chrome exited with code ${code}`))
    })
  })
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv)
  const event = await fetchEvent(opts.eventId)
  await mkdir(opts.outDir, { recursive: true })

  for (const audience of opts.audiences) {
    const cfg = buildConfig(audience, opts.eventId, opts.baseUrl)
    const html = await renderHtml(event, cfg)
    const baseName = `${opts.eventId}-${audience}-qr`
    const htmlPath = path.resolve(opts.outDir, `${baseName}.html`)
    const pdfPath = path.resolve(opts.outDir, `${baseName}.pdf`)

    if (!opts.pdfOnly) {
      await writeFile(htmlPath, html, 'utf8')
      console.log(
        `📝 HTML  → ${path.relative(process.cwd(), htmlPath)} (${cfg.url})`
      )
    }

    if (!opts.htmlOnly) {
      if (opts.pdfOnly && !(await fileExists(htmlPath))) {
        await writeFile(htmlPath, html, 'utf8')
      }
      await renderPdf(htmlPath, pdfPath)
      if (await fileExists(pdfPath)) {
        console.log(`📄 PDF   → ${path.relative(process.cwd(), pdfPath)}`)
      }
    }
  }

  console.log(
    `\n✅ Generated ${opts.audiences.length} QR sheet(s) for "${event.name}" → ${opts.baseUrl}`
  )
}

main().catch((err) => {
  console.error('❌ Error:', err instanceof Error ? err.message : err)
  process.exit(1)
})
