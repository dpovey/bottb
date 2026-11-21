// Offline tests for browser/attach-pieces.js and browser/linkedin-caption.js in jsdom (no site, no T3 browser).
// Run from the repo root after pnpm install:  node doc/production/scripts/tests/test_browser_snippets.cjs
// (a worktree without node_modules can borrow the main checkout's: NODE_PATH=~/src/personal/bottb/node_modules)
// They prove the snippets' own logic. Uploading through preview_act and the live LinkedIn/YouTube/TikTok DOM need a live check.
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const assert = require('assert')
const { JSDOM } = require('jsdom')

const DIR = path.join(__dirname, '..', 'browser')
let pass = 0
const tests = []
const test = (name, fn) => tests.push([name, fn])

function page(html = '<body></body>') {
  const dom = new JSDOM(`<!doctype html>${html}`, {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  })
  const w = dom.window
  // jsdom has no DataTransfer, and its File/Blob lack arrayBuffer in some versions: supply what the snippet uses.
  w.crypto.subtle ||
    Object.defineProperty(w.crypto, 'subtle', {
      value: crypto.webcrypto.subtle,
    })
  if (!w.File.prototype.arrayBuffer) {
    w.Blob.prototype.arrayBuffer = function () {
      return new Promise((res) => {
        const r = new w.FileReader()
        r.onload = () => res(r.result)
        r.readAsArrayBuffer(this)
      })
    }
  }
  w.DataTransfer = class {
    constructor() {
      const list = []
      this.items = { add: (f) => list.push(f) }
      this.files = list
    }
  }
  return w
}
const load = (w, f) => w.eval(fs.readFileSync(path.join(DIR, f), 'utf8'))

test('attach: pieces rebuild in name order, hash checked, injected with change', async () => {
  const w = page('<body><input type="file" name="Filedata" id="site"></body>')
  assert.match(load(w, 'attach-pieces.js'), /attach-pieces/)
  const A = w.bottbAttach
  A.install()
  assert.ok(w.document.getElementById('bottb-part'))
  const data = crypto.randomBytes(2000)
  const sha = crypto.createHash('sha256').update(data).digest('hex')
  // simulate preview_act upload out of order: ab arrives before aa
  A.parts.push(new w.File([data.subarray(1000)], 'part_ab'))
  A.parts.push(new w.File([data.subarray(0, 1000)], 'part_aa'))
  const h = (b) => crypto.createHash('sha256').update(b).digest('hex')
  const perPiece = await A.rebuild('song.mp4', [
    h(data.subarray(0, 1000)),
    h(data.subarray(1000)),
  ])
  assert.strictEqual(perPiece.ok, true)
  await assert.rejects(
    A.rebuild('song.mp4', [h(data.subarray(1000)), h(data.subarray(0, 1000))]),
    /piece part_aa sha256 mismatch/
  )
  await assert.rejects(
    A.rebuild('song.mp4', [h(data)]),
    /2 pieces uploaded, 1 expected/
  )
  const r = await A.rebuild('song.mp4', sha)
  assert.strictEqual(r.ok, true)
  assert.strictEqual(r.size, data.length)
  let changed = 0
  const site = w.document.getElementById('site')
  Object.defineProperty(site, 'files', {
    set(v) {
      this._f = v
    },
    get() {
      return this._f || []
    },
  })
  site.addEventListener('change', () => changed++)
  w.document.body.addEventListener('change', () => changed++) // bubbles
  const inj = A.inject('#site')
  assert.strictEqual(inj.files, 1)
  assert.strictEqual(changed, 2)
})

test('attach: a wrong hash or a duplicate piece refuses', async () => {
  const w = page()
  load(w, 'attach-pieces.js')
  const A = w.bottbAttach
  A.parts.push(new w.File(['abc'], 'part_aa'))
  await assert.rejects(A.rebuild('x.mp4', '00'), /sha256 mismatch/)
  assert.throws(() => A.inject('#nope'), /rebuild/)
  A.parts.push(new w.File(['abc'], 'part_aa'))
  await assert.rejects(A.rebuild('x.mp4', '00'), /twice/)
  await assert.rejects(A.rebuild('x.mp4'), /expected hashes/)
  assert.strictEqual(A.reset().parts, 0)
})

test('attach: hookClick captures a file input instead of opening a picker', () => {
  const w = page()
  load(w, 'attach-pieces.js')
  const A = w.bottbAttach
  A.hookClick()
  const i = w.document.createElement('input')
  i.type = 'file'
  i.click()
  assert.strictEqual(A.captured.length, 1)
  let clicked = 0
  const b = w.document.createElement('input')
  b.type = 'checkbox'
  b.addEventListener('click', () => clicked++)
  b.click()
  assert.strictEqual(clicked, 1, 'other inputs still click')
  A.unhook()
})

const CAPTION =
  'Amakazaam! from @{Amazon|Amazon} play You Oughta Know.\n\nThanks @{Jumbo|Jumbo Interactive Limited|urn:li:organization:1} and @{Youngcare|Youngcare}.'

test('linkedin: plan splits text, paragraph breaks and short-query mentions', () => {
  const w = page()
  load(w, 'linkedin-caption.js')
  const s = JSON.parse(JSON.stringify(w.bottbLinkedIn.plan(CAPTION)))
  assert.deepStrictEqual(s, [
    { kind: 'text', text: 'Amakazaam! from ' },
    { kind: 'mention', type: '@Amazon', name: 'Amazon', urn: null },
    { kind: 'text', text: ' play You Oughta Know.' },
    { kind: 'enter', count: 2 },
    { kind: 'text', text: 'Thanks ' },
    {
      kind: 'mention',
      type: '@Jumbo',
      name: 'Jumbo Interactive Limited',
      urn: 'urn:li:organization:1',
    },
    { kind: 'text', text: ' and ' },
    { kind: 'mention', type: '@Youngcare', name: 'Youngcare', urn: null },
    { kind: 'text', text: '.' },
  ])
})

const chip = (name, urn) => `<a data-entity-urn="${urn}">${name}</a>`
const composer = (p1, p2) =>
  `<body><div role="dialog"><div class="ql-editor" contenteditable="true">${p1}<p><br></p>${p2}</div></div></body>`

test('linkedin: check passes a correct caption and puts the caret at the end', () => {
  const w = page(
    composer(
      `<p>Amakazaam! from ${chip('Amazon', 'urn:a')} play You Oughta Know.</p>`,
      `<p>Thanks ${chip('Jumbo Interactive Limited', 'urn:li:organization:1')} and ${chip('Youngcare', 'urn:y')}.</p>`
    )
  )
  load(w, 'linkedin-caption.js')
  const r = w.bottbLinkedIn.check(CAPTION)
  assert.deepStrictEqual(Array.from(r.problems), [])
  assert.strictEqual(r.ok, true)
  assert.match(w.bottbLinkedIn.caretToEnd().caretIn, /Youngcare\.$/)
  const sel = w.getSelection().getRangeAt(0)
  assert.strictEqual(sel.collapsed, true)
})

test('linkedin: plain-text sponsor, wrong urn and a split paragraph are caught', () => {
  const w = page(
    composer(
      `<p>Amakazaam! from ${chip('Amazon', 'urn:a')} play You </p><p>Oughta Know.</p>`,
      `<p>Thanks Jumbo Interactive Limited and ${chip('Youngcare', 'urn:y')}.</p>`
    )
  )
  load(w, 'linkedin-caption.js')
  const r = w.bottbLinkedIn.check(CAPTION)
  assert.strictEqual(r.ok, false)
  const all = r.problems.join('\n')
  assert.match(all, /no chip for Jumbo Interactive Limited/)
  assert.match(all, /paragraphs: 4, expected 3/)
  const w2 = page(
    composer(
      `<p>Amakazaam! from ${chip('Amazon', 'urn:a')} play You Oughta Know.</p>`,
      `<p>Thanks ${chip('Jumbo Interactive Limited', 'urn:li:organization:9')} and ${chip('Youngcare', 'urn:y')}.</p>`
    )
  )
  load(w2, 'linkedin-caption.js')
  assert.match(
    w2.bottbLinkedIn.check(CAPTION).problems.join(),
    /urn:li:organization:9, expected urn:li:organization:1/
  )
})

test('linkedin: selected() reads the highlighted option', () => {
  const w = page(
    '<body><div role="listbox"><div role="option" aria-selected="false">Jumbo Supermarkten</div>' +
      '<div role="option" aria-selected="true" data-entity-urn="urn:li:organization:1">Jumbo Interactive Limited</div></div></body>'
  )
  load(w, 'linkedin-caption.js')
  assert.deepStrictEqual(
    { ...w.bottbLinkedIn.selected() },
    { text: 'Jumbo Interactive Limited', urn: 'urn:li:organization:1' }
  )
})
;(async () => {
  for (const [name, fn] of tests) {
    try {
      await fn()
      pass++
      console.log('ok   ' + name)
    } catch (e) {
      console.log(
        'FAIL ' +
          name +
          '\n     ' +
          String((e && e.stack) || e)
            .split('\n')
            .slice(0, 4)
            .join('\n     ')
      )
    }
  }
  console.log(`${pass} passed, ${tests.length - pass} failed`)
  process.exit(pass === tests.length ? 0 : 1)
})()
