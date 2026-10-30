// Experiment 17 gate (offline, no model): can a judge model even be shown the right earlier correction?
// For each of the 90 repeat records, take the top-K other records by TF-IDF similarity of the quote text (product tokenizer) and check whether
// the repeat's own original or a sibling repeat is among them. This is an upper bound for any "judge marks a repeat" design that shows the judge K candidates.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url'
const D = path.dirname(fileURLToPath(import.meta.url)), src = path.join(D, '../../../src')
const { build, searchScored } = await import(pathToFileURL(path.join(src, 'similar.mjs')).href)
const store = JSON.parse(fs.readFileSync(path.join(D, '../exp5/store3.json'), 'utf8')), fam = id => id.replace(/-r\d+$/, '')
const qI = build(store.map(r => r.quote)), aI = build(store.map(r => r.about)), repeats = store.map((r, i) => [r, i]).filter(([r]) => /-r\d+$/.test(r.id))
for (const [name, idx, pick] of [['quote text', qI, r => r.quote], ['about text', aI, r => r.about], ['quote+about', null, null]]) {
  const out = []
  for (const K of [1, 3, 5]) {
    let ok = 0
    for (const [r, i] of repeats) {
      let hits
      if (idx) hits = searchScored(idx, pick(r), 0, K + 1).filter(h => h.i !== i).slice(0, K)
      else { const m = new Map(); for (const [ix, p] of [[qI, r.quote], [aI, r.about]]) for (const h of searchScored(ix, p, 0, 20)) if (h.i !== i) m.set(h.i, (m.get(h.i) ?? 0) + h.s); hits = [...m].map(([k, s]) => ({ i: k, s })).sort((a, b) => b.s - a.s).slice(0, K) }
      if (hits.some(h => fam(store[h.i].id) === fam(r.id))) ok++
    }
    out.push(`K=${K}: ${ok}/${repeats.length} (${(ok / repeats.length).toFixed(2)})`)
  }
  console.log(name.padEnd(12), out.join('  '))
}
