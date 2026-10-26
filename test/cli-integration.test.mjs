import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('..', import.meta.url))
const { projectKey } = await import('../src/scope.mjs')
const { report } = await import('../src/report.mjs')
const { corrections } = await import('../src/store.mjs')
const isWindows = process.platform === 'win32'

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'otw-cli-'))
  const home = join(dir, 'data'), bin = join(dir, 'bin'), cwd = join(dir, 'workspace with spaces')
  for (const p of [home, bin, cwd]) mkdirSync(p)
  const env = { ...process.env, HOME: dir, USERPROFILE: dir, OTW_HOME: home, CODEX_HOME: join(dir, 'codex'), OTW_DEBUG: '', OTW_CHILD: '', CLAUDE_PLUGIN_ROOT: root, PLUGIN_ROOT: root, OTW_STUB_RECEIPT: join(dir, 'provider-stub.jsonl'), PATH: [bin, dirname(process.execPath), ...(isWindows ? [join(process.env.SystemRoot ?? 'C:\\Windows', 'System32')] : ['/usr/bin', '/bin'])].join(delimiter) }
  writeFileSync(join(home, 'config.json'), JSON.stringify({ routing: false }))
  // The PATH deliberately excludes real user CLIs. POSIX stubs exercise the normal CLI contract,
  // including Codex's output-file flag; no model provider or private history is contacted.
  if (!isWindows) for (const host of ['claude', 'codex']) {
    const program = '#!/usr/bin/env node\n' + `const fs=require('node:fs');let text='';process.stdin.on('data',d=>text+=d);process.stdin.on('end',()=>{const args=process.argv.slice(2);fs.appendFileSync(process.env.OTW_STUB_RECEIPT,JSON.stringify({host:${JSON.stringify(host)},child:process.env.OTW_CHILD,args,text})+'\\n');const rule='Run the invoice database backfill before claiming completion.';const i=args.indexOf('-o');if(i>=0)fs.writeFileSync(args[i+1],rule);else process.stdout.write(rule);});\n`
    writeFileSync(join(bin, host), program); chmodSync(join(bin, host), 0o755)
  }
  return { dir, home, cwd, env }
}
function runHook(host, event, box, { configured = false, raw } = {}) {
  let command = process.execPath, args = [join(root, 'src/hook.mjs'), host]
  if (configured) {
    assert.equal(isWindows, false, 'POSIX configured-shell test')
    const manifest = JSON.parse(readFileSync(join(root, 'hooks', host === 'claude' ? 'hooks.json' : 'codex.json')))
    command = '/bin/sh'; args = ['-c', manifest.hooks[event.hook_event_name][0].hooks[0].command]
  }
  const p = spawnSync(command, args, { env: box.env, input: raw ?? JSON.stringify(event), encoding: 'utf8', timeout: 5000 })
  assert.equal(p.error, undefined)
  assert.equal(p.status, 0, p.stderr)
  return JSON.parse(p.stdout)
}
const ev = (box, name, more = {}) => ({ hook_event_name: name, session_id: 'synthetic', cwd: box.cwd, ...more })
async function until(predicate, timeout = 5000) {
  const start = Date.now()
  for (;;) { if (predicate()) return; if (Date.now() - start > timeout) assert.fail('detached synthetic worker did not finish'); await new Promise(r => setTimeout(r, 25)) }
}
function rows(file) { try { return readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) } catch { return [] } }

for (const host of ['claude', 'codex']) {
  test(`${host}: stdin launcher preserves JSON fail-open and child recursion behavior`, () => {
    const box = sandbox()
    assert.deepEqual(runHook(host, ev(box, 'SessionStart'), box), {})
    assert.deepEqual(runHook(host, {}, box, { raw: '{SYNTHETIC-PRIVATE-INPUT' }), {})
    assert.doesNotMatch(readFileSync(join(box.home, 'log.jsonl'), 'utf8'), /SYNTHETIC-PRIVATE-INPUT/)
    box.env.OTW_CHILD = '1'
    assert.deepEqual(runHook(host, ev(box, 'UserPromptSubmit', { prompt: 'a child prompt' }), box), {})
    assert.equal(rows(box.env.OTW_STUB_RECEIPT).length, 0)
  })
  test(`${host}: configured command, detached worker, persistence and scoped recall`, { skip: isWindows }, async () => {
    const box = sandbox()
    const alias = join(box.dir, 'plugin root with spaces')
    symlinkSync(root, alias, 'dir')
    box.env.CLAUDE_PLUGIN_ROOT = alias; box.env.PLUGIN_ROOT = alias
    const run = (name, more = {}) => runHook(host, ev(box, name, more), box, { configured: true })
    run('SessionStart', { source: 'startup' })
    run('UserPromptSubmit', { prompt: 'prepare invoice database migration backfill' })
    run('Stop', { last_assistant_message: 'Invoice database migration prepared.' })
    const quote = 'You did not run the invoice database backfill.'
    run('UserPromptSubmit', { prompt: quote })
    const file = join(box.home, 'corrections.jsonl')
    await until(() => rows(file).length === 1)
    const c = rows(file)[0]
    assert.equal(c.quote, quote); assert.equal(c.project, projectKey(box.cwd)); assert.equal(c.origin, 'interactive-user')
    const receipts = rows(box.env.OTW_STUB_RECEIPT)
    assert.equal(receipts.length, 1); assert.equal(receipts[0].child, '1')
    assert.match(receipts[0].text, /Invoice database migration prepared\./)
    assert.match(receipts[0].text, /You did not run the invoice database backfill\./)
    assert.ok(!receipts[0].text.includes(box.cwd), 'workspace path not part of judge prompt')
    const recalled = run('UserPromptSubmit', { prompt: 'invoice database migration backfill' })
    assert.match(recalled.hookSpecificOutput.additionalContext, /You did not run the invoice database backfill/)
    const elsewhere = join(box.dir, 'other workspace'); mkdirSync(elsewhere)
    assert.deepEqual(run('UserPromptSubmit', { cwd: elsewhere, prompt: 'invoice database migration backfill' }), {})
    const status = spawnSync(process.execPath, [join(root, 'bin/otw.mjs'), 'status'], { env: box.env, encoding: 'utf8', timeout: 5000 })
    assert.equal(status.status, 0); assert.match(status.stdout, /scoped\/origin-tagged 1 · quarantined 0/)
  })
  test(`${host}: an automated session source stays excluded on later source-less prompts`, () => {
    const box = sandbox()
    runHook(host, ev(box, 'SessionStart', { source: 'sdk' }), box)
    runHook(host, ev(box, 'UserPromptSubmit', { prompt: 'invoice migration' }), box)
    runHook(host, ev(box, 'Stop', { last_assistant_message: 'Synthetic automated answer.' }), box)
    runHook(host, ev(box, 'UserPromptSubmit', { prompt: 'You did not run the backfill.' }), box)
    assert.equal(rows(box.env.OTW_STUB_RECEIPT).length, 0)
    const state = JSON.parse(readFileSync(join(box.home, 'sessions', `${host}-synthetic.json`)))
    assert.equal(state.nonhumanSession, true); assert.equal(state.lastAnswer, '')
  })
}
test('report seeding preserves legacy, upgrades explicit provenance, and skips unknown cwd', async () => {
  const box = sandbox()
  process.env.OTW_HOME = box.home; process.env.CODEX_HOME = box.env.CODEX_HOME
  const fixture = join(box.dir, 'history'); mkdirSync(fixture)
  const ts = '2026-01-10T00:00:00Z', at = Date.parse(ts)
  const make = cwd => [
    { type: 'user', cwd, timestamp: ts, message: { content: 'invoice database migration' } },
    { type: 'assistant', cwd, timestamp: ts, message: { content: 'Migration ready.' } },
    { type: 'user', cwd, timestamp: ts, message: { content: 'You did not run the backfill.' } },
  ].map(JSON.stringify).join('\n')
  writeFileSync(join(fixture, 'scoped.jsonl'), make(box.cwd))
  writeFileSync(join(fixture, 'unknown.jsonl'), make(undefined))
  const legacy = { at, about: 'invoice database migration', quote: 'You did not run the backfill.', src: 'history' }
  writeFileSync(join(box.home, 'corrections.jsonl'), JSON.stringify(legacy) + '\n')
  let calls = 0; const logs = []
  const options = { days: 0, hosts: ['claude'], host: 'claude', claudeDir: fixture, seed: true, log: x => logs.push(x), completeFn: async () => { calls++; return '0 unverified\n1 unverified' } }
  await report(options)
  assert.equal(calls, 1); assert.equal(corrections().length, 2)
  assert.deepEqual(corrections()[0], legacy)
  assert.equal(corrections()[1].project, projectKey(box.cwd))
  assert.match(logs.join('\n'), /Skipped 1 corrections/)
  await report(options)
  assert.equal(corrections().length, 2)
})
test('bundled example report stays unscoped and cannot silently become recall memory', async () => {
  const box = sandbox(); process.env.OTW_HOME = box.home; process.env.CODEX_HOME = box.env.CODEX_HOME
  const logs = []
  await report({ days: 0, hosts: ['claude'], host: 'claude', claudeDir: join(root, 'examples/claude-history'), seed: true, log: x => logs.push(x), completeFn: async () => '0 unverified' })
  assert.equal(corrections().length, 0)
  assert.match(logs.join('\n'), /20 candidate user replies/)
  assert.match(logs.join('\n'), /Saved 0 scoped/)
})
