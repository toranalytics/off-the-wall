// Offline, no model: quotes shown on short follow-up prompts, with the 20-character guard (current) versus wide recall without it.
import fs from 'node:fs'
import { pickCorrections, search, build, QUOTES } from '../../../src/similar.mjs'
import { projectKey } from '../../../src/scope.mjs'
const full = JSON.parse(fs.readFileSync(new URL('../exp5/store3.json', import.meta.url), 'utf8'))
const key = projectKey('/tmp/otw-short')
const list = full.map((r, i) => ({ at: 1700000000000 + i * 1000, about: r.about, quote: r.quote, host: 'claude', src: 'live', project: key, origin: 'interactive-user', _id: r.id }))
const short = ['ok', 'yes', 'continue', 'yes do it', 'go ahead', 'thanks', 'looks good', 'run the tests', 'fix it', 'try again', 'why?', 'commit it', 'do the same for the other file', 'now push it']
const withGuard = p => pickCorrections(list, p, 1.8e12, undefined, key, true).length
const noGuard = p => search(build(list.map(c => String(c.about || c.quote).slice(0, 300))), p, 1e-6, QUOTES).length
let g = 0, n = 0
for (const p of short) { const a = withGuard(p), b = noGuard(p); g += a; n += b; console.log(String(p.length).padStart(2), p.padEnd(34), 'guard', a, ' no guard', b) }
console.log(`mean quotes: with guard ${(g / short.length).toFixed(2)}, without ${(n / short.length).toFixed(2)} (${short.length} short prompts, 240-record store)`)
