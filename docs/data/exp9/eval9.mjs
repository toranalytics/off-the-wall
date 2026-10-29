// Experiment 9 evaluator. Real run: node eval9.mjs (needs @huggingface/transformers in this folder's node_modules).
// Pipeline test without a model: node eval9.mjs --fake  (hashed bag of words, NOT a result).
import fs from 'node:fs'
import { pickCorrections, one, QUOTES } from '../../../src/similar.mjs'
import { projectKey } from '../../../src/scope.mjs'
import { TASKS } from '../exp4/tasks4.mjs'
const fake = process.argv.includes('--fake')
const J = f => JSON.parse(fs.readFileSync(new URL(f, import.meta.url), 'utf8'))
const full = J('../exp5/store3.json'), single = full.filter(r => !String(r.id).includes('-r'))
const hold = { store: J('../exp7/store2.json'), prompts: J('../exp7/prompts2.json') }
const key = projectKey('/tmp/otw-exp9'), NOW = 1.8e12
const mk = s => s.map((r, i) => ({ at: 1700000000000 + i * 1000, about: r.about, quote: r.quote, host: 'claude', src: 'live', project: key, origin: 'interactive-user', _id: r.id, _cat: r.category }))
const U = ['What is the capital of Mars?', 'Tell me a joke about penguins.', 'Explain how photosynthesis works.', 'Translate good morning into French.', 'Recommend a book about the Roman empire.', 'How tall is Mount Everest?', 'Write a haiku about autumn.', 'What should I cook tonight?']
const fam = (c, pref) => c._id === pref || String(c._id).startsWith(pref + '-r')

let embedder
if (fake) {
  const dim = 256
  embedder = async texts => texts.map(t => { const v = new Float32Array(dim); for (const w of (t.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])) { let h = 2166136261; for (const ch of w) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); v[(h >>> 0) % dim] += 1 } const n = Math.hypot(...v) || 1; return v.map(x => x / n) })
} else {
  const { pathToFileURL } = await import('node:url'), path = await import('node:path')
  const work = process.env.EXP9_WORK || new URL('./.work', import.meta.url).pathname
  const { pipeline, env } = await import(pathToFileURL(path.join(work, 'node_modules/@huggingface/transformers/dist/transformers.node.mjs')).href); env.cacheDir = path.join(work, 'model-cache')
  const ex = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'q8', device: 'cpu' })
  embedder = async texts => { const out = []; for (let i = 0; i < texts.length; i += 32) { const r = await ex(texts.slice(i, i + 32), { pooling: 'mean', normalize: true }); out.push(...r.tolist().map(a => Float32Array.from(a))) } return out }
}
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s }
const cache = new Map()
async function embedStore(list) { const k = list.map(c => c._id).join('|'); if (!cache.has(k)) cache.set(k, await embedder(list.map(c => String(c.about || c.quote).slice(0, 300)))); return cache.get(k) }
const pq = new Map(); async function embedPrompt(p) { if (!pq.has(p)) pq.set(p, (await embedder([p]))[0]); return pq.get(p) }
async function pick(list, prompt, tau) {
  const vs = await embedStore(list), q = await embedPrompt(prompt)
  const ranked = vs.map((v, i) => ({ i, s: dot(q, v) })).filter(x => x.s >= tau).sort((a, b) => b.s - a.s)
  const out = [], seen = new Set()
  for (const { i } of ranked) { const k = one(list[i].quote, 800); if (seen.has(k)) continue; seen.add(k); out.push(list[i]); if (out.length >= QUOTES) break }
  return out
}
const ls = mk(single), lf = mk(full), lh = mk(hold.store)
const rows = {}
const base = async (list, p) => pickCorrections(list, p, NOW, undefined, key, true)
const metrics = async (name, f) => ({
  HIT_single: (await Promise.all(TASKS.map(async t => (await f(ls, t.prompt)).some(c => fam(c, t.pref))))).filter(Boolean).length,
  HIT_repeat: (await Promise.all(TASKS.map(async t => (await f(lf, t.prompt)).some(c => fam(c, t.pref))))).filter(Boolean).length,
  NOISE_single: +((await Promise.all(U.map(async p => (await f(ls, p)).length))).reduce((a, b) => a + b, 0) / U.length).toFixed(2),
  NOISE_repeat: +((await Promise.all(U.map(async p => (await f(lf, p)).length))).reduce((a, b) => a + b, 0) / U.length).toFixed(2),
  HOLD: +((await Promise.all(hold.prompts.map(async p => (await f(lh, p.prompt)).some(c => c._cat === p.category)))).filter(Boolean).length / hold.prompts.length).toFixed(3),
})
rows.E0 = await metrics('E0', base)
const round2 = process.argv.includes('--round2')
if (!round2) for (const [name, tau] of [['E1', 0.35], ['E2', 0.45], ['E3', 0.55]]) rows[name] = await metrics(name, (l, p) => pick(l, p, tau))
else {
  for (const [name, tau] of [['E4', 0.25], ['E5', 0.30]]) rows[name] = await metrics(name, (l, p) => pick(l, p, tau))
  // E6: current word-overlap picks, kept only if embedding cosine >= 0.20
  rows.E6 = await metrics('E6', async (l, p) => { const vs = await embedStore(l), q = await embedPrompt(p), idx = new Map(l.map((c, i) => [c._id, i])); return (await base(l, p)).filter(c => dot(q, vs[idx.get(c._id)]) >= 0.20) })
}
console.log(fake ? 'FAKE EMBEDDER (pipeline test, not a result)' : 'model: Xenova/all-MiniLM-L6-v2 q8')
console.table(rows)
for (const [n, r] of Object.entries(rows)) if (n !== 'E0') console.log(n, r.HIT_single >= 11 && r.HIT_repeat >= 17 && r.HOLD >= 0.933 && r.NOISE_single <= 3 && r.NOISE_repeat <= 3 ? 'CANDIDATE' : 'discard')
