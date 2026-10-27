import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import fs from 'node:fs'
import childProcess from 'node:child_process'
import { syncBuiltinESMExports } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { authorizeCapture, appendCaptured, logCaptured, corrections, session, saveSession } from '../src/store.mjs'
import { handle } from '../src/hook.mjs'
const root = fs.mkdtempSync(join(tmpdir(), 'otw-storage-fixture-'))
after(() => fs.rmSync(root, { recursive: true, force: true }))
function box() {
  const base = fs.mkdtempSync(join(root, 'box-')), home = join(base, 'data')
  process.env.OTW_HOME = home; process.env.CODEX_HOME = join(base, 'no-codex')
  return { base, home }
}
const record = label => ({ at: 1, quote: `SYNTHETIC-${label}`, rule: 'Synthetic rule' })
test('session reads do not initialize missing storage', () => {
  const b = box(); assert.deepEqual(session('claude', 'missing'), {}); assert.equal(fs.existsSync(b.home), false)
})
test('new POSIX storage requests private modes without changing umask globally', { skip: process.platform === 'win32' }, () => {
  const b = box(), previous = process.umask(0o022)
  try {
    assert.ok(authorizeCapture()); saveSession('claude', 'private', { value: 'SYNTHETIC' })
    for (const name of ['', 'sessions']) assert.equal(fs.statSync(join(b.home, name)).mode & 0o777, 0o700)
    for (const name of ['.capture-generation', 'corrections.jsonl', 'log.jsonl', 'sessions/claude-private.json']) assert.equal(fs.statSync(join(b.home, name)).mode & 0o777, 0o600)
  } finally { process.umask(previous) }
})
test('existing storage modes are not silently globally chmodded', { skip: process.platform === 'win32' }, () => {
  const b = box(); fs.mkdirSync(b.home); fs.chmodSync(b.home, 0o755)
  for (const name of ['corrections.jsonl', 'log.jsonl']) { fs.writeFileSync(join(b.home, name), ''); fs.chmodSync(join(b.home, name), 0o644) }
  assert.ok(authorizeCapture()); assert.equal(fs.statSync(b.home).mode & 0o777, 0o755)
  assert.equal(fs.statSync(join(b.home, 'corrections.jsonl')).mode & 0o777, 0o644)
})
test('POSIX delete/recreate after append authorization writes only an unlinked old fd', { skip: process.platform === 'win32' }, () => {
  const b = box(), old = authorizeCapture(), original = fs.writeSync
  let intercepted = 0
  fs.writeSync = (...args) => {
    intercepted++; fs.writeSync = original; syncBuiltinESMExports()
    fs.rmSync(b.home, { recursive: true, force: true }); fs.mkdirSync(b.home)
    assert.ok(authorizeCapture())
    return original(...args)
  }
  syncBuiltinESMExports()
  try { appendCaptured([record('OLD')], old) }
  finally { fs.writeSync = original; syncBuiltinESMExports() }
  assert.equal(intercepted, 1); assert.equal(corrections().length, 0)
  assert.equal(logCaptured({ answer: 'SYNTHETIC-OLD' }, old), false)
  assert.equal(fs.readFileSync(join(b.home, 'log.jsonl'), 'utf8'), '')
  assert.equal(appendCaptured([record('FRESH')], authorizeCapture()), true)
  assert.equal(corrections()[0].quote, 'SYNTHETIC-FRESH')
})
test('POSIX deleting a target after authorization never recreates its pathname', { skip: process.platform === 'win32' }, () => {
  const b = box(), ticket = authorizeCapture(), original = fs.writeSync
  fs.writeSync = (...args) => { fs.writeSync = original; syncBuiltinESMExports(); fs.unlinkSync(join(b.home, 'corrections.jsonl')); return original(...args) }
  syncBuiltinESMExports()
  try { appendCaptured([record('OLD')], ticket) }
  finally { fs.writeSync = original; syncBuiltinESMExports() }
  assert.equal(fs.existsSync(join(b.home, 'corrections.jsonl')), false)
})
test('session replacement exposes complete old and complete new JSON at rename', () => {
  const b = box(); saveSession('claude', 'atomic', { nonhumanSession: true, text: 'SYNTHETIC-OLD' })
  const original = fs.renameSync; let observed = 0
  fs.renameSync = (from, to) => {
    observed++; assert.equal(JSON.parse(fs.readFileSync(to, 'utf8')).text, 'SYNTHETIC-OLD')
    const value = original(from, to)
    assert.equal(JSON.parse(fs.readFileSync(to, 'utf8')).text, 'SYNTHETIC-NEW'); return value
  }
  syncBuiltinESMExports()
  try { saveSession('claude', 'atomic', { nonhumanSession: true, text: 'SYNTHETIC-NEW' }) }
  finally { fs.renameSync = original; syncBuiltinESMExports() }
  assert.equal(observed, 1)
})
for (const mode of ['deleted-log', 'recreated-root']) test(`late detached spawn errors do not cross authorization: ${mode}`, () => {
  const b = box(), original = childProcess.spawn; let failure
  childProcess.spawn = () => ({ on: (name, fn) => { if (name === 'error') failure = fn }, stdin: { on: () => {}, end: () => {} }, unref: () => {} })
  syncBuiltinESMExports()
  try {
    const send = (name, extra) => handle('claude', { hook_event_name: name, session_id: 'synthetic-spawn-error', cwd: b.base, ...extra })
    send('UserPromptSubmit', { prompt: 'Synthetic request' }); send('Stop', { last_assistant_message: 'Synthetic answer' }); send('UserPromptSubmit', { prompt: 'You did not run the synthetic backfill.' })
    assert.equal(typeof failure, 'function')
    if (mode === 'deleted-log') fs.unlinkSync(join(b.home, 'log.jsonl'))
    else { fs.rmSync(b.home, { recursive: true, force: true }); assert.ok(authorizeCapture()) }
    failure({ code: 'SYNTHETIC-SPAWN-FAILURE' })
    if (mode === 'deleted-log') assert.equal(fs.existsSync(join(b.home, 'log.jsonl')), false)
    else assert.equal(fs.readFileSync(join(b.home, 'log.jsonl'), 'utf8'), '')
  } finally { childProcess.spawn = original; syncBuiltinESMExports() }
})
