import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url'
const root = '/Users/SJB/.aside/u/0/sessions/2026-10-22_0s8heOAE5qcpaKfV/tmp/claude-cli/config/plugins/cache/off-the-wall/off-the-wall'; const src = path.join(root, fs.readdirSync(root)[0], 'src')
const { features, build, MIN_SIMILAR, QUOTES, pickCorrections } = await import(pathToFileURL(path.join(src, 'similar.mjs')).href)
const { projectKey } = await import(pathToFileURL(path.join(src, 'scope.mjs')).href)
const key = projectKey('/tmp/otw-exp3-eval'); const J = f => JSON.parse(fs.readFileSync(f, 'utf8'))
function weighQ(f, idf, unseen) { const vec = new Map(); let sq = 0; for (const [k, tf] of f) { const w = (1 + Math.log(tf)) * (idf.get(k) ?? unseen); if (w > 0) { vec.set(k, w); sq += w * w } } return { vec, norm: Math.sqrt(sq) } }
function scores(index, query) { const { vec, norm } = weighQ(features(query), index.idf, index.unseen); const out = new Array(index.docs.length).fill(0); if (!norm) return out; for (const d of index.docs) { if (!d.norm) continue; let dot = 0; for (const [k, w] of vec) { const v = d.vec.get(k); if (v) dot += w * v } out[d.i] = dot / (norm * d.norm) } return out }
const one = s => String(s).replace(/\s+/g, ' ').trim()
function pick(store, prompt, variant) { // returns store records (<= QUOTES)
  const aboutT = store.map(r => String(r.about || r.quote).slice(0, 300)), quoteT = store.map(r => String(r.quote).slice(0, 300))
  let sc
  if (variant === 'V0') sc = scores(build(aboutT), prompt)
  else if (variant === 'V1') sc = scores(build(store.map((r, i) => (aboutT[i] + ' ' + quoteT[i]).slice(0, 600))), prompt)
  else { const a = scores(build(aboutT), prompt), q = scores(build(quoteT), prompt); sc = a.map((x, i) => Math.max(x, q[i])) }
  const ranked = sc.map((s, i) => ({ s, i })).filter(x => x.s >= MIN_SIMILAR).sort((a, b) => b.s - a.s).map(x => store[x.i]); const out = [], seen = new Set()
  for (const r of ranked) { const k = one(r.quote); if (seen.has(k)) continue; seen.add(k); out.push(r); if (out.length >= QUOTES) break } return out }
const sets = { dev: { store: J('../otw-exp2/store/store.json'), prompts: (await import('../otw-exp2/tasks.mjs')).TASKS.map(t => ({ id: t.id, category: t.category, prompt: t.prompt })) },
  holdout: { store: J('holdout/store2.json'), prompts: J('holdout/prompts2.json') } }
// sanity: V0 reimplementation equals the plugin's own picker on dev
{ const list = sets.dev.store.map((r, i) => ({ at: 1700000000000 + i, about: r.about, quote: r.quote, rule: r.rule, host: 'claude', src: 'live', project: key, origin: 'interactive-user', sessionId: 's' + i, _id: r.id })); let same = 0; for (const t of sets.dev.prompts) { const a = pickCorrections(list, t.prompt, Date.now(), undefined, key).map(x => x._id).join(), b = pick(sets.dev.store, t.prompt, 'V0').map(x => x.id).join(); if (a === b) same++ } console.log(`V0 reimplementation matches plugin on ${same}/${sets.dev.prompts.length} dev prompts`) }
const res = {}
for (const [name, { store, prompts }] of Object.entries(sets)) for (const v of ['V0', 'V1', 'V2']) { let hit = 0, cov = 0, picks = 0, rel = 0, noise = 0; const per = {}
  for (const p of prompts) { const ps = pick(store, p.prompt, v); if (ps.length) cov++; picks += ps.length; const r = ps.filter(x => x.category === p.category).length; rel += r; noise += ps.filter(x => x.category === 'noise').length; if (r) hit++; per[p.category] ??= [0, 0]; per[p.category][1]++; if (r) per[p.category][0]++ }
  res[`${name}/${v}`] = { n: prompts.length, hitRate: +(hit / prompts.length).toFixed(3), coverage: +(cov / prompts.length).toFixed(3), picks, precision: +(rel / picks).toFixed(3), noiseShare: +(noise / picks).toFixed(3), perCat: Object.entries(per).map(([k, v]) => k + ':' + v[0] + '/' + v[1]).join(' ') } }
console.table(Object.fromEntries(Object.entries(res).map(([k, v]) => [k, { n: v.n, hitRate: v.hitRate, coverage: v.coverage, picks: v.picks, precision: v.precision, noiseShare: v.noiseShare }])))
for (const k of Object.keys(res)) console.log(k.padEnd(11), res[k].perCat)
// adoption rule (fixed in plan)
for (const v of ['V1', 'V2']) { const ok = ['dev', 'holdout'].every(s => { const a = res[`${s}/V0`], b = res[`${s}/${v}`]; return b.hitRate - a.hitRate >= 0.05 && a.precision - b.precision <= 0.03 && b.noiseShare - a.noiseShare <= 0.03 }); console.log(`${v} satisfies the adoption rule on both sets: ${ok}`) }
fs.writeFileSync('eval-results.json', JSON.stringify(res, null, 1))
