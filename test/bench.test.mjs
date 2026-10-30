import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync, chmodSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..'), otw = join(root, 'bin/otw.mjs')
const base = mkdtempSync(join(tmpdir(), 'otw-bench-test-'))
const run = (args, env = {}) => spawnSync(process.execPath, [otw, 'bench', ...args], { encoding: 'utf8', env: { ...process.env, ...env }, timeout: 120000 })
// A fake `claude`: prints one result event; with FAKE_BLOCK=1 it also writes a session file that contains the plugin block when recall is on in OTW_HOME.
function fake(name, withBlock) {
  const f = join(base, name), cfg = join(base, name + '-cfg'); mkdirSync(join(cfg, 'projects/p'), { recursive: true })
  writeFileSync(f, `#!${process.execPath}\nimport fs from 'node:fs'\nimport path from 'node:path'\nconst c=(()=>{try{return JSON.parse(fs.readFileSync(path.join(process.env.OTW_HOME,'config.json'),'utf8'))}catch{return {}}})()\nconst sid='s'+Date.now()+Math.random().toString(36).slice(2)\nif(${withBlock}){fs.writeFileSync(path.join(${JSON.stringify(cfg)},'projects/p',sid+'.jsonl'),c.recall===false?'plain':'[off-the-wall] block')}\nconsole.log(JSON.stringify({type:'result',subtype:'success',result:'done',session_id:sid,total_cost_usd:0.01}))\n`)
  chmodSync(f, 0o755); return { f, cfg }
}
test('bench --selftest passes without any model call', () => {
  const r = run(['--selftest']); assert.equal(r.status, 0, r.stdout + r.stderr); assert.match(r.stdout, /selftest passed/)
})
test('bench without --yes only describes the run and calls nothing', () => {
  const r = run(['--bin', '/nonexistent/claude']); assert.equal(r.status, 0); assert.match(r.stdout, /Add --yes to run it/); assert.match(r.stdout, /66 runs/)
})
test('bench stops with a clear message when the plugin block never appears', () => {
  const { f, cfg } = fake('noplugin', false), r = run(['--yes', '--reps', '1', '--bin', f], { CLAUDE_CONFIG_DIR: cfg })
  assert.equal(r.status, 4, r.stdout + r.stderr); assert.match(r.stdout, /plugin did not add its block/)
})
test('bench stops when claude is missing', () => {
  const r = run(['--yes', '--reps', '1', '--bin', join(base, 'does-not-exist')]); assert.equal(r.status, 3); assert.match(r.stdout, /was not found/)
})
test('bench runs end to end with a fake claude and prints both conditions', () => {
  const { f, cfg } = fake('goodplugin', true), out = join(base, 'bench.json'), r = run(['--yes', '--reps', '1', '--bin', f, '--json', out], { CLAUDE_CONFIG_DIR: cfg })
  assert.equal(r.status, 0, r.stdout + r.stderr); assert.match(r.stdout, /Habit followed: \d+\/11 \(\d+%\) with recall off, \d+\/11 \(\d+%\) with Off the Wall/)
  const j = JSON.parse(readFileSync(out, 'utf8')); assert.equal(j.rows.length, 22); assert.equal(j.rows.filter(x => x.arm === 'none').length, 11)
  assert.ok(!existsSync(join(root, 'otw-bench.json')))
})
test.after(() => rmSync(base, { recursive: true, force: true }))
