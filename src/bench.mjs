// `otw bench`: a quick check you can run yourself. The same 11 made-up-habit tasks are given to your own `claude` CLI twice,
// once with recall off and once with recall on (the installed Off the Wall plugin does the real work through its hooks).
// Everything happens in temporary directories. Needs the plugin installed in Claude Code and `claude` logged in.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { projectKey } from './scope.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ALLOWED = 'Read,Edit,Write,Bash(node:*),Bash(wc:*),Bash(ls:*),Bash(cat:*),Bash(date:*),Bash(grep:*)'
export const USAGE = `otw bench [--model haiku|sonnet] [--reps 3] [--yes] [--bin claude] [--json FILE] [--keep] [--selftest]
  Runs 11 small tasks, each needing a habit the model cannot know, with your own claude CLI: once with recall off and
  once with recall on (the Off the Wall plugin must be installed). Prints how often the habit was followed in each case.
  Without --yes it only shows what it would do. --selftest checks the tasks and the hook without calling any model.`
const tasksFile = () => pathToFileURL(path.join(HERE, '../bench/tasks.mjs')).href
const corrections = () => JSON.parse(fs.readFileSync(path.join(HERE, '../bench/corrections.json'), 'utf8'))
const rng = seed => { let s = crypto.createHash('sha256').update(seed).digest().readUInt32LE(0); return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296 }
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '-')
const RATE = { haiku: 0.006, sonnet: 0.06 } // USD per run, measured in experiments 12 and 16

function prepare(t, arm, rep, now) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'otw-bench-')))
  t.setup(dir, rep)
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'otw-bench-home-')), list = corrections(), key = projectKey(dir)
  const rows = list.map((r, i) => ({ at: now - (list.length - i) * 3600000, about: r.about, quote: r.quote, host: 'claude', src: 'live', project: key, origin: 'interactive-user', sessionId: 's' + i, _id: r.id }))
  fs.writeFileSync(path.join(home, 'corrections.jsonl'), rows.map(r => JSON.stringify(r)).join('\n') + '\n')
  fs.writeFileSync(path.join(home, 'config.json'), JSON.stringify({ capture: false, routing: false, ...(arm === 'otw' ? {} : { recall: false }) }))
  return { dir, home }
}

function hookBlock(t, dir, home) {
  const sid = crypto.randomUUID(), call = name => spawnSync(process.execPath, [path.join(HERE, 'hook.mjs'), 'claude'], { cwd: dir, env: { ...process.env, OTW_HOME: home }, input: JSON.stringify({ hook_event_name: name, session_id: sid, cwd: dir, source: 'startup', prompt: t.prompt }), encoding: 'utf8' }).stdout || ''
  call('SessionStart'); return call('UserPromptSubmit')
}

export async function selftest(log = console.log) {
  const { PREF } = await import(tasksFile())
  let bad = 0, found = 0; const chk = (n, c) => { if (!c) { bad++; log('FAIL ' + n) } }
  chk('11 tasks', PREF.length === 11); chk('11 corrections', corrections().length === 11)
  for (const t of PREF) {
    const fresh = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'otw-bench-st-')); t.setup(d, 1); return d }
    let d = fresh(); chk(`${t.id} untouched fails`, !t.score(d, [], '').pass)
    d = fresh(); const g = t.good(d); chk(`${t.id} known-good passes`, t.score(d, g.ev || [], g.text || '').pass)
    d = fresh(); const b = t.bad(d); chk(`${t.id} known-bad fails`, !t.score(d, b.ev || [], b.text || '').pass)
    for (const arm of ['none', 'otw']) { const p = prepare(t, arm, 1, Date.now()), out = hookBlock(t, p.dir, p.home); chk(`${t.id} ${arm} block ${arm === 'otw' ? 'present' : 'absent'}`, arm === 'otw' ? out.includes('[off-the-wall]') : !out.includes('[off-the-wall]')); if (arm === 'otw' && out.includes(corrections().find(c => c.id === t.pref).quote.slice(0, 20))) found++ }
  }
  chk(`the target correction is in the block for at least 8 of 11 tasks (found ${found})`, found >= 8)
  log(bad ? `selftest FAILED: ${bad}` : 'selftest passed'); return bad ? 1 : 0
}

export async function runBench({ model = 'haiku', reps = 3, yes = false, bin = 'claude', json = null, keep = false, log = console.log } = {}) {
  const { PREF } = await import(tasksFile())
  const total = PREF.length * 2 * reps, cost = (RATE[model] ?? RATE.sonnet) * total
  log(`otw bench: ${PREF.length} tasks x 2 conditions (recall off / on) x ${reps} reps = ${total} runs with \`${bin} -p\`, model ${model}.`)
  log(`Rough cost on your own Claude plan: USD ${cost.toFixed(2)} (measured earlier: haiku about 0.006 and sonnet about 0.06 per run), about ${Math.round(total * 12 / 60)} minutes.`)
  log('Sent to your model provider through your own claude CLI: the task prompts, 11 made-up corrections and the small files in temporary directories. Nothing else is read, and nothing is written outside temporary directories.')
  log('Your own CLAUDE.md or global rules are not removed: a rule of yours that matches a task (for example a commit style) can raise the "recall off" score.')
  if (!yes) { log('Add --yes to run it.'); return 0 }
  const now = Date.now(), g = rng('otw-bench'), combos = []
  for (let rep = 1; rep <= reps; rep++) for (const t of PREF) for (const arm of ['none', 'otw']) combos.push({ rep, t, arm, o: g() })
  combos.sort((a, b) => a.o - b.o)
  const first = combos.findIndex(c => c.arm === 'otw'); if (first > 0) combos.unshift(combos.splice(first, 1)[0]) // the first run is a recall-on run so a missing plugin shows up at once
  const rows = [], projDir = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'projects')
  let n = 0
  for (const { rep, t, arm } of combos) {
    n++
    const p = prepare(t, arm, rep, now), t0 = Date.now()
    const r = spawnSync(bin, ['-p', t.prompt, '--model', model, '--output-format', 'stream-json', '--verbose', '--max-turns', '14', '--max-budget-usd', '0.6', '--permission-mode', 'acceptEdits', '--allowedTools', ALLOWED], { cwd: p.dir, env: { ...process.env, OTW_HOME: p.home }, encoding: 'utf8', timeout: 240000, maxBuffer: 1 << 27 })
    const ev = []; let res = {}
    for (const l of (r.stdout || '').split('\n')) { try { const j = JSON.parse(l); if (j.type === 'assistant') for (const c of j.message?.content || []) if (c.type === 'tool_use') ev.push({ name: c.name, input: c.input }); if (j.type === 'result') res = j } catch {} }
    if (r.error && r.error.code === 'ENOENT') { log(`STOP: \`${bin}\` was not found. Install the Claude Code CLI, or pass its full path with --bin (find it with: which claude). If you use a separate Claude profile, set CLAUDE_CONFIG_DIR to it as well.`); return 3 }
    if (res.type !== 'result' || /Not logged in/i.test(String(res.result || ''))) { log(`STOP: no usable result (${String(res.result || r.stderr || 'no output').slice(0, 120)}). Log in to claude and run it again.`); return 3 }
    let seen = false
    if (res.session_id && fs.existsSync(projDir)) for (const d of fs.readdirSync(projDir)) { const f = path.join(projDir, d, res.session_id + '.jsonl'); if (fs.existsSync(f)) seen = fs.readFileSync(f, 'utf8').includes('[off-the-wall]') }
    if (arm === 'otw' && !seen) { log('STOP: the Off the Wall plugin did not add its block in a recall-on run. Install it in Claude Code (/plugin install off-the-wall --marketplace toranalytics/off-the-wall), restart, and run again. Nothing was changed.'); return 4 }
    if (arm === 'none' && seen) { log('STOP: a block was added in a recall-off run, so the plugin ignored its temporary settings; results would not mean anything.'); return 4 }
    const sc = t.score(p.dir, ev, String(res.result || ''))
    if (!keep) { fs.rmSync(p.dir, { recursive: true, force: true }); fs.rmSync(p.home, { recursive: true, force: true }) }
    rows.push({ task: t.id, arm, rep, pass: !!sc.pass, cost: res.total_cost_usd || 0 })
    if (n % 6 === 0 || n === combos.length) log(`${n}/${combos.length} runs (${Math.round((Date.now() - t0) / 1000)}s last)`)
  }
  const tot = { none: [0, 0], otw: [0, 0] }, by = {}
  for (const r of rows) { by[r.task] ??= { none: [0, 0], otw: [0, 0] }; by[r.task][r.arm][0] += r.pass; by[r.task][r.arm][1]++; tot[r.arm][0] += r.pass; tot[r.arm][1]++ }
  log('\ntask    recall off  recall on'); for (const [k, v] of Object.entries(by)) log(`${k.replace('task-', '').padEnd(7)} ${`${v.none[0]}/${v.none[1]}`.padEnd(11)} ${v.otw[0]}/${v.otw[1]}`)
  const line = `Habit followed: ${tot.none[0]}/${tot.none[1]} (${pct(tot.none[0], tot.none[1])}) with recall off, ${tot.otw[0]}/${tot.otw[1]} (${pct(tot.otw[0], tot.otw[1])}) with Off the Wall (model ${model}, ${reps} reps per task and condition).`
  log('\n' + line); log('Made-up habits, small tasks, your own environment: an illustration of what the plugin does, not a promise about your real work.')
  log(`Cost reported by the CLI: USD ${rows.reduce((a, r) => a + r.cost, 0).toFixed(2)}.`)
  if (json) fs.writeFileSync(json, JSON.stringify({ model, reps, totals: tot, rows }, null, 2))
  return 0
}
