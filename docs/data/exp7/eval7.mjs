// Immutable evaluator for experiment 7 (frozen by SHA-256 before any variant is run). No model calls.
import fs from 'node:fs'
import { features, build, pickCorrections, one, QUOTES, MIN_SIMILAR, WIDE_MIN_PROMPT_CHARS } from '../../../src/similar.mjs'
import { projectKey } from '../../../src/scope.mjs'
import { TASKS } from '../exp4/tasks4.mjs'
const { VARIANTS } = await import('./variants7.mjs')

const J = f => JSON.parse(fs.readFileSync(new URL(f, import.meta.url), 'utf8'))
const full = J('../exp5/store3.json'), single = full.filter(r => !String(r.id).includes('-r'))
const hold = { store: J('./store2.json'), prompts: J('./prompts2.json') }
const key = projectKey('/tmp/otw-exp7')
const mk = store => store.map((r, i) => ({ at: 1700000000000 + i * 1000, about: r.about, quote: r.quote, host: 'claude', src: 'live', project: key, origin: 'interactive-user', _id: r.id, _cat: r.category }))
const U = ['What is the capital of Mars?', 'Tell me a joke about penguins.', 'Explain how photosynthesis works.', 'Translate good morning into French.', 'Recommend a book about the Roman empire.', 'How tall is Mount Everest?', 'Write a haiku about autumn.', 'What should I cook tonight?']
const NOW = 1800000000000

function weigh(f, idf, unseen = 0) { const vec = new Map(); let sq = 0; for (const [k, tf] of f) { const w = (1 + Math.log(tf)) * (idf.get(k) ?? unseen); if (w > 0) { vec.set(k, w); sq += w * w } } return { vec, norm: Math.sqrt(sq) } }
const cosv = (a, b) => { if (!a.norm || !b.norm) return 0; let d = 0; for (const [k, w] of a.vec) { const v = b.vec.get(k); if (v) d += w * v } return d / (a.norm * b.norm) }

function select(list, prompt, variant) {
  const past = list.filter(c => c.at < NOW)
  const texts = past.map(c => String(c.about || c.quote).slice(0, 300))
  const ix = build(texts)
  const q = weigh(features(prompt), ix.idf, ix.unseen)
  const floor = prompt.trim().length >= WIDE_MIN_PROMPT_CHARS ? 1e-6 : MIN_SIMILAR
  const ranked = []
  if (q.norm) for (const d of ix.docs) { if (!d.norm) continue; const s = cosv(q, d); if (s >= floor) ranked.push({ i: d.i, s }) }
  ranked.sort((a, b) => b.s - a.s)
  const words = t => (t.toLowerCase().match(/[\p{L}\p{N}_-]+/gu) ?? []).filter(w => w.length >= 3)
  const pw = new Set(words(prompt)); const dfw = new Map()
  for (const t of texts) for (const w of new Set(words(t))) dfw.set(w, (dfw.get(w) ?? 0) + 1)
  const qix = build(past.map(c => String(c.quote).slice(0, 300))); const qdoc = qix.docs
  const ctx = {
    past, texts,
    sharedRareWord: i => words(texts[i]).some(w => pw.has(w) && (dfw.get(w) ?? 0) / texts.length < 0.3),
    quoteCos: (a, b) => cosv(qdoc[a], qdoc[b]),
  }
  const r = ranked.length ? variant.filter(ctx, ranked) : []
  const out = [], seen = new Set()
  for (const x of r) { const c = past[x.i]; const k = one(c.quote, 800); if (seen.has(k)) continue; if (variant.accept && !variant.accept(ctx, x, out.map(o => ({ i: past.indexOf(o) })))) continue; seen.add(k); out.push(c); if (out.length >= QUOTES) break }
  return out
}

// Self-check: V0 must reproduce the real pickCorrections everywhere.
const allPrompts = [...TASKS.map(t => t.prompt), ...U, ...hold.prompts.map(p => p.prompt)]
let mismatches = 0
for (const [store, prompts] of [[single, allPrompts], [full, allPrompts], [hold.store, allPrompts]]) {
  const list = mk(store)
  for (const p of prompts) {
    const a = pickCorrections(list, p, NOW, undefined, key, true).map(c => c._id).join(',')
    const b = select(list, p, VARIANTS.V0).map(c => c._id).join(',')
    if (a !== b) mismatches++
  }
}
if (mismatches) { console.log(`SELF-CHECK FAILED: ${mismatches} mismatches between V0 and pickCorrections`); process.exit(2) }

const family = (r, pref) => r._id === pref || String(r._id).startsWith(pref + '-r')
const rows = {}
for (const [name, variant] of Object.entries(VARIANTS)) {
  const hitOn = list => TASKS.filter(t => select(list, t.prompt, variant).some(c => family(c, t.pref))).length
  const ls = mk(single), lf = mk(full), lh = mk(hold.store)
  const noise = U.reduce((a, p) => a + select(ls, p, variant).length, 0) / U.length
  const other = TASKS.reduce((a, t) => a + select(ls, t.prompt, variant).filter(c => !family(c, t.pref)).length, 0) / TASKS.length
  const hold64 = hold.prompts.filter(p => select(lh, p.prompt, variant).some(c => c._cat === p.category)).length / hold.prompts.length
  rows[name] = { HIT_single: hitOn(ls), HIT_repeat: hitOn(lf), NOISE_U: +noise.toFixed(2), OTHER: +other.toFixed(2), HOLD: +hold64.toFixed(3) }
}
console.log(`self-check ok (V0 == pickCorrections on ${allPrompts.length} prompts x 3 stores)`)
console.table(rows)
const b = rows.V0
for (const [n, r] of Object.entries(rows)) { if (n === 'V0') continue; const keep = r.HIT_single >= b.HIT_single && r.HIT_repeat >= b.HIT_repeat && r.HOLD >= b.HOLD - 0.02 && r.NOISE_U <= 0.75 * b.NOISE_U; console.log(`${n}: ${keep ? 'KEEP' : 'discard'}`) }
