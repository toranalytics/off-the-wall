// The shipped recallGate (src/similar.mjs) must pick exactly what variant V9 picks in the frozen evaluator.
import fs from 'node:fs'
import { pickCorrections } from '../../../src/similar.mjs'
import { projectKey } from '../../../src/scope.mjs'
import { TASKS } from '../exp4/tasks4.mjs'
const J = f => JSON.parse(fs.readFileSync(new URL(f, import.meta.url), 'utf8'))
const full = J('../exp5/store3.json'), single = full.filter(r => !String(r.id).includes('-r'))
const key = projectKey('/tmp/otw-exp7')
const mk = s => s.map((r, i) => ({ at: 1700000000000 + i * 1000, about: r.about, quote: r.quote, host: 'claude', src: 'live', project: key, origin: 'interactive-user', _id: r.id }))
const U = ['What is the capital of Mars?', 'Tell me a joke about penguins.', 'Explain how photosynthesis works.', 'Translate good morning into French.', 'Recommend a book about the Roman empire.', 'How tall is Mount Everest?', 'Write a haiku about autumn.', 'What should I cook tonight?']
const prompts = [...TASKS.map(t => t.prompt), ...U, ...J('./prompts2.json').map(p => p.prompt)]
let n = 0, shown = 0
for (const [store, ps] of [[single, prompts], [full, prompts]]) { const l = mk(store); for (const p of ps) { const got = pickCorrections(l, p, 1800000000000, undefined, key, true, true); n++; shown += got.length } }
// NOISE on U with the shipped gate
const lu = mk(single); const noise = U.reduce((a, p) => a + pickCorrections(lu, p, 1800000000000, undefined, key, true, true).length, 0) / U.length
const hit = (list) => TASKS.filter(t => pickCorrections(list, t.prompt, 1800000000000, undefined, key, true, true).some(c => c._id === t.pref || String(c._id).startsWith(t.pref + '-r'))).length
console.log(`shipped gate: NOISE_U ${noise.toFixed(2)} HIT_single ${hit(mk(single))} HIT_repeat ${hit(mk(full))}  (V9 in the evaluator: 2.00, 11, 18)`)
