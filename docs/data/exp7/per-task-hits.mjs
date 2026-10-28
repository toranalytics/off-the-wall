import fs from 'node:fs'
import { pickCorrections } from '../../../src/similar.mjs'
import { projectKey } from '../../../src/scope.mjs'
import { TASKS } from '../exp4/tasks4.mjs'
const full = JSON.parse(fs.readFileSync(new URL('../exp5/store3.json', import.meta.url), 'utf8')), single = full.filter(r => !String(r.id).includes('-r'))
const key = projectKey('/tmp/otw-exp7'); const mk = s => s.map((r, i) => ({ at: 1700000000000 + i * 1000, about: r.about, quote: r.quote, host: 'claude', src: 'live', project: key, origin: 'interactive-user', _id: r.id }))
const kept = ['c006', 'c057', 'c082', 'c015', 'c114', 'c136', 'c124', 'c137', 'c104', 'c004', 'c033']
const l = mk(single); const rows = []
for (const t of TASKS) { const f = c => c._id === t.pref; const a = pickCorrections(l, t.prompt, 1800000000000, undefined, key, true, false), b = pickCorrections(l, t.prompt, 1800000000000, undefined, key, true, true); rows.push([t.pref, kept.includes(t.pref) ? 'kept' : '', a.some(f) ? 1 : 0, b.some(f) ? 1 : 0, a.length, b.length].join('\t')) }
console.log('pref\tkept\tV0hit\tV9hit\tV0n\tV9n'); console.log(rows.join('\n'))
