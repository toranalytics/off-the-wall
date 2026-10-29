// Immutable evaluator for experiment 11 (frozen by SHA-256 before any variant is run). No model calls.
import fs from 'node:fs'
import crypto from 'node:crypto'
import { features, build, pickCorrections, one, QUOTES, WIDE_MIN_PROMPT_CHARS, searchScored } from '../../../src/similar.mjs'
import { projectKey } from '../../../src/scope.mjs'
import { TASKS } from '../exp4/tasks4.mjs'
const { VARIANTS } = await import('./variants11.mjs')
const J = f => JSON.parse(fs.readFileSync(new URL(f, import.meta.url), 'utf8'))
const full = J('../exp5/store3.json'), hold = { store: J('../exp7/store2.json'), prompts: J('../exp7/prompts2.json') }
const key = projectKey('/tmp/otw-exp11'), NOW = 1.8e12
const mk = s => s.map((r, i) => ({ at: 1700000000000 + i * 1000, about: r.about, quote: r.quote, host: 'claude', src: 'live', project: key, origin: 'interactive-user', _id: r.id, _cat: r.category }))
const U = ['What is the capital of Mars?', 'Tell me a joke about penguins.', 'Explain how photosynthesis works.', 'Translate good morning into French.', 'Recommend a book about the Roman empire.', 'How tall is Mount Everest?', 'Write a haiku about autumn.', 'What should I cook tonight?']
const rng = seed => { let s = crypto.createHash('sha256').update(seed).digest().readUInt32LE(0); return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296 }
const g = rng('order-exp11'), allPairs = []
for (let i = 0; i < TASKS.length; i++) for (let j = 0; j < TASKS.length; j++) if (i < j) allPairs.push([TASKS[i], TASKS[j]])
const PAIRS = allPairs.sort(() => g() - 0.5).slice(0, 40).map(([a, b]) => ({ prompt: `${a.prompt} Also: ${b.prompt}`, targets: [a.pref, b.pref] }))
const fam = (c, pref) => c._id === pref || String(c._id).startsWith(pref + '-r')
const wv = (f, idf, u = 0) => { const vec = new Map(); let sq = 0; for (const [k, tf] of f) { const x = (1 + Math.log(tf)) * (idf.get(k) ?? u); if (x > 0) { vec.set(k, x); sq += x * x } } return { vec, norm: Math.sqrt(sq) } }
const cosv = (a, b) => { if (!a.norm || !b.norm) return 0; let d = 0; for (const [k, w] of a.vec) { const v = b.vec.get(k); if (v) d += w * v } return d / (a.norm * b.norm) }

function select(list, prompt, v) {
  const past = list.filter(c => c.at < NOW)
  const texts = past.map(c => String(c.about || c.quote).slice(0, 300)), ix = build(texts)
  const floor = prompt.trim().length >= WIDE_MIN_PROMPT_CHARS ? 1e-6 : 0.18
  const scored = searchScored(ix, prompt, floor, past.length)
  const out = [], seen = new Set()
  if (v.collapse == null) { for (const { i } of scored) { const c = past[i], k = one(c.quote, 800); if (seen.has(k)) continue; seen.add(k); out.push(c); if (out.length >= QUOTES) break } return out }
  // collapse: clusters over ALL past records by quote similarity (newest member first), scored by best member
  const qix = build(past.map(c => String(c.quote).slice(0, 300))), qv = qix.docs.map(d => ({ vec: d.vec, norm: d.norm }))
  const order = past.map((c, i) => i).sort((a, b) => past[b].at - past[a].at), clusters = [], of = new Array(past.length)
  for (const i of order) { let hit = -1; for (let k = 0; k < clusters.length; k++) if (cosv(qv[i], qv[clusters[k][0]]) >= v.collapse) { hit = k; break } if (hit < 0) { clusters.push([i]); of[i] = clusters.length - 1 } else { clusters[hit].push(i); of[i] = hit } }
  const best = new Map(); for (const { i, s } of scored) { const k = of[i]; if (!best.has(k) || best.get(k) < s) best.set(k, s) }
  for (const [k] of [...best.entries()].sort((a, b) => b[1] - a[1])) { const c = past[clusters[k][0]], q = one(c.quote, 800); if (seen.has(q)) continue; seen.add(q); out.push(c); if (out.length >= QUOTES) break }
  return out
}
// cluster purity (information only)
function purity(list, thr) {
  const past = list, qix = build(past.map(c => String(c.quote).slice(0, 300))), qv = qix.docs.map(d => ({ vec: d.vec, norm: d.norm })), order = past.map((c, i) => i).sort((a, b) => past[b].at - past[a].at), clusters = []
  for (const i of order) { let hit = -1; for (let k = 0; k < clusters.length; k++) if (cosv(qv[i], qv[clusters[k][0]]) >= thr) { hit = k; break } if (hit < 0) clusters.push([i]); else clusters[hit].push(i) }
  const base = id => String(id).replace(/-r\d+$/, ''); let pure = 0, multi = 0
  for (const cl of clusters) if (cl.length > 1) { multi++; if (new Set(cl.map(i => base(past[i]._id))).size === 1) pure++ }
  return { clusters: clusters.length, multiMember: multi, pureMulti: pure }
}

const lf = mk(full), lh = mk(hold.store)
let bad = 0
for (const p of [...TASKS.map(t => t.prompt), ...PAIRS.map(x => x.prompt), ...U]) { const a = pickCorrections(lf, p, NOW, undefined, key, true).map(c => c._id).join(','), b = select(lf, p, VARIANTS.C0).map(c => c._id).join(','); if (a !== b) bad++ }
if (bad) { console.log(`SELF-CHECK FAILED: ${bad} mismatches`); process.exit(2) }
console.log('self-check ok (C0 == pickCorrections on tasks, pairs and unrelated prompts)')
const rows = {}
for (const [name, v] of Object.entries(VARIANTS)) {
  let joint = 0, any = 0; for (const p of PAIRS) { const s = select(lf, p.prompt, v), h = p.targets.map(t => s.some(c => fam(c, t))); joint += h.every(Boolean); any += h.some(Boolean) }
  const hits = TASKS.filter(t => select(lf, t.prompt, v).some(c => fam(c, t.pref))).length
  const slots = TASKS.reduce((a, t) => a + select(lf, t.prompt, v).filter(c => fam(c, t.pref)).length, 0) / TASKS.length
  const noise = U.reduce((a, p) => a + select(lf, p, v).length, 0) / U.length
  const single = mk(full.filter(r => !String(r.id).includes('-r'))), hitSingle = TASKS.filter(t => select(single, t.prompt, v).some(c => fam(c, t.pref))).length
  const hold64 = hold.prompts.filter(p => select(lh, p.prompt, v).some(c => c._cat === p.category)).length / hold.prompts.length
  rows[name] = { JOINT: joint, ANY: any, SLOTS: +slots.toFixed(2), HIT_single: hitSingle, HIT_repeat: hits, NOISE: +noise.toFixed(2), HOLD: +hold64.toFixed(3) }
}
console.table(rows)
for (const thr of [0.7, 0.5, 0.35]) console.log('cluster info', thr, JSON.stringify(purity(lf, thr)))
const b = rows.C0
for (const [n, r] of Object.entries(rows)) if (n !== 'C0') console.log(n, r.JOINT >= b.JOINT * 1.25 && r.HIT_single >= b.HIT_single && r.HIT_repeat >= b.HIT_repeat && r.NOISE <= b.NOISE && r.HOLD >= b.HOLD - 0.02 ? 'KEEP' : 'discard')
