// OTW experiment 2: retrieval from a noisy history. Plan: artifacts/otw-experiment2-plan-2026-10-27.md
// node run-exp2.mjs --selftest | --stage pilot | --stage main      (resumable; re-run to continue)
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'; import { fileURLToPath, pathToFileURL } from 'node:url'
const D = path.dirname(fileURLToPath(import.meta.url)); const CL = path.join(D, '../claude-cli'); const CONFIG = path.join(CL, 'config'); const C = path.join(CL, 'node_modules/.bin/claude')
const W = path.join(CL, 'exp4/work'); const argv = process.argv.slice(2); const arg = n => argv[argv.indexOf(n) + 1]
const root = path.join(CONFIG, 'plugins/cache/off-the-wall/off-the-wall'); const src = path.join(root, fs.readdirSync(root)[0], 'src')
const { pickCorrections } = await import(pathToFileURL(path.join(src, 'similar.mjs')).href); const { projectKey } = await import(pathToFileURL(path.join(src, 'scope.mjs')).href)
const { TASKS } = await import(pathToFileURL(path.join(D, 'tasks4.mjs')).href); const STORE = JSON.parse(fs.readFileSync(path.join(D, '../otw-exp2/store/store.json'), 'utf8'))
const KEY = projectKey(W); const T0 = Date.now()
const rec = (r, i, over = {}) => ({ at: T0 - (STORE.length - i) * 3600000, about: r.about, quote: r.quote, rule: r.rule, host: 'claude', src: 'live', project: KEY, origin: 'interactive-user', sessionId: 's' + i, _id: r.id, _cat: r.category, ...over })
const FULL = STORE.map((r, i) => rec(r, i))
const picksFor = prompt => pickCorrections(FULL, prompt, Date.now(), 3, KEY)
const rng = seed => { let s = crypto.createHash('sha256').update(seed).digest().readUInt32LE(0); return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296 }
const ARMS = ['none', 'otw', 'random', 'rules', 'distilled']; const ABL = ['none', 'otw', 'otw_noask', 'ask_only']
function build(t, arm, rep) { // returns { otwHome, claudeMd, expectedIds }
  const h = path.join(D, '../claude-cli/exp4/otw', `${t.id}-${arm}-${rep}`); fs.rmSync(h, { recursive: true, force: true }); fs.mkdirSync(h, { recursive: true })
  const k = picksFor(t.prompt).length; let store = [], cfg = { capture: false, routing: false }, md = null, ids = []
  if (arm === 'none') cfg.recall = false
  else if (arm === 'otw' || arm === 'otw_noask' || arm === 'ask_only') { store = FULL; ids = picksFor(t.prompt).map(p => p._id) }
  else if (arm === 'distilled') { store = FULL.map(r => ({ ...r, quote: r.rule })); ids = picksFor(t.prompt).map(p => p._id) }
  else if (arm === 'random') { const g = rng(`${t.id}|${rep}`); const pool = [...FULL].sort(() => g() - 0.5).slice(0, k); store = pool.map(r => ({ ...r, about: t.prompt })); ids = pool.map(r => r._id) }
  else if (arm === 'rules') { cfg.recall = false; md = '# Working rules from past corrections\n' + STORE.map(r => `- ${r.rule}`).join('\n') + '\n' }
  fs.writeFileSync(path.join(h, 'corrections.jsonl'), store.map(r => JSON.stringify(r)).join('\n') + (store.length ? '\n' : '')); fs.writeFileSync(path.join(h, 'config.json'), JSON.stringify(cfg))
  return { h, md, ids }
}
const prep = (t, arm, rep) => { fs.rmSync(W, { recursive: true, force: true }); fs.mkdirSync(W, { recursive: true }); t.setup(W, rep); const b = build(t, arm, rep); if (b.md) fs.writeFileSync(path.join(W, 'CLAUDE.md'), b.md); return b }
function fisher(a, b, c, d) { const n = a + b + c + d, f = x => { let s = 0; for (let i = 2; i <= x; i++) s += Math.log(i); return s }; const p = (a, b, c, d) => Math.exp(f(a + b) + f(c + d) + f(a + c) + f(b + d) - f(n) - f(a) - f(b) - f(c) - f(d)); const o = p(a, b, c, d); let tot = 0; for (let x = Math.max(0, a - d); x <= Math.min(a + b, a + c); x++) { const q = p(x, a + b - x, a + c - x, d - (a - x)); if (q <= o + 1e-12) tot += q } return Math.min(1, tot) }
function signTest(wins, losses) { const n = wins + losses; if (!n) return 1; let p = 0; const lc = x => { let s = 0; for (let i = 2; i <= x; i++) s += Math.log(i); return s }; const pr = k => Math.exp(lc(n) - lc(k) - lc(n - k) - n * Math.log(2)); const o = pr(wins); for (let k = 0; k <= n; k++) if (pr(k) <= o + 1e-12) p += pr(k); return Math.min(1, p) }
if (argv.includes('--selftest')) {
  let bad = 0; const chk = (n, c) => { console.log((c ? 'ok   ' : 'FAIL ') + n); if (!c) bad++ }
  const hook = (t, h, extra = {}) => { const env = { ...process.env, OTW_HOME: h, CLAUDE_CONFIG_DIR: CONFIG }; const sid = crypto.randomUUID(); const run = (name) => spawnSync('node', [path.join(src, 'hook.mjs'), 'claude'], { cwd: W, env, input: JSON.stringify({ hook_event_name: name, session_id: sid, cwd: W, source: 'startup', prompt: t.prompt }), encoding: 'utf8' }).stdout || ''; run('SessionStart'); return run('UserPromptSubmit') }
  for (const t of TASKS) { const k = picksFor(t.prompt).length
    for (const arm of ARMS) { const b = prep(t, arm, 1); const out = hook(t, b.h); const has = out.includes('[off-the-wall]'); const n = (out.match(/\\"|"- /g) || []).length
      const expectBlock = (arm === 'otw' || arm === 'distilled' || arm === 'random') && k > 0
      chk(`${t.id.padEnd(22)} ${arm.padEnd(9)} block=${has} expected=${expectBlock}${arm === 'rules' ? ' claudeMd=' + fs.existsSync(path.join(W, 'CLAUDE.md')) : ''}`, has === expectBlock && (arm !== 'rules' || fs.existsSync(path.join(W, 'CLAUDE.md'))) && (arm === 'rules' || !fs.existsSync(path.join(W, 'CLAUDE.md')))) }
    const bd = prep(t, 'distilled', 1); const outD = hook(t, bd.h); if (k) { const p0 = picksFor(t.prompt)[0]; chk(`${t.id} distilled shows rule text, not quote`, outD.includes(p0.rule.slice(0, 25)) && !outD.includes(p0.quote.slice(0, 25))) }
    const br = prep(t, 'random', 1); const outR = hook(t, br.h); if (k) { let ctx = ''; try { ctx = JSON.parse(outR).hookSpecificOutput?.additionalContext || '' } catch {} const cnt = (ctx.match(/^- "/gm) || []).length; chk(`${t.id} random shows ${k} quotes`, cnt === k) } }
  console.log(bad ? `SELFTEST FAILED (${bad})` : 'SELFTEST PASSED'); process.exit(bad ? 1 : 0)
}
const stage = arg('--stage'); if (!['pilot', 'main'].includes(stage)) { console.log('use --selftest | --stage pilot | --stage main'); process.exit(1) }
const csv = path.join(D, `exp4-${stage}.csv`); if (!fs.existsSync(csv)) fs.writeFileSync(csv, 'rep,task,category,arm,k,pass,detail,expectedIds,seen,cost_usd,out_tokens,turns,seconds,subtype\n')
const done = new Set(fs.readFileSync(csv, 'utf8').split('\n').slice(1).filter(Boolean).map(l => l.split(',').slice(0, 4).join('|')))
let tasks = TASKS, arms = ['none'], reps = [1, 2, 3]
if (stage === 'main') { const kept = JSON.parse(fs.readFileSync(path.join(D, 'kept4.json'), 'utf8')); tasks = TASKS.filter(t => kept.includes(t.id)); arms = ARMS; reps = [4, 5, 6] }
let combos = []; for (const rep of reps) for (const t of tasks) for (const arm of arms) combos.push({ rep, t, arm }); const g = rng('order-' + stage); combos.sort(() => g() - 0.5)
const ALLOWED = 'Read,Edit,Write,Bash(node:*),Bash(wc:*),Bash(ls:*),Bash(cat:*),Bash(date:*),Bash(grep:*)'; let n = 0
for (const { rep, t, arm } of combos) {
  if (done.has(`${rep}|${t.id}|${t.category}|${arm}`)) continue; n++; const b = prep(t, arm, rep); const t0 = Date.now()
  const p = spawnSync(C, ['-p', t.prompt, '--model', 'haiku', '--output-format', 'stream-json', '--verbose', '--max-turns', '14', '--max-budget-usd', '0.15', '--permission-mode', 'acceptEdits', '--allowedTools', ALLOWED], { cwd: W, env: { ...process.env, OTW_HOME: b.h, CLAUDE_CONFIG_DIR: CONFIG, ...(arm === 'otw_noask' ? { OTW_EXP_ASK: 'noask' } : arm === 'ask_only' ? { OTW_EXP_ASK: 'ask_only' } : {}) }, encoding: 'utf8', timeout: 240000, maxBuffer: 1 << 27 })
  const ev = []; let res = {}; for (const l of (p.stdout || '').split('\n')) { try { const j = JSON.parse(l); if (j.type === 'assistant') for (const c of j.message?.content || []) if (c.type === 'tool_use') ev.push({ name: c.name, input: c.input }); if (j.type === 'result') res = j } catch {} }
  let seen = ''; if (res.session_id) { const proj = path.join(CONFIG, 'projects'); for (const dd of fs.existsSync(proj) ? fs.readdirSync(proj) : []) { const f = path.join(proj, dd, res.session_id + '.jsonl'); if (fs.existsSync(f)) { const tx = fs.readFileSync(f, 'utf8'); seen = tx.includes('[off-the-wall]') ? 1 : 0 } } }
  const sc = res.type === 'result' ? t.score(W, ev, String(res.result || '')) : { pass: false, detail: 'no-result(timeout/error)' }
  fs.appendFileSync(csv, [rep, t.id, t.category, arm, b.ids.length, sc.pass ? 1 : 0, JSON.stringify(sc.detail).replace(/[,\n]/g, ';'), b.ids.join('+'), seen, (res.total_cost_usd || 0).toFixed(4), res.usage?.output_tokens ?? '', res.num_turns ?? '', ((Date.now() - t0) / 1000).toFixed(0), res.subtype ?? ''].join(',') + '\n')
  console.log(`[${n}/${combos.length - done.size}] rep${rep} ${t.id} ${arm}: ${sc.pass ? 'PASS' : 'fail'} (${sc.detail.slice(0, 60)}) block=${seen}`)
}
const rows = fs.readFileSync(csv, 'utf8').split('\n').slice(1).filter(Boolean).map(l => l.split(',')); const by = {}
for (const [rep, task, cat, arm, k, pass] of rows) { by[task] ??= {}; by[task][arm] ??= [0, 0]; by[task][arm][0] += +pass; by[task][arm][1]++ }
const out = []
if (stage === 'pilot') { const kept = []; out.push('task,none_pass/n,keep(default fails in >=half)'); for (const [t, v] of Object.entries(by)) { const [p, nn] = v.none; const keep = (nn - p) / nn >= 0.5; if (keep) kept.push(t); out.push(`${t},${p}/${nn},${keep}`) } fs.writeFileSync(path.join(D, 'kept4.json'), JSON.stringify(kept)); out.push(`kept ${kept.length}/${Object.keys(by).length}: ${kept.join(' ')}`) }
else { const tot = {}; out.push('task,' + ARMS.join(',')); for (const [t, v] of Object.entries(by)) { out.push(`${t},` + ARMS.map(a => v[a] ? `${v[a][0]}/${v[a][1]}` : '-').join(',')); for (const a of ARMS) if (v[a]) { tot[a] ??= [0, 0]; tot[a][0] += v[a][0]; tot[a][1] += v[a][1] } }
  out.push('ALL,' + ARMS.map(a => tot[a] ? `${tot[a][0]}/${tot[a][1]}` : '-').join(','))
  const cmp = (x, y) => { let w = 0, l = 0, tie = 0; for (const v of Object.values(by)) { if (!v[x] || !v[y]) continue; const a = v[x][0] / v[x][1], b = v[y][0] / v[y][1]; if (a > b) w++; else if (a < b) l++; else tie++ } return `${x} vs ${y}: tasks better ${w}, worse ${l}, tied ${tie}; sign-test p=${signTest(w, l).toFixed(3)} | pooled ${tot[x]?.[0]}/${tot[x]?.[1]} vs ${tot[y]?.[0]}/${tot[y]?.[1]}` }
  out.push('', 'PRIMARY ' + cmp('otw', 'random'), cmp('otw', 'none'), cmp('otw', 'rules'), cmp('otw', 'distilled'), cmp('random', 'none')) }
fs.writeFileSync(path.join(D, `exp4-${stage}-summary.txt`), out.join('\n') + '\n'); console.log('\n' + out.join('\n'))
