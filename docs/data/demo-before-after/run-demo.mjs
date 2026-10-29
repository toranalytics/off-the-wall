// Side-by-side demo: the same request run twice with the real plugin hooks, once with recall off ("none") and once on ("otw").
// One saved correction per task (made-up habit, written by the experiment author), one run per arm, first run shown, nothing re-rolled.
// Run in your own terminal through run-demo.sh (needs the isolated Claude CLI login). Output: out/<task>.json with the raw answers.
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'; import { fileURLToPath, pathToFileURL } from 'node:url'
const D = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.join(D, '../../..')
const CL = process.env.EXP10_CLI_DIR || '/Users/SJB/.aside/u/0/sessions/2026-10-22_0s8heOAE5qcpaKfV/tmp/claude-cli'
const CONFIG = path.join(CL, 'config'), CLAUDE = path.join(CL, 'node_modules/.bin/claude'), W = path.join(CL, 'demo/work')
const cacheRoot = path.join(CONFIG, 'plugins/cache/off-the-wall/off-the-wall')
const CACHE_SRC = path.join(cacheRoot, fs.readdirSync(cacheRoot).filter(n => !n.startsWith('.'))[0], 'src')
const { projectKey } = await import(pathToFileURL(path.join(ROOT, 'src/scope.mjs')).href)
const { PREF } = await import(pathToFileURL(path.join(D, '../exp10/tasks10.mjs')).href)
const prefs = JSON.parse(fs.readFileSync(path.join(D, '../exp4/prefs.json'), 'utf8'))
const argv = process.argv.slice(2), has = f => argv.includes(f)
const IDS = (argv.find(a => a.startsWith('--tasks=')) || '--tasks=c006,c124,c136').slice(8).split(',')
// What the user once asked when they gave the correction (invented for this demo, never shown to the model except through the stored record).
const ABOUT = { c006: 'write the commit message for the login change', c124: 'write the PR description for the export button change', c136: 'summarize the release notes for the team chat' }
const ALLOWED = 'Read,Edit,Write,Bash(node:*),Bash(wc:*),Bash(ls:*),Bash(cat:*),Bash(date:*),Bash(grep:*)'
const env = (h) => ({ ...process.env, OTW_HOME: h, CLAUDE_CONFIG_DIR: CONFIG })
function prep(t, arm) {
  fs.rmSync(W, { recursive: true, force: true }); fs.mkdirSync(W, { recursive: true }); t.setup(W, 1)
  const h = path.join(CL, 'demo/otw', `${t.id}-${arm}`); fs.rmSync(h, { recursive: true, force: true }); fs.mkdirSync(h, { recursive: true })
  const p = prefs.find(x => x.id === t.pref)
  const store = [{ at: Date.now() - 3600000, about: ABOUT[t.pref], quote: p.quote, host: 'claude', src: 'live', project: projectKey(W), origin: 'interactive-user', sessionId: 's1', _id: p.id }]
  fs.writeFileSync(path.join(h, 'corrections.jsonl'), store.map(r => JSON.stringify(r)).join('\n') + '\n')
  fs.writeFileSync(path.join(h, 'config.json'), JSON.stringify({ capture: false, routing: false, ...(arm === 'none' ? { recall: false } : {}) }))
  return { h, quote: p.quote }
}
function hookOut(t, h) {
  const sid = crypto.randomUUID(), call = name => spawnSync('node', [path.join(CACHE_SRC, 'hook.mjs'), 'claude'], { cwd: W, env: env(h), input: JSON.stringify({ hook_event_name: name, session_id: sid, cwd: W, source: 'startup', prompt: t.prompt }), encoding: 'utf8' }).stdout || ''
  call('SessionStart'); return call('UserPromptSubmit')
}
const tasks = IDS.map(id => PREF.find(t => t.id === 'task-' + id)).filter(Boolean)
if (has('--selftest')) {
  let bad = 0; const chk = (n, c) => { console.log((c ? 'ok   ' : 'FAIL ') + n); if (!c) bad++ }
  chk('plugin copy present', fs.existsSync(path.join(CACHE_SRC, 'hook.mjs'))); chk('tasks found: ' + IDS.join(','), tasks.length === IDS.length)
  for (const t of tasks) for (const arm of ['none', 'otw']) { const b = prep(t, arm), out = hookOut(t, b.h), seen = out.includes('[off-the-wall]'), quoted = out.includes(b.quote.slice(0, 25)); chk(`${t.id} ${arm}: block=${seen} quote-in-block=${quoted}`, arm === 'none' ? !seen : seen && quoted) }
  console.log(bad ? 'SELFTEST FAILED' : 'selftest ok'); process.exit(bad ? 1 : 0)
}
fs.mkdirSync(path.join(D, 'out'), { recursive: true })
for (const t of tasks) {
  const rec = { task: t.id, prompt: t.prompt, correction: prefs.find(x => x.id === t.pref).quote, about: ABOUT[t.pref], model: 'sonnet', runs: {} }
  for (const arm of ['none', 'otw']) {
    const b = prep(t, arm), t0 = Date.now()
    const p = spawnSync(CLAUDE, ['-p', t.prompt, '--model', 'sonnet', '--output-format', 'stream-json', '--verbose', '--max-turns', '14', '--max-budget-usd', '0.6', '--permission-mode', 'acceptEdits', '--allowedTools', ALLOWED], { cwd: W, env: env(b.h), encoding: 'utf8', timeout: 240000, maxBuffer: 1 << 27 })
    const ev = []; let res = {}
    for (const l of (p.stdout || '').split('\n')) { try { const j = JSON.parse(l); if (j.type === 'assistant') for (const c of j.message?.content || []) if (c.type === 'tool_use') ev.push({ name: c.name, input: c.input }); if (j.type === 'result') res = j } catch {} }
    if (res.type !== 'result' || /Not logged in/i.test(String(res.result || ''))) { console.log(`STOP: no usable result (${String(res.result || p.stderr || 'no output').slice(0, 120)}). Fix the login and run again.`); process.exit(3) }
    let seen = 0; if (res.session_id) { const proj = path.join(CONFIG, 'projects'); for (const dd of fs.existsSync(proj) ? fs.readdirSync(proj) : []) { const f = path.join(proj, dd, res.session_id + '.jsonl'); if (fs.existsSync(f)) seen = fs.readFileSync(f, 'utf8').includes('[off-the-wall]') ? 1 : 0 } }
    const sc = t.score(W, ev, String(res.result || ''))
    rec.runs[arm] = { answer: String(res.result || ''), toolCalls: ev.map(e => e.name), blockSeenInSession: seen, passedHabitCheck: !!sc.pass, costUsd: res.total_cost_usd, seconds: Math.round((Date.now() - t0) / 1000) }
    console.log(`${t.id} ${arm}: pass=${sc.pass} block=${seen} $${res.total_cost_usd} ${Math.round((Date.now() - t0) / 1000)}s`)
  }
  fs.writeFileSync(path.join(D, 'out', `${t.id}.json`), JSON.stringify(rec, null, 2))
}
console.log('done. Raw answers are in docs/data/demo-before-after/out/')
