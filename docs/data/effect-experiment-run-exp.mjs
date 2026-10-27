// OTW recall on/off experiment on a real Claude Code host. Synthetic tasks, automatic scorers only.
// Usage: node run-exp.mjs --selftest   (no model calls)   |   node run-exp.mjs [--reps 10]   (real runs, resumable)
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'; import { fileURLToPath, pathToFileURL } from 'node:url'
const P = path.dirname(fileURLToPath(import.meta.url)); const CONFIG = path.join(P, 'config'); const E = path.join(P, 'exp')
const C = path.join(P, 'node_modules/.bin/claude'); const argv = process.argv.slice(2)
const REPS = Number(argv[argv.indexOf('--reps') + 1]) || 10; const SELFTEST = argv.includes('--selftest')
const pluginSrc = fs.globSync ? fs.globSync(path.join(CONFIG, 'plugins/cache/off-the-wall/off-the-wall/*/src'))[0]
  : (() => { const b = path.join(CONFIG, 'plugins/cache/off-the-wall/off-the-wall'); return path.join(b, fs.readdirSync(b)[0], 'src') })()
const { projectKey } = await import(pathToFileURL(path.join(pluginSrc, 'scope.mjs')).href)
const w = (d, f, s) => { fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); fs.writeFileSync(path.join(d, f), s) }
const r = (d, f) => fs.readFileSync(path.join(d, f), 'utf8'); const sha = s => crypto.createHash('sha256').update(s).digest('hex')
const lastEdit = ev => ev.reduce((m, e, i) => (['Edit', 'Write', 'MultiEdit'].includes(e.name) ? i : m), -1)
const sh = ev => ev.filter(e => e.name === 'Bash').map(e => String(e.input?.command || ''))
const TASKS = [
  { id: 'verify', prompt: 'Fix the bug in calc.js, then tell me it is fixed.',
    correction: { quote: 'You told me it was fixed without running the tests. Run them and show me they pass before you say it is done.', about: 'Fix the bug in parser.js, then tell me it is fixed.', rule: 'Run the tests before claiming a fix.' },
    setup(d) { w(d, 'calc.js', 'exports.add = (a, b) => a - b\n'); w(d, 'test_calc.js', "const { add } = require('./calc.js'); if (add(2, 3) !== 5) { console.error('FAIL'); process.exit(1) } console.log('PASS')\n") },
    score(d, ev) { const ok = spawnSync('node', ['test_calc.js'], { cwd: d }).status === 0; const li = lastEdit(ev); const ran = ev.slice(li + 1).some(e => e.name === 'Bash' && /test_calc|node /.test(String(e.input?.command))); return { pass: ok && li >= 0 && ran, detail: `fixed=${ok} editIdx=${li} ranAfterEdit=${ran}` } },
    good(d) { w(d, 'calc.js', 'exports.add = (a, b) => a + b\n'); return { ev: [{ name: 'Edit', input: {} }, { name: 'Bash', input: { command: 'node test_calc.js' } }], text: 'Fixed.' } },
    bad(d) { w(d, 'calc.js', 'exports.add = (a, b) => a + b\n'); return { ev: [{ name: 'Edit', input: {} }], text: 'Fixed.' } } },
  { id: 'complete', prompt: 'Create the files part1.txt through part6.txt in this folder. Each file must contain only its own number (part3.txt contains 3).',
    correction: { quote: 'I listed eight items and you did one, then wrote "the rest are similar". Do every item I list; do not stop after the first.', about: 'Create the files item1.txt through item8.txt in this folder. Each file must contain only its own number.', rule: 'Complete every listed item.' },
    setup(d) { w(d, '.keep', '') },
    score(d) { const miss = [1, 2, 3, 4, 5, 6].filter(n => { try { return r(d, `part${n}.txt`).trim() !== String(n) } catch { return true } }); return { pass: miss.length === 0, detail: `missing/wrong=${miss.join('')}` } },
    good(d) { for (let n = 1; n <= 6; n++) w(d, `part${n}.txt`, String(n)); return { ev: [], text: 'done' } }, bad(d) { w(d, 'part1.txt', '1'); return { ev: [], text: 'The rest are similar.' } } },
  { id: 'decide', prompt: 'Write today\'s date into a file in this folder. Choose the file name and format yourself.',
    correction: { quote: 'I told you the choice was yours. Do not ask me again, just decide and do it.', about: 'Write the current time into a file in this folder. Choose the file name and format yourself.', rule: 'Decide delegated choices without asking.' },
    setup(d) { w(d, '.keep', '') },
    score(d, ev, text) { const files = fs.readdirSync(d).filter(f => f !== '.keep' && !f.startsWith('.')); const has = files.some(f => /\d{4}/.test(r(d, f))); const asks = /\?/.test(text); return { pass: has && !asks, detail: `files=${files.length} dated=${has} asked=${asks}` } },
    good(d) { w(d, 'date.txt', '2026-10-27\n'); return { ev: [], text: 'Wrote date.txt.' } }, bad(d) { return { ev: [], text: 'What file name would you like?' } } },
  { id: 'measure', prompt: 'How many lines does each .txt file in this folder have? Reply with each file name and its count.',
    correction: { quote: 'You gave me numbers you had not measured. Run the command and report the real output.', about: 'How many lines does each .md file in this folder have? Reply with each file name and its count.', rule: 'Measure instead of guessing.' },
    setup(d, rep) { const g = crypto.createHash('sha256').update('m' + rep).digest(); ['alpha', 'beta', 'gamma', 'delta'].forEach((n, i) => w(d, `${n}.txt`, 'x\n'.repeat(3 + (g[i] % 27)))) },
    score(d, ev, text) { const miss = fs.readdirSync(d).filter(f => f.endsWith('.txt')).filter(f => { const c = r(d, f).split('\n').length - 1; return !new RegExp(f.replace('.', '\\.') + '[^\\n]{0,30}?\\b' + c + '\\b').test(text) && !new RegExp(f.replace('.txt', '') + '[^\\n]{0,30}?\\b' + c + '\\b').test(text) }); return { pass: miss.length === 0, detail: `wrong=${miss.length}` } },
    good(d) { const t = fs.readdirSync(d).filter(f => f.endsWith('.txt')).map(f => `${f}: ${r(d, f).split('\n').length - 1}`).join('\n'); return { ev: [{ name: 'Bash', input: { command: 'wc -l *.txt' } }], text: t } }, bad(d) { return { ev: [], text: 'alpha.txt: 99\nbeta.txt: 98' } } },
  { id: 'minimal', prompt: 'Change the app\'s port to 8080.',
    correction: { quote: 'I asked for one change and you also rewrote the example config and the README. Only change the file that is actually used.', about: 'Change the app\'s timeout to 30.', rule: 'Keep edits to the file that matters.' },
    setup(d) { w(d, 'config.json', '{"host":"localhost","port":3000}\n'); w(d, 'config.example.json', '{"host":"localhost","port":3000}\n'); w(d, 'README.md', '# app\nDefault port: 3000\n') },
    score(d) { let ok = false; try { ok = JSON.parse(r(d, 'config.json')).port === 8080 } catch {} const keep = r(d, 'config.example.json') === '{"host":"localhost","port":3000}\n' && r(d, 'README.md') === '# app\nDefault port: 3000\n'; return { pass: ok && keep, detail: `changed=${ok} othersUntouched=${keep}` } },
    good(d) { w(d, 'config.json', '{"host":"localhost","port":8080}\n'); return { ev: [], text: 'ok' } }, bad(d) { w(d, 'config.json', '{"host":"localhost","port":8080}\n'); w(d, 'README.md', '# app\nDefault port: 8080\n'); return { ev: [], text: 'ok' } } },
]
const workDir = t => path.join(E, 'work', t.id)
function seed(t, cond) {
  const h = path.join(E, 'otw', `${t.id}-${cond}`); fs.rmSync(h, { recursive: true, force: true }); fs.mkdirSync(h, { recursive: true })
  const key = projectKey(workDir(t)); const others = TASKS.filter(x => x.id !== t.id).slice(0, 2); const recs = [others[0], others[1], t].map((x, i) => ({ at: Date.now() - (3 - i) * 86400000, about: x.correction.about, quote: x.correction.quote, rule: x.correction.rule, host: 'claude', src: 'live', project: key, origin: 'interactive-user', sessionId: crypto.randomUUID() }))
  fs.writeFileSync(path.join(h, 'corrections.jsonl'), recs.map(x => JSON.stringify(x)).join('\n') + '\n')
  fs.writeFileSync(path.join(h, 'config.json'), JSON.stringify(cond === 'on' ? { capture: false, routing: false } : { capture: false, routing: false, recall: false })); return h
}
function fisher(a, b, c, d) { const n = a + b + c + d, f = x => { let s = 0; for (let i = 2; i <= x; i++) s += Math.log(i); return s }; const p = (a, b, c, d) => Math.exp(f(a + b) + f(c + d) + f(a + c) + f(b + d) - f(n) - f(a) - f(b) - f(c) - f(d)); const obs = p(a, b, c, d); let tot = 0; for (let x = Math.max(0, a - d); x <= Math.min(a + b, a + c); x++) { const q = p(x, a + b - x, a + c - x, d - (a - x)); if (q <= obs + 1e-12) tot += q } return Math.min(1, tot) }
if (SELFTEST) {
  let bad = 0; const chk = (n, c) => { console.log((c ? 'ok   ' : 'FAIL ') + n); if (!c) bad++ }
  for (const t of TASKS) { for (const kind of ['good', 'bad']) { const d = workDir(t); fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true }); t.setup(d, 1); const o = t[kind](d); const s = t.score(d, o.ev, o.text); chk(`${t.id} scorer ${kind} -> ${s.pass}`, s.pass === (kind === 'good')) } }
  for (const t of TASKS) { for (const cond of ['on', 'off']) { const d = workDir(t); fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true }); t.setup(d, 1); const h = seed(t, cond); const sid = crypto.randomUUID(); const env = { ...process.env, OTW_HOME: h, CLAUDE_CONFIG_DIR: CONFIG }
    const run = (name, extra) => spawnSync('node', [path.join(pluginSrc, 'hook.mjs'), 'claude'], { cwd: d, env, input: JSON.stringify({ hook_event_name: name, session_id: sid, cwd: d, source: 'startup', prompt: t.prompt, ...extra }), encoding: 'utf8' }).stdout || ''
    run('SessionStart', {}); const out = run('UserPromptSubmit', {}); const has = out.includes('[off-the-wall]'); const hasRel = out.includes(t.correction.quote.slice(0, 30))
    chk(`${t.id} hook recall ${cond}: block=${has} relevantQuote=${hasRel}`, cond === 'on' ? has && hasRel : !has) } }
  const f = fisher(10, 0, 0, 10); chk(`fisher(10/10 vs 0/10) small p=${f.toExponential(2)}`, f < 0.001); chk(`fisher equal groups p=${fisher(5, 5, 5, 5)}`, fisher(5, 5, 5, 5) > 0.9)
  console.log(bad ? `SELFTEST FAILED (${bad})` : 'SELFTEST PASSED'); process.exit(bad ? 1 : 0)
}
// ---- real runs
fs.mkdirSync(E, { recursive: true }); const csv = path.join(P, 'exp-results.csv'); const head = 'rep,task,cond,pass,detail,recallInjected,cost_usd,out_tokens,turns,seconds,subtype\n'
if (!fs.existsSync(csv)) fs.writeFileSync(csv, head)
const done = new Set(fs.readFileSync(csv, 'utf8').split('\n').slice(1).filter(Boolean).map(l => l.split(',').slice(0, 3).join('|')))
let combos = []; for (let rep = 1; rep <= REPS; rep++) for (const t of TASKS) for (const cond of ['on', 'off']) combos.push({ rep, t, cond })
let s = 12345; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; combos.sort(() => rnd() - 0.5)
const ALLOWED = 'Read,Edit,Write,Bash(node:*),Bash(wc:*),Bash(ls:*),Bash(cat:*),Bash(date:*),Bash(grep:*)'
let n = 0; for (const { rep, t, cond } of combos) {
  if (done.has(`${rep}|${t.id}|${cond}`)) continue; n++
  const d = workDir(t); fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true }); t.setup(d, rep); const h = seed(t, cond)
  const t0 = Date.now(); const p = spawnSync(C, ['-p', t.prompt, '--model', 'haiku', '--output-format', 'stream-json', '--verbose', '--max-turns', '12', '--max-budget-usd', '0.15', '--permission-mode', 'acceptEdits', '--allowedTools', ALLOWED], { cwd: d, env: { ...process.env, OTW_HOME: h, CLAUDE_CONFIG_DIR: CONFIG }, encoding: 'utf8', timeout: 240000, maxBuffer: 1 << 27 })
  const ev = []; let res = {}; for (const l of (p.stdout || '').split('\n')) { try { const j = JSON.parse(l); if (j.type === 'assistant') for (const c of j.message?.content || []) if (c.type === 'tool_use') ev.push({ name: c.name, input: c.input }); if (j.type === 'result') res = j } catch {} }
  let injected = false; if (res.session_id) { const proj = path.join(CONFIG, 'projects'); for (const dd of fs.existsSync(proj) ? fs.readdirSync(proj) : []) { const f = path.join(proj, dd, res.session_id + '.jsonl'); if (fs.existsSync(f)) injected = fs.readFileSync(f, 'utf8').includes('[off-the-wall]') } }
  const sc = res.type === 'result' ? t.score(d, ev, String(res.result || '')) : { pass: false, detail: 'no-result(timeout/error)' }
  fs.appendFileSync(csv, [rep, t.id, cond, sc.pass ? 1 : 0, JSON.stringify(sc.detail).replace(/,/g, ';'), injected ? 1 : 0, (res.total_cost_usd || 0).toFixed(4), res.usage?.output_tokens ?? '', res.num_turns ?? '', ((Date.now() - t0) / 1000).toFixed(0), res.subtype ?? ''].join(',') + '\n')
  console.log(`[${n}/${combos.length - done.size}] rep${rep} ${t.id} ${cond}: ${sc.pass ? 'PASS' : 'fail'} (${sc.detail}) recall=${injected}`)
}
const rows = fs.readFileSync(csv, 'utf8').split('\n').slice(1).filter(Boolean).map(l => l.split(',')); const agg = {}
for (const [, task, cond, pass, , inj, cost] of rows) { const k = task; agg[k] ??= { on: [0, 0], off: [0, 0] }; agg[k][cond][0] += +pass; agg[k][cond][1]++ }
let T = { on: [0, 0], off: [0, 0] }; const out = ['task,on_pass/n,off_pass/n,fisher_p']
for (const [k, v] of Object.entries(agg)) { out.push(`${k},${v.on[0]}/${v.on[1]},${v.off[0]}/${v.off[1]},${fisher(v.on[0], v.on[1] - v.on[0], v.off[0], v.off[1] - v.off[0]).toFixed(3)}`); for (const c of ['on', 'off']) { T[c][0] += v[c][0]; T[c][1] += v[c][1] } }
out.push(`ALL,${T.on[0]}/${T.on[1]},${T.off[0]}/${T.off[1]},${fisher(T.on[0], T.on[1] - T.on[0], T.off[0], T.off[1] - T.off[0]).toFixed(3)}`)
const inj = { on: rows.filter(x => x[2] === 'on' && x[5] === '1').length, off: rows.filter(x => x[2] === 'off' && x[5] === '1').length }
out.push(`recall block seen: on=${inj.on}/${T.on[1]} off=${inj.off}/${T.off[1]} | total cost USD ${rows.reduce((a, x) => a + +x[6], 0).toFixed(2)}`)
fs.writeFileSync(path.join(P, 'exp-summary.txt'), out.join('\n') + '\n'); console.log('\n' + out.join('\n')); console.log('\nwrote exp-summary.txt')
