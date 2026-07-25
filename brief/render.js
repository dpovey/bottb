// Renders the videographer brief HTML to BOTTB-Videographer-Brief.pdf (repo root).
// Usage (from repo root):  node brief/render.js
// Requires the repo's dev deps (Playwright + its Chromium) to be installed.
const { chromium } = require('playwright')
const path = require('path')

;(async () => {
  const src = process.argv[2] || path.join(__dirname, 'videographer.html')
  const out =
    process.argv[3] ||
    path.join(__dirname, '..', 'BOTTB-Videographer-Brief.pdf')
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.emulateMedia({ media: 'print' })
  await page.goto('file://' + src, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.pdf({
    path: out,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  })
  await browser.close()
  console.log('wrote', out)
})()
