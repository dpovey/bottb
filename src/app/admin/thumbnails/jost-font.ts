/**
 * Loads the website font (Jost) as a real, named FontFace so it can be used on
 * a <canvas>. `next/font` self-hosts Jost under a hashed family name, which is
 * not usable from `ctx.font`, so we register our own copies of the woff2 files
 * (downloaded into /public/fonts) under the literal family name "Jost".
 *
 * Jost is a variable font, so a single file covers weights 100–900.
 */

const LATIN =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
const LATIN_EXT =
  'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF'

let fontPromise: Promise<void> | null = null

/**
 * Ensure the "Jost" family is loaded and registered with the document.
 * Safe to call repeatedly — the work happens once.
 */
export function loadJostFont(): Promise<void> {
  if (typeof window === 'undefined' || typeof FontFace === 'undefined') {
    return Promise.resolve()
  }
  if (fontPromise) return fontPromise

  fontPromise = (async () => {
    const faces = [
      new FontFace('Jost', "url(/fonts/jost-latin.woff2) format('woff2')", {
        weight: '100 900',
        style: 'normal',
        display: 'swap',
        unicodeRange: LATIN,
      }),
      new FontFace('Jost', "url(/fonts/jost-latin-ext.woff2) format('woff2')", {
        weight: '100 900',
        style: 'normal',
        display: 'swap',
        unicodeRange: LATIN_EXT,
      }),
    ]

    await Promise.all(
      faces.map(async (face) => {
        await face.load()
        document.fonts.add(face)
      })
    )

    // Make sure the weights we actually render are rasterised before drawing.
    await Promise.all([
      document.fonts.load('700 80px Jost'),
      document.fonts.load('500 80px Jost'),
    ])
  })()

  return fontPromise
}
