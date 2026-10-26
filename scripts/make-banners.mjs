#!/usr/bin/env node
// Deterministic banner sources. Convert SVG -> PNG in an SVG-capable renderer.
// No model, network request, user history, or empirical-effect claim is used.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('..', import.meta.url))
const icon = readFileSync(root + 'assets/icon.png').toString('base64')
function banner(width, height, compact = false) {
  const h = compact ? 800 : 900
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1600 ${h}" role="img" aria-label="Off the Wall: correction recall with workspace boundaries">
<title>Off the Wall: correction recall with workspace boundaries</title>
<defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#171a22"/><stop offset="1" stop-color="#26212b"/></linearGradient></defs>
<rect width="1600" height="${h}" fill="url(#bg)"/>
<g font-family="DejaVu Sans,Arial,sans-serif" fill="#f0ece4">
<image href="data:image/png;base64,${icon}" x="94" y="94" width="84" height="84"/>
<text x="202" y="130" fill="#e9ae69" font-size="22" letter-spacing="3">CLAUDE CODE + CODEX</text>
<text x="202" y="166" fill="#a8a5b0" font-size="23">Coding-agent correction recall</text>
<text x="94" y="285" font-size="94" font-weight="750" letter-spacing="-4">Off the Wall</text>
<text x="98" y="354" fill="#d3cdd8" font-size="32">Past corrections, with clearer boundaries.</text>
<rect x="94" y="405" width="850" height="208" rx="18" fill="#20242e" stroke="#49434d"/>
<text x="124" y="446" fill="#e9ae69" font-size="18" letter-spacing="1.5">SYNTHETIC FORMAT EXAMPLE</text>
<text x="124" y="493" fill="#7ed2bc" font-size="25">“Run the backfill before saying done.”</text>
<text x="124" y="537" fill="#cdc6d4" font-size="23">History is context, not permission.</text>
<text x="124" y="577" fill="#93909e" font-size="20">Current instructions and safety rules take precedence.</text>
<g font-size="25"><text x="1012" y="440">Same working directory</text><text x="1012" y="495">Origin-tagged records</text><text x="1012" y="550">No latest-only filler</text><text x="1012" y="605">Legacy records retained</text></g>
<line x1="94" y1="${h-126}" x2="1506" y2="${h-126}" stroke="#443d49"/>
<text x="98" y="${h-82}" fill="#aaa3b2" font-size="21">Model-selection guidance. No guaranteed savings or user outcomes.</text>
<text x="98" y="${h-44}" fill="#aaa3b2" font-size="21">Storage is local; selected excerpts are processed by your CLI provider.</text>
</g></svg>\n`
}
writeFileSync(root + 'assets/hero.svg', banner(1600, 900))
writeFileSync(root + 'assets/social-preview.svg', banner(1280, 640, true))
