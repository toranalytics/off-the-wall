// Immutable evaluator for experiment 8 (frozen by SHA-256 before any variant is run). No model calls.
import fs from 'node:fs'
import { features, build, pickCorrections, one, QUOTES, WIDE_MIN_PROMPT_CHARS } from '../../../src/similar.mjs'
import { projectKey } from '../../../src/scope.mjs'
const { VARIANTS } = await import('./variants8.mjs')
const full = JSON.parse(fs.readFileSync(new URL('../exp5/store3.json', import.meta.url), 'utf8'))
const key = projectKey('/tmp/otw-exp8')
const list = full.map((r, i) => ({ at: 1700000000000 + i * 1000, about: r.about, quote: r.quote, host: 'claude', src: 'live', project: key, origin: 'interactive-user', _id: r.id }))
const NOW = 1.8e12
const SPECIFIC = [['fix upload.js:88', 'c001'], ['coverage for auth', 'c002'], ['move scripts files', 'c003'], ['regex explanation', 'c004'], ['fix sort comparator', 'c007'], ['fix monthly sql', 'c008'], ['convert legacy.js', 'c009'], ['quick status page', 'c016'], ['style the card', 'c021'], ['add card styles', 'c021']]
const VAGUE = ['ok', 'yes', 'continue', 'yes do it', 'go ahead', 'thanks', 'looks good', 'why?', 'try again', 'do it', 'fix it']
const UNSCORED = ['run the tests', 'commit it', 'now push it']
const words = t => (t.toLowerCase().match(/[\p{L}\p{N}_-]+/gu) ?? []).filter(w => w.length >= 3)
const texts = list.map(c => String(c.about || c.quote).slice(0, 300)), ix = build(texts)
const df = new Map(); for (const t of texts) for (const w of new Set(words(t))) df.set(w, (df.get(w) ?? 0) + 1)

function select(prompt, v) {
  const short = prompt.trim().length < WIDE_MIN_PROMPT_CHARS
  const floor = short ? v.floor : 1e-6
  // same scoring as similar.mjs search()
  const w = (f, idf, u = 0) => { const vec = new Map(); let sq = 0; for (const [k, tf] of f) { const x = (1 + Math.log(tf)) * (idf.get(k) ?? u); if (x > 0) { vec.set(k, x); sq += x * x } } return { vec, norm: Math.sqrt(sq) } }
  const q = w(features(prompt), ix.idf, ix.unseen), scored = []
  if (q.norm) for (const d of ix.docs) { if (!d.norm) continue; let dot = 0; for (const [k, x] of q.vec) { const y = d.vec.get(k); if (y) dot += x * y } const s = dot / (q.norm * d.norm); if (s >= floor) scored.push({ i: d.i, s }) }
  scored.sort((a, b) => b.s - a.s)
  const pw = new Set(words(prompt)); const out = [], seen = new Set()
  for (const { i } of scored) {
    if (short && v.anchor && !words(texts[i]).some(x => pw.has(x) && (df.get(x) ?? 0) / texts.length < 0.3)) continue
    const c = list[i], k = one(c.quote, 800); if (seen.has(k)) continue; seen.add(k); out.push(c)
    if (out.length >= Math.min(QUOTES, short && v.cap ? v.cap : QUOTES)) break
  }
  return out
}
let bad = 0
for (const p of [...SPECIFIC.map(x => x[0]), ...VAGUE, ...UNSCORED, 'fix the flaky login test in the billing migration module']) {
  const a = pickCorrections(list, p, NOW, undefined, key, true).map(c => c._id).join(','), b = select(p, VARIANTS.V0).map(c => c._id).join(',')
  if (a !== b) bad++
}
if (bad) { console.log(`SELF-CHECK FAILED: ${bad} mismatches`); process.exit(2) }
console.log('self-check ok (V0 == pickCorrections)')
const fam = (c, id) => c._id === id || String(c._id).startsWith(id + '-r')
const rows = {}
for (const [name, v] of Object.entries(VARIANTS)) rows[name] = { HIT: SPECIFIC.filter(([p, id]) => select(p, v).some(c => fam(c, id))).length, NOISE: +(VAGUE.reduce((a, p) => a + select(p, v).length, 0) / VAGUE.length).toFixed(2), 'unscored mean': +(UNSCORED.reduce((a, p) => a + select(p, v).length, 0) / UNSCORED.length).toFixed(2) }
console.table(rows)
const b0 = rows.V0
for (const [n, r] of Object.entries(rows)) if (n !== 'V0') console.log(n, r.HIT >= b0.HIT && r.NOISE <= 0.5 * b0.NOISE ? 'KEEP' : 'discard')
