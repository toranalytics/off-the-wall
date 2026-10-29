// Quotes shown on the 8 unrelated prompts, 150-record single store and 240-record repeat store, for the shipped selector (gate on/off).
import fs from 'node:fs'
import { pickCorrections } from '../../../src/similar.mjs'
import { projectKey } from '../../../src/scope.mjs'
const full = JSON.parse(fs.readFileSync(new URL('../exp5/store3.json', import.meta.url), 'utf8')), single = full.filter(r => !String(r.id).includes('-r'))
const key = projectKey('/tmp/otw-exp7n')
const mk = s => s.map((r, i) => ({ at: 1700000000000 + i * 1000, about: r.about, quote: r.quote, host: 'claude', src: 'live', project: key, origin: 'interactive-user', _id: r.id }))
const U = ['What is the capital of Mars?', 'Tell me a joke about penguins.', 'Explain how photosynthesis works.', 'Translate good morning into French.', 'Recommend a book about the Roman empire.', 'How tall is Mount Everest?', 'Write a haiku about autumn.', 'What should I cook tonight?']
for (const [name, store] of [['single 150', single], ['repeat 240', full]]) { const l = mk(store); for (const gate of [false, true]) console.log(name.padEnd(11), 'gate', String(gate).padEnd(5), 'mean quotes on unrelated', (U.reduce((a, p) => a + pickCorrections(l, p, 1.8e12, undefined, key, true, gate).length, 0) / U.length).toFixed(2)) }
