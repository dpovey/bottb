#!/usr/bin/env tsx

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'
import { writeFile, mkdir, access } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import {
  parseScoringVersion,
  getCategories,
  getMaxJudgePoints,
  type ScoringCategory,
  type ScoringVersion,
} from '../lib/scoring'

config({ path: '.env.local' })

interface EventRow {
  id: string
  name: string
  location: string | null
  date: string | Date
  info: { scoring_version?: string; [k: string]: unknown } | null
}

interface BandRow {
  id: string
  name: string
  order: number
  company_name: string | null
}

interface CliOptions {
  eventId: string
  outDir: string
  htmlOnly: boolean
  pdfOnly: boolean
}

function parseArgs(argv: string[]): CliOptions {
  const args = argv.slice(2)
  const positional: string[] = []
  let outDir = 'scoring-sheets'
  let htmlOnly = false
  let pdfOnly = false

  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--out' || a === '-o') {
      outDir = args[++i]
    } else if (a === '--html-only') {
      htmlOnly = true
    } else if (a === '--pdf-only') {
      pdfOnly = true
    } else if (a === '--help' || a === '-h') {
      printHelp()
      process.exit(0)
    } else if (a.startsWith('-')) {
      console.error(`Unknown option: ${a}`)
      process.exit(1)
    } else {
      positional.push(a)
    }
  }

  if (positional.length !== 1) {
    printHelp()
    process.exit(1)
  }

  return { eventId: positional[0], outDir, htmlOnly, pdfOnly }
}

function printHelp(): void {
  console.log(`
Generate a printable judge scoring sheet for an event.

Usage:
  pnpm generate-scoring-sheet <eventId> [--out <dir>] [--html-only|--pdf-only]

Examples:
  pnpm generate-scoring-sheet melbourne-2026
  pnpm generate-scoring-sheet melbourne-2026 --out tmp/sheets
  pnpm generate-scoring-sheet melbourne-2026 --html-only
`)
}

async function fetchEvent(eventId: string): Promise<EventRow> {
  const { rows } = await sql<EventRow>`
    SELECT id, name, location, date, info
    FROM events
    WHERE id = ${eventId}
  `
  if (rows.length === 0) {
    throw new Error(`Event not found: ${eventId}`)
  }
  return rows[0]
}

async function fetchBands(eventId: string): Promise<BandRow[]> {
  const { rows } = await sql<BandRow>`
    SELECT b.id, b.name, b."order", c.name AS company_name
    FROM bands b
    LEFT JOIN companies c ON b.company_slug = c.slug
    WHERE b.event_id = ${eventId}
    ORDER BY b."order" ASC
  `
  return rows
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function renderHtml(params: {
  event: EventRow
  bands: BandRow[]
  judgeCategories: ScoringCategory[]
  maxJudgePoints: number
  scoringVersion: ScoringVersion
}): string {
  const { event, bands, judgeCategories, maxJudgePoints, scoringVersion } =
    params

  const eventTitle = escapeHtml(event.name)
  const colCount = judgeCategories.length + 2 // band + categories + total

  const criteriaCards = judgeCategories
    .map(
      (c) => `
        <div class="item">
          <strong>${escapeHtml(c.label)} &middot; /${c.maxPoints}</strong>
          ${escapeHtml(c.description)}
        </div>`
    )
    .join('')

  const headerCells = judgeCategories
    .map(
      (c) =>
        `<th class="center">${escapeHtml(c.label)}<br />/${c.maxPoints}</th>`
    )
    .join('')

  const bandRows = bands
    .map((band, idx) => {
      const company = band.company_name
        ? `<div class="company-name">(${escapeHtml(band.name)})</div>`
        : ''
      const displayPrimary = band.company_name
        ? escapeHtml(band.company_name)
        : escapeHtml(band.name)
      const scoreCells = judgeCategories
        .map(
          (c) => `
            <td class="score-cell">
              <span class="score-box"></span><span class="max">/${c.maxPoints}</span>
            </td>`
        )
        .join('')
      return `
          <tr>
            <td class="band-cell">
              <div class="band-num">${idx + 1}</div>
              <div class="band-name">${displayPrimary}</div>
              ${company}
            </td>
            ${scoreCells}
            <td class="score-cell total-cell">
              <span class="score-box"></span><span class="max">/${maxJudgePoints}</span>
            </td>
          </tr>
          <tr class="notes-row">
            <td colspan="${colCount}">
              <span class="notes-label">Notes:</span>
              <div class="lines"></div>
              <div class="lines"></div>
            </td>
          </tr>`
    })
    .join('')

  const judgeShare = maxJudgePoints
  const crowdShare = 100 - maxJudgePoints
  const footerNote =
    crowdShare > 0
      ? `Judge totals contribute ${judgeShare} of 100 final points; the crowd vote adds the remaining ${crowdShare}.`
      : `Judge totals contribute the full ${judgeShare} judge points.`

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${eventTitle} — Judge Scoring Sheet</title>
    <style>
      @page { size: A4 portrait; margin: 10mm; }
      * { box-sizing: border-box; }
      html, body {
        margin: 0; padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
        color: #111; font-size: 11pt;
      }
      .sheet { width: 190mm; margin: 0 auto; padding: 0; }
      header {
        display: flex; justify-content: space-between; align-items: flex-end;
        border-bottom: 2px solid #111; padding-bottom: 4mm; margin-bottom: 4mm;
      }
      h1 { font-size: 16pt; margin: 0; line-height: 1.1; }
      h1 .sub {
        display: block; font-size: 10pt; font-weight: 400;
        color: #444; margin-top: 1mm;
      }
      .judge-meta { font-size: 10pt; text-align: right; line-height: 1.6; }
      .judge-meta .field { display: inline-block; }
      .judge-meta .line {
        display: inline-block; border-bottom: 1px solid #111;
        min-width: 45mm; height: 5mm; vertical-align: bottom;
      }
      .criteria {
        display: grid; grid-template-columns: repeat(${judgeCategories.length}, 1fr);
        gap: 3mm; margin-bottom: 4mm; font-size: 9pt;
      }
      .criteria .item {
        border: 1px solid #ccc; border-radius: 2mm; padding: 2mm 3mm;
      }
      .criteria .item strong {
        display: block; font-size: 10pt; margin-bottom: 1mm;
      }
      table { width: 100%; border-collapse: collapse; font-size: 10pt; }
      thead th {
        text-align: left; background: #111; color: #fff; font-weight: 600;
        padding: 2mm 3mm; font-size: 10pt; border: 1px solid #111;
      }
      thead th.center { text-align: center; }
      tbody td { border: 1px solid #999; padding: 0; vertical-align: middle; }
      .band-cell { padding: 3mm; }
      .band-num { font-size: 11pt; font-weight: 700; color: #444; }
      .band-name {
        font-size: 12pt; font-weight: 700; line-height: 1.15; margin-top: 1mm;
      }
      .company-name { font-size: 9pt; color: #555; margin-top: 0.5mm; }
      .score-cell { text-align: center; height: 22mm; position: relative; }
      .score-box {
        display: inline-block; border: 1.5px solid #111;
        width: 18mm; height: 12mm; line-height: 12mm;
        font-size: 16pt; font-weight: 700;
      }
      .score-cell .max {
        display: block; font-size: 8pt; color: #555; margin-top: 1mm;
      }
      .total-cell { background: #f3f3f3; }
      .total-cell .score-box { border-width: 2px; width: 22mm; }
      .notes-row td {
        border-top: none; padding: 2mm 3mm 4mm; font-size: 9pt;
      }
      .notes-row .notes-label { font-style: italic; color: #555; }
      .notes-row .lines {
        margin-top: 1.5mm; border-top: 1px dotted #aaa; height: 4mm;
      }
      .notes-row .lines + .lines { margin-top: 0; }
      footer {
        margin-top: 4mm; font-size: 8.5pt; color: #555;
        display: flex; justify-content: space-between; align-items: flex-end;
        border-top: 1px solid #ccc; padding-top: 2mm;
      }
      footer .signature {
        display: flex; align-items: flex-end; gap: 3mm;
      }
      footer .signature .line {
        display: inline-block; border-bottom: 1px solid #111;
        width: 60mm; height: 5mm;
      }
      @media screen {
        body { background: #e5e5e5; padding: 12mm 0; }
        .sheet { background: #fff; padding: 10mm; box-shadow: 0 2px 12px rgba(0,0,0,0.15); }
      }
    </style>
  </head>
  <body>
    <div class="sheet">
      <header>
        <h1>
          ${eventTitle}
          <span class="sub">Judge Scoring Sheet &middot; Scoring v${escapeHtml(scoringVersion)}</span>
        </h1>
        <div class="judge-meta">
          <div><span class="field">Judge name:</span> <span class="line"></span></div>
        </div>
      </header>

      <section class="criteria" aria-label="Scoring criteria">
        ${criteriaCards}
      </section>

      <table>
        <thead>
          <tr>
            <th style="width: 28%">Band</th>
            ${headerCells}
            <th class="center">Total<br />/${maxJudgePoints}</th>
          </tr>
        </thead>
        <tbody>
          ${bandRows}
        </tbody>
      </table>

      <footer>
        <div>${footerNote}</div>
        <div class="signature"><span>Signature</span><span class="line"></span></div>
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
  for (const c of candidates) {
    if (await fileExists(c)) return c
  }
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
  const bands = await fetchBands(opts.eventId)

  if (bands.length === 0) {
    console.error(`❌ No bands found for event ${opts.eventId}`)
    process.exit(1)
  }

  const scoringVersion = parseScoringVersion(event.info)
  if (scoringVersion === '2022.1') {
    console.error(
      `❌ Event uses scoring version 2022.1 (single-winner only) — no judge sheet to generate.`
    )
    process.exit(1)
  }

  const judgeCategories = getCategories(scoringVersion).filter(
    (c) => c.type === 'judge'
  )
  const maxJudgePoints = getMaxJudgePoints(scoringVersion)

  const html = renderHtml({
    event,
    bands,
    judgeCategories,
    maxJudgePoints,
    scoringVersion,
  })

  await mkdir(opts.outDir, { recursive: true })

  const baseName = `${slugify(event.id)}-scoring-sheet`
  const htmlPath = path.resolve(opts.outDir, `${baseName}.html`)
  const pdfPath = path.resolve(opts.outDir, `${baseName}.pdf`)

  if (!opts.pdfOnly) {
    await writeFile(htmlPath, html, 'utf8')
    console.log(`📝 HTML  → ${path.relative(process.cwd(), htmlPath)}`)
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

  console.log(
    `\n✅ Generated scoring sheet for "${event.name}" (${bands.length} bands, scoring v${scoringVersion}).`
  )
}

main().catch((err) => {
  console.error('❌ Error:', err instanceof Error ? err.message : err)
  process.exit(1)
})
