// linkedin-caption.js: helpers for typing a LinkedIn caption with @mention chips in the T3 preview browser.
// Paste the whole file into preview_evaluate once per page load; it defines window.bottbLinkedIn and returns its version.
// Rules it serves: social/linkedin.md "HARD RULE — LinkedIn mentions are mandatory" and the 21 Nov 2026 caret entry.
//
// Write the caption with markers:  @{query|Display Name|urn}   (urn optional), e.g.
//   "Amakazaam! from @{Amazon|Amazon} ... thanks to @{Jumbo|Jumbo Interactive Limited|urn:li:organization:1234}\n\nNext para"
// A blank line ("\n\n") is a new paragraph: two Enter presses, which reads back as text, empty, text.
//
// The loop (typing stays with preview_act, so the composer sees real key events):
//   const steps = bottbLinkedIn.plan(caption)       // [{kind:"text", text}, {kind:"enter", count:2}, {kind:"mention", type:"@Jumbo", name, urn}]
//   for each step:
//     text     -> preview_act type step.text
//     enter    -> preview_act press Enter, step.count times
//     mention  -> preview_act type step.type; wait for the list; bottbLinkedIn.selected() must name step.name
//                 (ArrowDown until it does); press Enter; then bottbLinkedIn.caretToEnd()   <- never click line 1
//   bottbLinkedIn.check(caption)                    // every chip present (and its urn, if given), paragraphs as planned
// check() returns {ok, problems, paragraphs, chips}; post only when ok is true, and read the problems out loud otherwise.
// Live check still needed: the chip and option selectors below were written from the 21 Nov notes, not read off the DOM.
;(() => {
  const VERSION = 'linkedin-caption 2026-11-21'
  const L = (window.bottbLinkedIn = window.bottbLinkedIn || {})
  L.version = VERSION
  L.EDITOR = '[role=dialog] .ql-editor'
  L.OPTION = '[role=listbox] [role=option][aria-selected=true]'
  L.CHIP =
    "[data-entity-urn], .ql-mention, a[href*='/company/'], a[href*='/in/'], a[href*='/showcase/']"
  const MARK = /@\{([^|}]+)\|([^|}]+)(?:\|([^}]+))?\}/g
  const norm = (s) => String(s).replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

  L.editor = () => {
    const ed = document.querySelector(L.EDITOR)
    if (!ed)
      throw new Error(
        'no composer editor (' + L.EDITOR + '): open the post dialog first'
      )
    return ed
  }

  // The proven caret reset (21 Nov 2026): the end of the last paragraph, by Range, not by clicking.
  L.caretToEnd = () => {
    const ed = L.editor()
    ed.focus()
    const r = document.createRange()
    r.selectNodeContents(ed.lastElementChild || ed)
    r.collapse(false)
    const s = window.getSelection()
    s.removeAllRanges()
    s.addRange(r)
    return { caretIn: (ed.lastElementChild || ed).textContent.slice(-40) }
  }

  L.plan = (caption) => {
    const steps = []
    const paras = String(caption).split(/\n\s*\n/)
    paras.forEach((p, k) => {
      if (k) steps.push({ kind: 'enter', count: 2 })
      let last = 0
      for (const m of p.matchAll(MARK)) {
        if (m.index > last)
          steps.push({ kind: 'text', text: p.slice(last, m.index) })
        steps.push({
          kind: 'mention',
          type: '@' + m[1].trim(),
          name: m[2].trim(),
          urn: m[3] ? m[3].trim() : null,
        })
        last = m.index + m[0].length
      }
      if (last < p.length) steps.push({ kind: 'text', text: p.slice(last) })
    })
    return steps
  }

  // What the caption should read back as: paragraph texts (with chip names) and an empty paragraph between each.
  L.expected = (caption) => {
    const paras = String(caption)
      .split(/\n\s*\n/)
      .map((p) => norm(p.replace(MARK, (_, q, name) => name)))
    const out = []
    paras.forEach((p, k) => {
      if (k) out.push('')
      out.push(p)
    })
    const chips = [...String(caption).matchAll(MARK)].map((m) => ({
      name: m[2].trim(),
      urn: m[3] ? m[3].trim() : null,
    }))
    return { paragraphs: out, chips }
  }

  L.selected = () => {
    const o = document.querySelector(L.OPTION)
    return o
      ? {
          text: norm(o.textContent),
          urn:
            o.getAttribute('data-entity-urn') ||
            o.getAttribute('data-urn') ||
            null,
        }
      : null
  }

  L.read = () => {
    const ed = L.editor()
    const paragraphs = [...ed.children].map((p) => norm(p.textContent))
    const chips = [...ed.querySelectorAll(L.CHIP)].map((c) => ({
      name: norm(c.textContent),
      urn:
        c.getAttribute('data-entity-urn') || c.getAttribute('data-urn') || null,
    }))
    return { paragraphs, chips }
  }

  L.check = (caption) => {
    const want = L.expected(caption)
    const got = L.read()
    const problems = []
    const left = [...got.chips]
    for (const c of want.chips) {
      const i = left.findIndex(
        (g) => g.name === c.name || (c.urn && g.urn === c.urn)
      )
      if (i < 0) {
        problems.push(`no chip for ${c.name} (plain text does not credit them)`)
        continue
      }
      if (c.urn && left[i].urn && left[i].urn !== c.urn)
        problems.push(
          `chip ${c.name} has urn ${left[i].urn}, expected ${c.urn}`
        )
      left.splice(i, 1)
    }
    for (const g of left) problems.push(`unplanned chip ${g.name}`)
    const a = want.paragraphs,
      b = got.paragraphs
    if (a.length !== b.length)
      problems.push(
        `paragraphs: ${b.length}, expected ${a.length} (pattern ${b.map((p) => (p ? 'text' : '1')).join(',')})`
      )
    a.forEach((p, k) => {
      if (b[k] !== undefined && b[k] !== p)
        problems.push(
          `paragraph ${k + 1} reads "${b[k].slice(0, 80)}", expected "${p.slice(0, 80)}"`
        )
    })
    return {
      ok: problems.length === 0,
      problems,
      paragraphs: b,
      chips: got.chips,
    }
  }

  return VERSION
})()
