# Videographer brief (source)

Editable source for `BOTTB-Videographer-Brief.pdf` (repo root). The PDF is a
render of `videographer.html`; edit the HTML, then regenerate the PDF — don't
hand-edit the PDF.

## Files

- `videographer.html` — the 8-page brief (self-contained layout + copy).
- `assets/` — photos, the BOTTB/Youngcare logos, and the fonts
  (`fonts.css` + `fonts/*.woff2`: Playfair Display, Inter, Oswald).
- `render.js` — headless-Chrome (Playwright) HTML → A4 PDF renderer.

## Regenerate the PDF

From the repo root (needs dev deps installed — `pnpm install`):

```bash
node brief/render.js
```

Writes `BOTTB-Videographer-Brief.pdf` to the repo root.

## Notes

- Platform icons are CSS chips, not inline SVG, so the PDF previews correctly
  in Gmail's inline viewer.
- Fonts are bundled locally so the render is offline/self-contained.
