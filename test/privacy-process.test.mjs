// Real hook -> detached worker -> fake CLI, never a provider or real host profile.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { projectKey } from '../src/scope.mjs'
const hook = fileURLToPath(new URL('../src/hook.mjs', import.meta.url))
const worker = fileURLToPath(new URL('../src/worker.mjs', import.meta.url))
const cli = fileURLToPath(new URL('../bin/otw.mjs', import.meta.url))
const posix = { skip: process.platform === 'win32' }
const pause = ms => new Promise(r => setTimeout(r, ms))
async function until(check) { const deadline = Date.now() + 8_000; while (!check()) { assert.ok(Date.now() < deadline, 'fake CLI/worker deadline'); await pause(15) } }
function fixture() {
  const base = mkdtempSync(join(tmpdir(), 'otw-process-fixture-')), home = join(base, 'data'), cwd = join(base, 'project'), bin = join(base, 'bin')
  for (const d of [home, cwd, bin, join(base, 'profile'), join(base, 'scratch')]) mkdirSync(d)
  writeFileSync(join(home, 'config.json'), '{"capture":true,"routing":false,"recall":false}')
  symlinkSync(process.execPath, join(bin, 'node'))
  const stub = `#!/usr/bin/env node
const fs=require('node:fs'), p=process.env.FIXTURE_BASE;
(async()=>{let body='';for await(const chunk of process.stdin)body+=chunk;
fs.writeFileSync(p+'/started.tmp',JSON.stringify({workerPid:process.ppid}));fs.renameSync(p+'/started.tmp',p+'/started');
const deadline=Date.now()+10000;while(!fs.existsSync(p+'/release')){if(Date.now()>deadline)process.exit(2);await new Promise(r=>setTimeout(r,15));}
const answer=process.env.FIXTURE_RESPONSE||'Run the synthetic backfill before saying done.';
const args=process.argv.slice(2),i=args.indexOf('-o');if(i>=0)fs.writeFileSync(args[i+1],answer);else process.stdout.write(answer);
})().catch(()=>process.exit(3));
`
  for (const name of ['claude', 'codex']) writeFileSync(join(bin, name), stub, { mode: 0o700 })
  const env = { ...process.env, PATH: bin, HOME: join(base, 'profile'), OTW_HOME: home, CODEX_HOME: join(base, 'profile'), CLAUDE_CONFIG_DIR: join(base, 'profile'), TMPDIR: join(base, 'scratch'), NODE_OPTIONS: '', OTW_CHILD: '', OTW_DEBUG: '1', FIXTURE_BASE: base }
  return { base, home, cwd, env }
}
function send(b, host, name, extra = {}) {
  const proc = spawnSync(process.execPath, [hook, host], { cwd: b.cwd, env: b.env, input: JSON.stringify({ hook_event_name: name, session_id: 'synthetic-process', cwd: b.cwd, ...extra }), encoding: 'utf8', timeout: 8_000 })
  assert.equal(proc.error, undefined); assert.equal(proc.status, 0, proc.stderr); JSON.parse(proc.stdout)
}
function launch(b, host) {
  send(b, host, 'SessionStart')
  send(b, host, 'UserPromptSubmit', { prompt: 'SYNTHETIC-PROCESS-OLD request' })
  send(b, host, 'Stop', { last_assistant_message: 'SYNTHETIC-PROCESS-OLD answer' })
  send(b, host, 'UserPromptSubmit', { prompt: 'SYNTHETIC-PROCESS-OLD correction: you did not run the backfill.' })
}
async function finish(b) {
  const { workerPid } = JSON.parse(readFileSync(join(b.base, 'started'), 'utf8'))
  writeFileSync(join(b.base, 'release'), '')
  await until(() => { try { process.kill(workerPid, 0); return false } catch (e) { return e.code === 'ESRCH' } })
}
for (const host of ['claude', 'codex']) for (const mode of ['enabled', 'enabled-default', 'disabled', 'deleted', 'recreated']) test(`${host} detached fake-CLI capture: ${mode}`, posix, async () => {
  const b = fixture()
  try {
    if (mode === 'enabled-default') rmSync(join(b.home, 'config.json'))
    launch(b, host); await until(() => existsSync(join(b.base, 'started')))
    if (mode === 'disabled') writeFileSync(join(b.home, 'config.json'), '{"capture":false}')
    if (mode === 'deleted' || mode === 'recreated') rmSync(b.home, { recursive: true, force: true })
    if (mode === 'recreated') {
      mkdirSync(b.home); writeFileSync(join(b.home, 'config.json'), '{"capture":true,"routing":false,"recall":false}')
      send(b, host, 'UserPromptSubmit', { session_id: 'fresh-generation', prompt: 'SYNTHETIC-FRESH request' })
    }
    await finish(b)
    if (mode === 'deleted') assert.equal(existsSync(b.home), false)
    else {
      const data = readFileSync(join(b.home, 'corrections.jsonl'), 'utf8')
      assert.equal(data.trim().split('\n').filter(Boolean).length, mode.startsWith('enabled') ? 1 : 0)
      if (!mode.startsWith('enabled')) assert.doesNotMatch(readFileSync(join(b.home, 'log.jsonl'), 'utf8'), /SYNTHETIC-PROCESS-OLD/)
    }
  } finally { writeFileSync(join(b.base, 'release'), ''); rmSync(b.base, { recursive: true, force: true }) }
})
test('native worker rejects a legacy unauthorised job without creating storage', posix, () => {
  const b = fixture()
  try {
    rmSync(b.home, { recursive: true, force: true })
    const job = { host: 'claude', model: 'stub', at: Date.now(), answer: 'Synthetic answer', reply: 'You did not execute the synthetic backfill.', project: projectKey(b.cwd), origin: 'interactive-user', sessionId: 'synthetic' }
    const proc = spawnSync(process.execPath, [worker], { env: b.env, input: JSON.stringify(job), encoding: 'utf8', timeout: 3_000 })
    assert.equal(proc.error, undefined); assert.equal(proc.status, 0); assert.equal(existsSync(b.home), false); assert.equal(existsSync(join(b.base, 'started')), false)
  } finally { writeFileSync(join(b.base, 'release'), ''); rmSync(b.base, { recursive: true, force: true }) }
})
test('native report --seed finishes without resurrecting a deleted store', posix, async () => {
  const b = fixture(), history = join(b.base, 'history'); mkdirSync(history)
  writeFileSync(join(history, 'synthetic.jsonl'), [
    { type: 'user', cwd: b.cwd, timestamp: '2026-01-10T00:00:00Z', message: { content: 'Synthetic invoice migration' } },
    { type: 'assistant', cwd: b.cwd, message: { content: 'Synthetic answer' } },
    { type: 'user', cwd: b.cwd, message: { content: 'You did not run the synthetic invoice backfill.' } },
  ].map(JSON.stringify).join('\n'))
  const proc = spawn(process.execPath, [cli, 'report', '--seed', '--host', 'claude', '--claude-dir', history, '--days', '0'], { env: { ...b.env, FIXTURE_RESPONSE: '0 unverified' }, cwd: b.cwd, stdio: ['ignore', 'pipe', 'pipe'] })
  let stdout = ''; proc.stdout.on('data', d => stdout += d); proc.stderr.resume()
  const exited = new Promise((resolve, reject) => { proc.once('error', reject); proc.once('close', resolve) })
  try {
    await until(() => existsSync(join(b.base, 'started')))
    rmSync(b.home, { recursive: true, force: true }); writeFileSync(join(b.base, 'release'), '')
    assert.equal(await exited, 0); assert.match(stdout, /Not saved/); assert.equal(existsSync(b.home), false)
  } finally { writeFileSync(join(b.base, 'release'), ''); proc.kill('SIGTERM'); rmSync(b.base, { recursive: true, force: true }) }
})
test('native status/report show a sanitized invalid-config error without dispatch', posix, () => {
  const b = fixture()
  try {
    writeFileSync(join(b.home, 'config.json'), '{"capture":false,"note":"SYNTHETIC-CONFIG-SECRET",}')
    const status = spawnSync(process.execPath, [cli, 'status'], { env: b.env, encoding: 'utf8', timeout: 3_000 })
    assert.equal(status.status, 0); assert.match(status.stdout, /configuration error config-invalid/)
    assert.match(status.stdout, /recall off · capture off · routing off/)
    const report = spawnSync(process.execPath, [cli, 'report', '--host', 'claude'], { env: b.env, encoding: 'utf8', timeout: 3_000 })
    assert.equal(report.status, 1); assert.match(report.stderr, /configuration is invalid: config-invalid/)
    assert.doesNotMatch(status.stdout + status.stderr + report.stdout + report.stderr, /SYNTHETIC-CONFIG-SECRET/)
    assert.equal(existsSync(join(b.base, 'started')), false)
  } finally { writeFileSync(join(b.base, 'release'), ''); rmSync(b.base, { recursive: true, force: true }) }
})
