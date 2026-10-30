// Experiment 15 offline evaluation. Plan: plan-and-log.md. Run: node eval15.mjs
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url'
const D = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.join(D, '../../..'), src = path.join(ROOT, 'src')
const { pickCorrections, build, searchScored } = await import(pathToFileURL(path.join(src, 'similar.mjs')).href)
const { projectKey } = await import(pathToFileURL(path.join(src, 'scope.mjs')).href)
const { PREF } = await import(pathToFileURL(path.join(D, '../exp10/tasks10.mjs')).href)
const TAU = 0.30, QUOTES = 6, key = projectKey('/tmp/otw-exp15')
const store = JSON.parse(fs.readFileSync(path.join(D, '../exp5/store3.json'), 'utf8'))
const list = store.map((r, i) => ({ at: 1700000000000 + i * 1000, about: r.about, quote: r.quote, rule: r.rule, host: 'claude', src: 'live', project: key, origin: 'interactive-user', sessionId: 's' + i, _id: r.id }))
const fam = id => id.replace(/-r\d+$/, '')
// 1) family detection from quote text only
const qIndex = build(list.map(c => c.quote)), parent = list.map((_, i) => i)
const find = x => (parent[x] === x ? x : (parent[x] = find(parent[x])))
let linked = 0, linkedSame = 0
for (let i = 0; i < list.length; i++) for (const h of searchScored(qIndex, list[i].quote, TAU, 50)) if (h.i > i) { linked++; if (fam(list[i]._id) === fam(list[h.i]._id)) linkedSame++; parent[find(h.i)] = find(i) }
const members = new Map(); list.forEach((_, i) => { const r = find(i); (members.get(r) ?? members.set(r, []).get(r)).push(i) })
const repeats = list.map((c, i) => [c, i]).filter(([c]) => /-r\d+$/.test(c._id))
const repeatLinked = repeats.filter(([c, i]) => members.get(find(i)).some(j => list[j]._id === fam(c._id))).length
const purity = linked ? linkedSame / linked : 1, repeatRecall = repeatLinked / repeats.length
console.log(`family detection at TAU=${TAU}: linked pairs ${linked}, purity ${purity.toFixed(3)}; repeats linked to their original ${repeatLinked}/${repeats.length} (${repeatRecall.toFixed(3)})`)
// 2) policies
const aboutIndex = build(list.map(c => c.about)), idxOf = new Map(list.map((c, i) => [c._id, i]))
function f2(prompt, w) {
  const out = w.slice(), added = new Set(), famOK = new Set()
  const sim = searchScored(aboutIndex, prompt, 0, list.length), simOf = new Map(sim.map(x => [x.i, x.s]))
  for (const c of w.slice(0, 3)) {
    const i = idxOf.get(c._id), mem = members.get(find(i)).filter(j => list[j]._id !== c._id && !out.some(o => o._id === list[j]._id))
    if (!mem.length) continue
    mem.sort((a, b) => (simOf.get(b) ?? 0) - (simOf.get(a) ?? 0))
    const add = list[mem[0]]; out.splice(out.findIndex(o => o._id === c._id) + 1, 0, add); added.add(add._id); famOK.add(find(i))
  }
  while (out.length > QUOTES) { let k = out.length - 1; while (k > 0 && (added.has(out[k]._id) || famOK.has(find(idxOf.get(out[k]._id))))) k--; out.splice(k, 1) }
  return out
}
const rows = { W: [], F2: [] }; const now = Date.now()
for (const t of PREF) {
  const prefId = t.pref, w = pickCorrections(list, t.prompt, now, QUOTES, key, true), p2 = f2(t.prompt, w)
  for (const [name, picks] of [['W', w], ['F2', p2]]) { const fm = picks.filter(c => fam(c._id) === prefId).length; rows[name].push({ task: t.id, n: picks.length, fam: fm, nonTarget: picks.length - fm }) }
}
const sum = r => ({ hit: r.filter(x => x.fam >= 1).length, two: r.filter(x => x.fam >= 2).length, quotes: (r.reduce((a, x) => a + x.n, 0) / r.length).toFixed(2), nonTarget: (r.reduce((a, x) => a + x.nonTarget, 0) / r.length).toFixed(2) })
console.log('per task (target-family quotes shown):'); PREF.forEach((t, i) => console.log(`  ${t.id}: W ${rows.W[i].fam}  F2 ${rows.F2[i].fam}`))
const sW = sum(rows.W), sF = sum(rows.F2); console.log('W ', JSON.stringify(sW)); console.log('F2', JSON.stringify(sF))
const crit = [['purity >= 0.90', purity >= 0.9], ['repeat recall >= 0.80', repeatRecall >= 0.8], ['F2 two >= W two + 3', sF.two >= sW.two + 3], ['F2 hit >= W hit', sF.hit >= sW.hit], ['quotes per prompt <= 6', Number(sF.quotes) <= 6]]
for (const [n, ok] of crit) console.log((ok ? 'PASS ' : 'FAIL ') + n)
console.log(crit.every(c => c[1]) ? 'RESULT: criteria met' : 'RESULT: criteria NOT met')
