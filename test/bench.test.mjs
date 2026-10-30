import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync, chmodSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runBench } from '../src/bench.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..'), otw = join(root, 'bin/otw.mjs')
const base = mkdtempSync(join(tmpdir(), 'otw-bench-test-'))
const run = (args, env = {}) => spawnSync(process.execPath, [otw, 'bench', ...args], { encoding: 'utf8', env: { ...process.env, ...env }, timeout: 120000 })
// Inject a fake process so the same assertions run on Windows and Node 18.
function fakeSpawn(cfg, withBlock) {
  mkdirSync(join(cfg, 'projects/p'), { recursive: true })
  return (_bin, _args, opts) => {
    const c = JSON.parse(readFileSync(join(opts.env.OTW_HOME, 'config.json'), 'utf8'))
    const sid = 's' + Date.now() + Math.random().toString(36).slice(2)
    if (withBlock) writeFileSync(join(cfg, 'projects/p', sid + '.jsonl'), c.recall === false ? 'plain' : '[off-the-wall] block')
    return { stdout: JSON.stringify({ type: 'result', subtype: 'success', result: 'done', session_id: sid, total_cost_usd: 0.01 }), stderr: '', status: 0 }
  }
}
test('bench --selftest passes without any model call', () => {
  const r = run(['--selftest']); assert.equal(r.status, 0, r.stdout + r.stderr); assert.match(r.stdout, /selftest passed/)
})
test('bench without --yes only describes the run and calls nothing', () => {
  const r = run(['--bin', '/nonexistent/claude']); assert.equal(r.status, 0); assert.match(r.stdout, /Add --yes to run it/); assert.match(r.stdout, /66 runs/)
})
test('bench stops with a clear message when the plugin block never appears', async () => {
  const cfg = join(base, 'noplugin-cfg'), old = process.env.CLAUDE_CONFIG_DIR, lines = []
  process.env.CLAUDE_CONFIG_DIR = cfg
  try { const code = await runBench({ yes: true, reps: 1, spawn: fakeSpawn(cfg, false), log: x => lines.push(x) }); assert.equal(code, 4); assert.match(lines.join('\n'), /plugin did not add its block/) }
  finally { if (old === undefined) delete process.env.CLAUDE_CONFIG_DIR; else process.env.CLAUDE_CONFIG_DIR = old }
})
test('bench stops when claude is missing', () => {
  const r = run(['--yes', '--reps', '1', '--bin', join(base, 'does-not-exist')]); assert.equal(r.status, 3); assert.match(r.stdout, /was not found/)
})
test('bench runs end to end with a fake claude and prints both conditions', async () => {
  const cfg = join(base, 'goodplugin-cfg'), out = join(base, 'bench.json'), old = process.env.CLAUDE_CONFIG_DIR, lines = []
  process.env.CLAUDE_CONFIG_DIR = cfg
  try {
    const code = await runBench({ yes: true, reps: 1, json: out, spawn: fakeSpawn(cfg, true), log: x => lines.push(x) })
    assert.equal(code, 0, lines.join('\n')); assert.match(lines.join('\n'), /Habit followed: \d+\/11 \(\d+%\) with recall off, \d+\/11 \(\d+%\) with Off the Wall/)
    const j = JSON.parse(readFileSync(out, 'utf8')); assert.equal(j.rows.length, 22); assert.equal(j.rows.filter(x => x.arm === 'none').length, 11)
    assert.ok(!existsSync(join(root, 'otw-bench.json')))
  } finally { if (old === undefined) delete process.env.CLAUDE_CONFIG_DIR; else process.env.CLAUDE_CONFIG_DIR = old }
})
test.after(() => rmSync(base, { recursive: true, force: true }))
