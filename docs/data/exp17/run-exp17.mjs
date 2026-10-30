// Experiment 17 runner. Plan: plan-and-log.md.   node run-exp17.mjs --selftest | --stage run (resumable)
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'; import { fileURLToPath, pathToFileURL } from 'node:url'
const D = path.dirname(fileURLToPath(import.meta.url)), src = path.join(D, '../../../src')
const CL = process.env.EXP10_CLI_DIR || '/Users/SJB/.aside/u/0/sessions/2026-10-22_0s8heOAE5qcpaKfV/tmp/claude-cli'
const CONFIG = path.join(CL, 'config'), CLAUDE = path.join(CL, 'node_modules/.bin/claude'), OTWH = path.join(CL, 'exp17/otw')
const { build, searchScored } = await import(pathToFileURL(path.join(src, 'similar.mjs')).href)
const argv = process.argv.slice(2), has = f => argv.includes(f), K = 5
const store = JSON.parse(fs.readFileSync(path.join(D, '../exp5/store3.json'), 'utf8')), fam = id => id.replace(/-r\d+$/, '')
const prefIds = new Set(store.filter(r => /-r\d+$/.test(r.id)).map(r => fam(r.id)))
const qI = build(store.map(r => r.quote)), aI = build(store.map(r => r.about))
function candidates(i) { const m = new Map(); for (const [ix, p] of [[qI, store[i].quote], [aI, store[i].about]]) for (const h of searchScored(ix, p, 0, 20)) if (h.i !== i) m.set(h.i, (m.get(h.i) ?? 0) + h.s); return [...m].map(([k, s]) => ({ k, s })).sort((a, b) => b.s - a.s).slice(0, K).map(x => x.k) }
const repeats = store.map((r, i) => i).filter(i => /-r\d+$/.test(store[i].id))
const controls = store.map((r, i) => i).filter(i => !prefIds.has(fam(store[i].id)) && !/-r\d+$/.test(store[i].id)).sort((a, b) => store[a].id.localeCompare(store[b].id)).slice(0, 90)
const rng = seed => { let s = crypto.createHash('sha256').update(seed).digest().readUInt32LE(0); return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296 }
const g = rng('order-exp17'), items = [...repeats.map(i => ({ i, kind: 'repeat' })), ...controls.map(i => ({ i, kind: 'control' }))].map(x => ({ ...x, o: g() })).sort((a, b) => a.o - b.o)
const prompt = (i, cands) => `A developer gave a coding assistant these earlier corrections:\n${cands.map((k, n) => `${n + 1}. ${JSON.stringify(store[k].quote)}`).join('\n')}\n\nNew correction: ${JSON.stringify(store[i].quote)}\n\nDoes the new correction repeat the same underlying preference as one of the earlier corrections? Same preference means the same kind of instruction about how the assistant should work, even if the wording and the topic differ. A different preference, or only a similar subject, does not count. Answer with only JSON: {"same_as": <number of the earlier correction, or null>}`
const bound = repeats.filter(i => candidates(i).some(k => fam(store[k].id) === fam(store[i].id))).length
if (has('--selftest')) {
  let bad = 0; const chk = (n, c) => { console.log((c ? 'ok   ' : 'FAIL ') + n); if (!c) bad++ }
  chk(`items ${items.length} (90 repeats, 90 controls)`, items.length === 180 && repeats.length === 90 && controls.length === 90)
  chk(`candidate ceiling ${bound}/90 matches the gate (73)`, bound === 73)
  chk('controls have no sibling in the store', controls.every(i => store.filter(r => fam(r.id) === fam(store[i].id)).length === 1))
  const p = prompt(items[0].i, candidates(items[0].i)); chk('prompt numbers 5 candidates', (p.match(/^\d\. /gm) || []).length === K)
  console.log(p.slice(0, 600)); console.log(bad ? 'SELFTEST FAILED' : 'SELFTEST PASSED'); process.exit(bad ? 1 : 0)
}
if (!has('--stage')) { console.log('use --selftest or --stage run'); process.exit(1) }
fs.mkdirSync(OTWH, { recursive: true }); fs.writeFileSync(path.join(OTWH, 'config.json'), JSON.stringify({ capture: false, recall: false, routing: false }))
const out = path.join(D, 'run.jsonl'), done = new Set(fs.existsSync(out) ? fs.readFileSync(out, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l).id) : [])
let n = 0
for (const it of items) {
  const id = store[it.i].id; if (done.has(id)) continue; n++
  const cands = candidates(it.i), p = spawnSync(CLAUDE, ['-p', prompt(it.i, cands), '--model', 'haiku', '--output-format', 'json', '--max-turns', '1'], { env: { ...process.env, CLAUDE_CONFIG_DIR: CONFIG, OTW_HOME: OTWH }, encoding: 'utf8', timeout: 90000 })
  let res = {}; try { res = JSON.parse(p.stdout) } catch {}
  if (res.type !== 'result' || /Not logged in/i.test(String(res.result || ''))) { console.log(`STOP: no usable result (${String(res.result || p.stderr || 'no output').slice(0, 120)}). Fix the login and run again.`); process.exit(3) }
  const m = String(res.result || '').match(/"same_as"\s*:\s*(null|\d+)/), pick = m && m[1] !== 'null' ? Number(m[1]) : null, linked = pick && cands[pick - 1] != null ? cands[pick - 1] : null
  fs.appendFileSync(out, JSON.stringify({ id, kind: it.kind, cands: cands.map(k => store[k].id), answer: String(res.result || '').slice(0, 80), parsed: !!m, linkedTo: linked != null ? store[linked].id : null, correct: linked != null && fam(store[linked].id) === fam(id), cost: res.total_cost_usd }) + '\n')
  if (n % 20 === 0) console.log(`${n} calls`)
}
const rows = fs.readFileSync(out, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)), links = rows.filter(r => r.linkedTo), good = links.filter(r => r.correct)
const rep = rows.filter(r => r.kind === 'repeat'), ctl = rows.filter(r => r.kind === 'control')
const precision = links.length ? good.length / links.length : 1, recall = rep.filter(r => r.correct).length / 90, falseLinks = ctl.filter(r => r.linkedTo).length
const lines = [`items ${rows.length}; unparsed answers ${rows.filter(r => !r.parsed).length}; cost USD ${rows.reduce((a, r) => a + (r.cost || 0), 0).toFixed(3)}`, `links made ${links.length}; precision ${precision.toFixed(3)}; recall ${recall.toFixed(3)} (ceiling ${(bound / 90).toFixed(2)}); false links on controls ${falseLinks}/90`, `criteria: precision >= 0.95 ${precision >= 0.95 ? 'PASS' : 'FAIL'}; recall >= 0.65 ${recall >= 0.65 ? 'PASS' : 'FAIL'}; false links <= 3 ${falseLinks <= 3 ? 'PASS' : 'FAIL'}`, (precision >= 0.95 && recall >= 0.65 && falseLinks <= 3) ? 'RESULT: criteria met' : 'RESULT: criteria NOT met']
fs.writeFileSync(path.join(D, 'run-summary.txt'), lines.join('\n')); console.log('\n' + lines.join('\n'))
