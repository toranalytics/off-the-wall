#!/usr/bin/env node
// Optional development tool, not a plugin runtime dependency. Explicit public font only;
// no native add-on, OS font scan, browser local-file access, user history, or network calls.
// node scripts/render-banners.mjs /path/to/@resvg/resvg-wasm /path/to/DejaVuSans.ttf
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const [rendererDir, fontFile] = process.argv.slice(2)
if (!rendererDir || !fontFile) throw new Error('Provide a resvg-wasm module directory and an explicit public font file')
const { initWasm, Resvg } = await import(pathToFileURL(join(resolve(rendererDir), 'index.mjs')))
await initWasm(readFileSync(join(resolve(rendererDir), 'index_bg.wasm')))
const font = new Uint8Array(readFileSync(resolve(fontFile)))
const root = fileURLToPath(new URL('..', import.meta.url))
for (const name of ['hero', 'social-preview']) {
  const renderer = new Resvg(readFileSync(`${root}assets/${name}.svg`), { font: { fontBuffers: [font], defaultFontFamily: 'DejaVu Sans' } })
  const image = renderer.render()
  writeFileSync(`${root}assets/${name}.png`, image.asPng())
  console.log(`${name}: ${image.width}x${image.height}`)
  image.free(); renderer.free()
}
