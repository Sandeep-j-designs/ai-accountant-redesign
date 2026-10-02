// Post-processes the single-file vite build (dist-single/index.html) into a
// fully self-contained, font-trimmed bill-verification-cockpit.html at repo root.
//   1. Strips non-Latin @font-face blocks (Cyrillic / Greek / Vietnamese)
//   2. Inlines favicon.svg as a data URI
// Run after: vite build --config vite.config.singlefile.ts
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const SRC = root + 'dist-single/index.html'
const OUT = root + 'bill-verification-cockpit.html'
const FAVICON = root + 'public/favicon.svg'

// unicode-range signatures that appear ONLY in non-Latin subsets.
// Fontsource's minified CSS strips leading zeros (U+370, not U+0370), so match
// short-form hex: Greek (U+37x / U+3xx-3 / U+1F..), Cyrillic (U+4xx / U+460 /
// U+2116 / U+1C80), Vietnamese (U+1EA0 / U+20AB / U+102-103).
const DROP = /U\+1F|U\+37[0-9A-Fa-f]|U\+3[0-9A-Fa-f]{2}-3|U\+4[0-9A-Fa-f]{2}-4|U\+460|U\+2116|U\+1C80|U\+1EA0|U\+20AB|U\+102-103/

let html = readFileSync(SRC, 'utf8')

let kept = 0, dropped = 0
html = html.replace(/@font-face\s*\{[^}]*\}/g, (block) => {
  const ur = (block.match(/unicode-range:\s*([^;}]*)/i) || [])[1] || ''
  if (DROP.test(ur)) { dropped++; return '' }
  kept++
  return block
})

// inline favicon (only if still an external/relative reference)
const svg = readFileSync(FAVICON, 'utf8')
const dataUri = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64')
html = html.replace(/href="(\.\/)?favicon\.svg"/, `href="${dataUri}"`)

// inline the brand-mark favicon (public/ asset referenced by absolute /brand/
// URL, which 404s under file://) as a data URI so the tab icon resolves too
const mark = readFileSync(root + 'public/brand/ai-accountant-mark.png')
const markUri = 'data:image/png;base64,' + mark.toString('base64')
html = html.replace(/href="(\.)?\/brand\/ai-accountant-mark\.png"/, `href="${markUri}"`)

writeFileSync(OUT, html)

const kb = (Buffer.byteLength(html) / 1024).toFixed(0)
console.log(`@font-face: kept ${kept}, dropped ${dropped}`)
console.log(`Wrote ${OUT} — ${kb} KB`)
