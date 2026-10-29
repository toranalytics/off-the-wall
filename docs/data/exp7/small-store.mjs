// Offline, no model calls: how does recallGate behave when the store is small? (the unit tests flagged: <=20 records => a prompt needs two shared words)
// For each size N, 20 seeded random subsets of the 240-record repeat store that always contain the target preference family
// (>=1 record per task is guaranteed by sampling N-... see below). Metrics per N: target-in-picks (tasks) and quotes shown on unrelated prompts.
import fs from 'node:fs'
import crypto from 'node:crypto'
import { pickCorrections } from '../../../src/similar.mjs'
import { projectKey } from '../../../src/scope.mjs'
import { TASKS } from '../exp4/tasks4.mjs'
const full = JSON.parse(fs.readFileSync(new URL('../exp5/store3.json', import.meta.url), 'utf8'))
const key = projectKey('/tmp/otw-exp7s')
const rng = seed => { let s = crypto.createHash('sha256').update(seed).digest().readUInt32LE(0); return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296 }
const U = ['What is the capital of Mars?', 'Tell me a joke about penguins.', 'Explain how photosynthesis works.', 'Translate good morning into French.', 'Recommend a book about the Roman empire.', 'How tall is Mount Everest?', 'Write a haiku about autumn.', 'What should I cook tonight?']
const mk = s => s.map((r, i) => ({ at: 1700000000000 + i * 1000, about: r.about, quote: r.quote, host: 'claude', src: 'live', project: key, origin: 'interactive-user', _id: r.id }))
const fam = (c, pref) => c._id === pref || String(c._id).startsWith(pref + '-r')
const rows = {}
for (const N of [10, 20, 40, 80, 150, 240]) {
  const acc = { v0Hit: 0, gHit: 0, v0Noise: 0, gNoise: 0, n: 0, tasksWithTarget: 0 }
  for (let rep = 0; rep < 20; rep++) {
    const g = rng(`small-${N}-${rep}`); const sub = [...full].sort(() => g() - 0.5).slice(0, N); const list = mk(sub)
    for (const t of TASKS) {
      if (!sub.some(r => fam({ _id: r.id }, t.pref))) continue // target absent from this subset: nothing to retrieve
      acc.tasksWithTarget++
      acc.v0Hit += pickCorrections(list, t.prompt, 1.8e12, undefined, key, true, false).some(c => fam(c, t.pref)) ? 1 : 0
      acc.gHit += pickCorrections(list, t.prompt, 1.8e12, undefined, key, true, true).some(c => fam(c, t.pref)) ? 1 : 0
    }
    for (const p of U) { acc.v0Noise += pickCorrections(list, p, 1.8e12, undefined, key, true, false).length; acc.gNoise += pickCorrections(list, p, 1.8e12, undefined, key, true, true).length; acc.n++ }
  }
  rows[`N=${N}`] = { 'tasks with target in store': acc.tasksWithTarget, 'hit default': +(acc.v0Hit / acc.tasksWithTarget).toFixed(2), 'hit gate': +(acc.gHit / acc.tasksWithTarget).toFixed(2), 'quotes on unrelated default': +(acc.v0Noise / acc.n).toFixed(2), 'quotes on unrelated gate': +(acc.gNoise / acc.n).toFixed(2) }
}
console.table(rows)
