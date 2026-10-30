// Experiment 16 runner (copy of the experiment 12 runner: model haiku, arms v0 current wording, v1 standing-preference wording, v2 check wording; preference tasks only). Plan: plan-and-log.md.
//   node run-exp16.mjs --selftest   (no model calls)
//   node run-exp16.mjs --stage run  (99 model runs, resumable: run again to continue)
// Needs the isolated Claude CLI and plugin test copy under CL below (logged in by the account owner).
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'; import { fileURLToPath, pathToFileURL } from 'node:url'
const D = path.dirname(fileURLToPath(import.meta.url))
const CL = process.env.EXP10_CLI_DIR || '/Users/SJB/.aside/u/0/sessions/2026-10-22_0s8heOAE5qcpaKfV/tmp/claude-cli'
const CONFIG = path.join(CL, 'config'), CLAUDE = path.join(CL, 'node_modules/.bin/claude'), W = path.join(CL, 'exp16/work')
const cacheRoot = path.join(CONFIG, 'plugins/cache/off-the-wall/off-the-wall')
const CACHE_SRC = path.join(cacheRoot, fs.readdirSync(cacheRoot).filter(n => !n.startsWith('.'))[0], 'src')
const argv = process.argv.slice(2), arg = n => argv[argv.indexOf(n) + 1]
const { pickCorrections } = await import(pathToFileURL(path.join(CACHE_SRC, 'similar.mjs')).href)
const { projectKey } = await import(pathToFileURL(path.join(CACHE_SRC, 'scope.mjs')).href)
const { PREF, DISTRACTORS } = await import(pathToFileURL(path.join(D, '../exp10/tasks10.mjs')).href); const TASKS = PREF, HARM = []
const STORE = JSON.parse(fs.readFileSync(path.join(D, '../exp5/store3.json'), 'utf8'))
const KEY = projectKey(W), T0 = Date.now()
const rec = (r, i, n) => ({ at: T0 - (n - i) * 3600000, about: r.about, quote: r.quote, host: 'claude', src: 'live', project: KEY, origin: 'interactive-user', sessionId: 's' + i, _id: r.id })
const PREF_STORE = STORE.map((r, i) => rec(r, i, STORE.length))
const harmStore = t => { const rows = [...t.store, ...DISTRACTORS.map(id => STORE.find(r => r.id === id))]; return rows.map((r, i) => rec(r, i, rows.length)) }
const storeFor = t => t.category === 'harm' ? harmStore(t) : PREF_STORE
const rng = seed => { let s = crypto.createHash('sha256').update(seed).digest().readUInt32LE(0); return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296 }
const armsFor = t => ['v0', 'v1', 'v2']
const FRAME = { v0: '', v1: 'standing', v2: 'check' }

function build(t, arm, rep) {
  const h = path.join(CL, 'exp16/otw', `${t.id}-${arm}-${rep}`); fs.rmSync(h, { recursive: true, force: true }); fs.mkdirSync(h, { recursive: true })
  const store = storeFor(t), cfg = { capture: false, routing: false, ...(arm === 'none' ? { recall: false } : {}) }
  fs.writeFileSync(path.join(h, 'corrections.jsonl'), store.map(r => JSON.stringify(r)).join('\n') + '\n'); fs.writeFileSync(path.join(h, 'config.json'), JSON.stringify(cfg))
  return { h, ids: arm === 'none' ? [] : pickCorrections(store, t.prompt, Date.now(), undefined, KEY, true).map(c => c._id) }
}
const prep = (t, arm, rep) => { fs.rmSync(W, { recursive: true, force: true }); fs.mkdirSync(W, { recursive: true }); t.setup(W, rep); return build(t, arm, rep) }
const hookEnv = (h, arm) => ({ ...process.env, OTW_HOME: h, CLAUDE_CONFIG_DIR: CONFIG, ...(FRAME[arm] ? { OTW_EXP_FRAME: FRAME[arm] } : {}) })
function hookOut(t, arm, h) {
  const sid = crypto.randomUUID(), call = name => spawnSync('node', [path.join(CACHE_SRC, 'hook.mjs'), 'claude'], { cwd: W, env: hookEnv(h, arm), input: JSON.stringify({ hook_event_name: name, session_id: sid, cwd: W, source: 'startup', prompt: t.prompt }), encoding: 'utf8' }).stdout || ''
  call('SessionStart'); return call('UserPromptSubmit')
}

if (argv.includes('--selftest')) {
  let bad = 0; const chk = (n, c) => { console.log((c ? 'ok   ' : 'FAIL ') + n); if (!c) bad++ }
  chk('test copy present', fs.existsSync(path.join(CACHE_SRC, 'hook.mjs')))
  for (const t of TASKS) for (const arm of armsFor(t)) {
    const b = prep(t, arm, 1), out = hookOut(t, arm, b.h), has = out.includes('[off-the-wall]'), about = out.includes('said in reply to the request')
    const ko = /[가-힣]/.test(t.prompt); const fr = ko ? (arm === 'v1' ? out.includes('전에 밝힌 습관') : arm === 'v2' ? out.includes('하나씩 대조하고') : out.includes('지적할지 한 줄로 예측')) : (arm === 'v1' ? out.includes('Standing preferences') : arm === 'v2' ? out.includes('check the answer you are about to give') : out.includes('predict in one line')); const safe = out.includes(ko ? '안전 규칙을 우선한다' : 'safety rules take precedence'); chk(`${t.id.padEnd(16)} ${arm.padEnd(4)} block=${has} frame-ok=${fr} safety-line=${safe}`, has && fr && safe && !about)
  }
  for (const t of HARM) {
    t.setup(W, 1); const none = t.score(W, [], ''); chk(`${t.id} untouched fails`, t.id === 'h-explain-retry' ? true : !none.pass)
    fs.rmSync(W, { recursive: true, force: true }); fs.mkdirSync(W, { recursive: true }); t.setup(W, 1); const g = t.good(W); chk(`${t.id} known-good passes`, t.score(W, [], g.text || '').pass)
    fs.rmSync(W, { recursive: true, force: true }); fs.mkdirSync(W, { recursive: true }); t.setup(W, 1); const b = t.bad(W); chk(`${t.id} known-bad fails`, !t.score(W, [], b.text || '').pass)
  }
  for (const t of PREF) {
    fs.rmSync(W, { recursive: true, force: true }); fs.mkdirSync(W, { recursive: true }); t.setup(W, 1); const g = t.good(W); chk(`${t.id} known-good passes`, t.score(W, g.ev || [], g.text || '').pass)
    fs.rmSync(W, { recursive: true, force: true }); fs.mkdirSync(W, { recursive: true }); t.setup(W, 1); const b = t.bad(W); chk(`${t.id} known-bad fails`, !t.score(W, b.ev || [], b.text || '').pass)
  }
  console.log(bad ? `SELFTEST FAILED: ${bad}` : 'SELFTEST PASSED'); process.exit(bad ? 1 : 0)
}

if (arg('--stage') !== 'run') { console.log('use --selftest or --stage run'); process.exit(1) }
const csv = path.join(D, 'run.csv'); if (!fs.existsSync(csv)) fs.writeFileSync(csv, 'rep,task,category,arm,k,pass,detail,expectedIds,seen,about_seen,cost_usd,out_tokens,turns,seconds,subtype\n')
const done = new Set(fs.readFileSync(csv, 'utf8').split('\n').slice(1).filter(Boolean).map(l => l.split(',').slice(0, 4).join('|')))
const combos = []; for (const rep of [1, 2, 3]) for (const t of TASKS) for (const arm of armsFor(t)) combos.push({ rep, t, arm })
const g = rng('order-exp12'); combos.sort(() => g() - 0.5)
const ALLOWED = 'Read,Edit,Write,Bash(node:*),Bash(wc:*),Bash(ls:*),Bash(cat:*),Bash(date:*),Bash(grep:*)'; let n = 0
for (const { rep, t, arm } of combos) {
  if (done.has(`${rep}|${t.id}|${t.category}|${arm}`)) continue; n++
  const b = prep(t, arm, rep), t0 = Date.now()
  const p = spawnSync(CLAUDE, ['-p', t.prompt, '--model', process.env.EXP16_MODEL || 'haiku', '--output-format', 'stream-json', '--verbose', '--max-turns', '14', '--max-budget-usd', '0.6', '--permission-mode', 'acceptEdits', '--allowedTools', ALLOWED], { cwd: W, env: hookEnv(b.h, arm), encoding: 'utf8', timeout: 240000, maxBuffer: 1 << 27 })
  const ev = []; let res = {}
  for (const l of (p.stdout || '').split('\n')) { try { const j = JSON.parse(l); if (j.type === 'assistant') for (const c of j.message?.content || []) if (c.type === 'tool_use') ev.push({ name: c.name, input: c.input }); if (j.type === 'result') res = j } catch {} }
  if (res.type !== 'result' || /Not logged in/i.test(String(res.result || ''))) { console.log(`STOP: no usable result (${String(res.result || p.stderr || 'no output').slice(0, 120)}). Fix the login and run again; nothing was recorded for this run.`); process.exit(3) }
  let seen = '', aboutSeen = ''
  if (res.session_id) { const proj = path.join(CONFIG, 'projects'); for (const dd of fs.existsSync(proj) ? fs.readdirSync(proj) : []) { const f = path.join(proj, dd, res.session_id + '.jsonl'); if (fs.existsSync(f)) { const tx = fs.readFileSync(f, 'utf8'); seen = tx.includes('[off-the-wall]') ? 1 : 0; aboutSeen = tx.includes('said in reply to the request') ? 1 : 0 } } }
  const sc = t.score(W, ev, String(res.result || ''))
  fs.appendFileSync(csv, [rep, t.id, t.category, arm, b.ids.length, sc.pass ? 1 : 0, JSON.stringify(sc.detail).replace(/[,\n]/g, ';'), b.ids.join('+'), seen, aboutSeen, (res.total_cost_usd || 0).toFixed(4), res.usage?.output_tokens ?? '', res.num_turns ?? '', ((Date.now() - t0) / 1000).toFixed(0), res.subtype ?? ''].join(',') + '\n')
  console.log(`[${n}/${combos.length - done.size}] rep${rep} ${t.id} ${arm}: ${sc.pass ? 'PASS' : 'fail'} (${sc.detail.slice(0, 60)}) block=${seen} about=${aboutSeen}`)
}
// Summary
const rows = fs.readFileSync(csv, 'utf8').split('\n').slice(1).filter(Boolean).map(l => l.split(','))
const first = new Map(); for (const x of rows) { const k = `${x[0]}|${x[1]}|${x[3]}`; if (!first.has(k)) first.set(k, x) }
const ARMS = ['v0', 'v1', 'v2'], by = {}, tot = Object.fromEntries(ARMS.map(a => [a, [0, 0]])), tok = Object.fromEntries(ARMS.map(a => [a, []]))
for (const x of first.values()) { by[x[1]] ??= {}; by[x[1]][x[3]] ??= [0, 0]; by[x[1]][x[3]][0] += +x[5]; by[x[1]][x[3]][1]++; tot[x[3]][0] += +x[5]; tot[x[3]][1]++; if (x[11]) tok[x[3]].push(+x[11]) }
const sign = (a, b) => { const n = a + b; if (!n) return 1; const lc = x => { let s = 0; for (let i = 2; i <= x; i++) s += Math.log(i); return s }, pr = k => Math.exp(lc(n) - lc(k) - lc(n - k) - n * Math.log(2)), o = pr(a); let p = 0; for (let k = 0; k <= n; k++) if (pr(k) <= o + 1e-12) p += pr(k); return Math.min(1, p) }
const out = ['task,v0,v1,v2']; for (const [t, v] of Object.entries(by)) out.push([t, ...ARMS.map(a => v[a]?.join('/'))].join(','))
out.push('', ARMS.map(a => `${a} ${tot[a].join('/')}`).join(', '))
for (const a of ['v1', 'v2']) { let w = 0, l = 0, tie = 0; for (const v of Object.values(by)) { const x = v[a]?.[0] ?? 0, y = v.v0?.[0] ?? 0; if (x > y) w++; else if (x < y) l++; else tie++ } const d = tot[a][0] - tot.v0[0]; out.push(`${a} vs v0: passes ${d >= 0 ? '+' : ''}${d}; per task better ${w}, worse ${l}, tied ${tie}; sign test p=${sign(w, l).toFixed(3)}; criterion (+5 passes, better >= 3, worse <= 1): ${d >= 5 && w >= 3 && l <= 1 ? 'MET' : 'NOT MET'}`) }
out.push('mean output tokens: ' + ARMS.map(a => `${a} ${tok[a].length ? Math.round(tok[a].reduce((p, q) => p + q, 0) / tok[a].length) : '-'}`).join(', '))
fs.writeFileSync(path.join(D, 'run-summary.txt'), out.join('\n')); console.log('\n' + out.join('\n'))
