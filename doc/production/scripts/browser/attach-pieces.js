// attach-pieces.js: attach a large local video to a site's file input in the T3 preview browser without a public Blob.
// Paste the whole file into preview_evaluate once per page load; it defines window.bottbAttach and returns its version.
// Method (social retro, You Oughta Know 2026-11-20/21; used 3 times: YouTube 4K 33 x 45 MB, LinkedIn and TikTok 1080p 9 pieces):
//   0. split-for-browser.sh <file>                 pieces of 45 MB (under the 50 MB per-upload cap) + the expected sha256
//   1. bottbAttach.install()                       adds a hidden <input type=file id=bottb-part>; each change pushes files[0]
//   2. preview_act upload, one call per piece, on #bottb-part, in split order (part_aa, part_ab, ...)
//   3. await bottbAttach.rebuild(name, sha256)     joins the pieces into one File, hashes it in the page, refuses on a mismatch
//   4. bottbAttach.inject(selectorOrInput)         DataTransfer onto the site's real input, then input + change events (bubbles)
// Site notes:
//   - YouTube: attach the pieces BEFORE Studio's modal upload dialog opens; with it open, upload timed out even on 1 KB.
//     The real input is input[name=Filedata].
//   - LinkedIn: call bottbAttach.hookClick() first, then click "Add media": the composer's input is captured in
//     bottbAttach.captured instead of opening a native picker (which blocks CDP). inject(bottbAttach.captured.at(-1)).
//   - TikTok: the video/* input already exists on the Studio upload page: inject('input[type=file][accept*="video"]').
// Attaching publishes nothing. The pieces stay in page memory until reload; call reset() to drop them.
;(() => {
  const VERSION = 'attach-pieces 2026-11-21'
  const A = (window.bottbAttach = window.bottbAttach || {})
  A.version = VERSION
  A.parts = A.parts || []
  A.captured = A.captured || []

  A.install = () => {
    let el = document.getElementById('bottb-part')
    if (!el) {
      el = document.createElement('input')
      el.type = 'file'
      el.id = 'bottb-part'
      el.style.cssText =
        'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;z-index:2147483647'
      el.addEventListener('change', () => {
        if (el.files && el.files[0]) A.parts.push(el.files[0])
      })
      document.body.appendChild(el)
    }
    return { installed: true, parts: A.parts.length }
  }

  A.status = () => ({
    parts: A.parts.length,
    names: A.parts.map((f) => f.name),
    bytes: A.parts.reduce((n, f) => n + f.size, 0),
  })

  A.reset = () => {
    A.parts.length = 0
    A.file = null
    return A.status()
  }

  const hex = (buf) =>
    Array.from(new Uint8Array(buf), (b) =>
      b.toString(16).padStart(2, '0')
    ).join('')

  // Join the pieces in name order (split's aa, ab, ... sort correctly) and check the hash before anything is attached.
  A.rebuild = async (name, sha256, type = 'video/mp4') => {
    if (!A.parts.length)
      throw new Error(
        'no pieces: install(), then upload each piece to #bottb-part'
      )
    const names = A.parts.map((f) => f.name)
    if (new Set(names).size !== names.length)
      throw new Error('a piece was uploaded twice: ' + names.join(','))
    const parts = [...A.parts].sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0
    )
    const file = new File(parts, name, { type })
    const got = hex(
      await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
    )
    const ok = !sha256 || got === String(sha256).toLowerCase()
    if (!ok)
      throw new Error(
        `sha256 mismatch: got ${got}, expected ${sha256}; reset() and upload the pieces again`
      )
    A.file = file
    return { name, size: file.size, parts: parts.length, sha256: got, ok }
  }

  A.inject = (target) => {
    if (!A.file) throw new Error('rebuild(name, sha256) first')
    const input =
      typeof target === 'string' ? document.querySelector(target) : target
    if (!input || input.type !== 'file')
      throw new Error('no file input for ' + String(target))
    const dt = new DataTransfer()
    dt.items.add(A.file)
    input.files = dt.files
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    return {
      injected: A.file.name,
      size: A.file.size,
      files: input.files.length,
    }
  }

  // Capture file inputs a site creates on click, without the native picker (LinkedIn "Add media").
  A.hookClick = () => {
    if (A._origClick) return { hooked: true, already: true }
    const orig = (A._origClick = HTMLInputElement.prototype.click)
    HTMLInputElement.prototype.click = function () {
      if (this.type === 'file') {
        A.captured.push(this)
        return undefined
      }
      return orig.call(this)
    }
    return { hooked: true }
  }

  A.unhook = () => {
    if (A._origClick) HTMLInputElement.prototype.click = A._origClick
    A._origClick = null
    return { hooked: false, captured: A.captured.length }
  }

  return VERSION
})()
