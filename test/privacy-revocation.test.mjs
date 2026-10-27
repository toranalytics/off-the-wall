import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const { handle } = await import('../src/hook.mjs')
const { judgeJob } = await import('../src/worker.mjs')
const { config, corrections, session } = await import('../src/store.mjs')
const { report } = await import('../src/report.mjs')
const root = mkdtempSync(join(tmpdir(), 'otw-private-regression-'))
after(() => rmSync(root, { recursive: true, force: true }))
process.env.CODEX_HOME = join(root, 'empty-codex')
process.env.OTW_DEBUG = ''
function box(raw = '{"capture":true,"routing":false,"recall":false}') {
  const base = mkdtempSync(join(root, 'box-')), home = join(base, 'data'), cwd = join(base, 'workspace')
  mkdirSync(home); mkdirSync(cwd); process.env.OTW_HOME = home
  if (raw !== null) writeFileSync(join(home, 'config.json'), raw)
  return { base, home, cwd }
}
function collect(b, id = 'synthetic', prompt = 'SYNTHETIC-OLD-CORRECTION: you did not run the invoice backfill.') {
  const jobs = [], opts = { spawnJudge: job => jobs.push(job) }
  const send = (name, extra = {}) => handle('claude', { hook_event_name: name, session_id: id, cwd: b.cwd, ...extra }, opts)
  send('SessionStart'); send('UserPromptSubmit', { prompt: 'SYNTHETIC-OLD-REQUEST invoice migration' })
  send('Stop', { last_assistant_message: 'SYNTHETIC-OLD-ANSWER invoice migration ready.' })
  send('UserPromptSubmit', { prompt })
  return jobs
}
async function paused(job) {
  let started, release
  const began = new Promise(r => started = r), gate = new Promise(r => release = r)
  const pending = judgeJob(job, { completeFn: async () => { started(); return await gate } })
  await began
  return { finish: async () => { release('Run the invoice backfill before saying done.'); return await pending } }
}
for (const [name, raw] of [
  ['valid false', '{"capture":false,"routing":false,"recall":false}'],
  ['invalid JSON', '{"capture":false,}'],
  ['wrong boolean type', '{"capture":"false"}'],
  ['BOM opt-out', '\ufeff{"capture":false}'],
]) test(`configuration privacy: ${name} cannot silently dispatch capture`, () => {
  const b = box(raw); assert.equal(collect(b).length, 0)
  assert.equal(Boolean(session('claude', 'synthetic').lastPrompt), false)
})
test('positive control: enabled capture still generates an eligible job', () => {
  const b = box(); assert.equal(collect(b).length, 1)
})
test('capture disabled before a queued worker starts makes no provider call', async () => {
  const b = box(), [job] = collect(b); assert.ok(job)
  writeFileSync(join(b.home, 'config.json'), '{"capture":false}')
  let calls = 0
  const result = await judgeJob(job, { completeFn: async () => { calls++; return 'Run the invoice backfill before saying done.' } })
  assert.equal(calls, 0); assert.equal(result.skipped, true); assert.equal(corrections().length, 0)
})
test('capture disabled while a judge is pending prevents later persistence', async () => {
  const b = box(), [job] = collect(b), task = await paused(job)
  writeFileSync(join(b.home, 'config.json'), '{"capture":false}')
  await task.finish(); assert.equal(config().capture, false); assert.equal(corrections().length, 0)
})
test('deleting the store during a pending judge cannot recreate the directory', async () => {
  const b = box(), [job] = collect(b), task = await paused(job)
  rmSync(b.home, { recursive: true, force: true })
  await task.finish(); assert.equal(existsSync(b.home), false)
})
test('deleting only corrections during a pending judge cannot recreate that file', async () => {
  const b = box(), [job] = collect(b), task = await paused(job)
  rmSync(join(b.home, 'corrections.jsonl'), { force: true })
  await task.finish(); assert.equal(existsSync(join(b.home, 'corrections.jsonl')), false)
})
test('old judge cannot write into a deliberately recreated store or its debug log', async () => {
  const b = box(), [job] = collect(b), task = await paused(job)
  rmSync(b.home, { recursive: true, force: true }); mkdirSync(b.home)
  writeFileSync(join(b.home, 'config.json'), '{"capture":true,"routing":false,"recall":false}')
  const opts = { spawnJudge: () => assert.fail('new first prompt has no prior answer') }
  handle('claude', { hook_event_name: 'UserPromptSubmit', session_id: 'new-generation', cwd: b.cwd, prompt: 'SYNTHETIC-NEW-REQUEST' }, opts)
  process.env.OTW_DEBUG = '1'
  try { await task.finish() } finally { process.env.OTW_DEBUG = '' }
  assert.equal(corrections().length, 0)
  for (const name of readdirSync(b.home)) if (name.endsWith('.jsonl')) assert.doesNotMatch(readFileSync(join(b.home, name), 'utf8'), /SYNTHETIC-OLD/)
})
test('a configuration edit-away-and-back invalidates an older pending job', async () => {
  const b = box(), [job] = collect(b), task = await paused(job)
  writeFileSync(join(b.home, 'config.json'), '{"capture":false}')
  writeFileSync(join(b.home, 'config.json'), '{"capture":true,"routing":false,"recall":false}')
  await task.finish(); assert.equal(corrections().length, 0)
})
test('legacy queued jobs with no storage authorization fail before provider dispatch', async () => {
  const b = box(), [job] = collect(b); delete job.captureAuthorization
  let calls = 0
  const result = await judgeJob(job, { completeFn: async () => { calls++; return 'Run all steps before claiming completion.' } })
  assert.equal(calls, 0); assert.equal(result.skipped, true)
})
test('a report seed cannot repopulate storage deleted during classification', async () => {
  const b = box(), history = join(b.base, 'history'); mkdirSync(history)
  const ts = '2026-01-10T00:00:00Z'
  writeFileSync(join(history, 'example.jsonl'), [
    { type: 'user', cwd: b.cwd, timestamp: ts, message: { content: 'Synthetic invoice migration' } },
    { type: 'assistant', cwd: b.cwd, timestamp: ts, message: { content: 'Synthetic answer.' } },
    { type: 'user', cwd: b.cwd, timestamp: ts, message: { content: 'You did not execute the synthetic backfill.' } },
  ].map(JSON.stringify).join('\n'))
  let start, release
  const started = new Promise(r => start = r), gate = new Promise(r => release = r)
  const pending = report({ days: 0, host: 'claude', hosts: ['claude'], claudeDir: history, seed: true, log: () => {}, completeFn: async () => { start(); return await gate } })
  await started; rmSync(b.home, { recursive: true, force: true }); release('0 unverified')
  await pending; assert.equal(existsSync(b.home), false)
})
test('absent configuration cannot reauthorize an old worker after opt-out then removal', async () => {
  const b = box(null), [job] = collect(b)
  assert.ok(job)
  writeFileSync(join(b.home, 'config.json'), '{"capture":false}')
  rmSync(join(b.home, 'config.json'))
  let calls = 0
  const result = await judgeJob(job, { completeFn: async () => { calls++; return 'Run the backfill.' } })
  assert.equal(calls, 0); assert.equal(result.skipped, true)
})
test('absent configuration cannot reauthorize a running judge after opt-out then removal', async () => {
  const b = box(null), [job] = collect(b), task = await paused(job)
  writeFileSync(join(b.home, 'config.json'), '{"capture":false}')
  rmSync(join(b.home, 'config.json'))
  await task.finish(); assert.equal(corrections().length, 0)
})
test('report seed stops dispatching not-yet-sent batches after revocation', async () => {
  const b = box(), history = join(b.base, 'history'); mkdirSync(history)
  const rows = []
  for (let i = 0; i < 81; i++) rows.push(
    { type: 'user', cwd: b.cwd, timestamp: '2026-01-10T00:00:00Z', message: { content: `Synthetic request ${i}` } },
    { type: 'assistant', cwd: b.cwd, message: { content: 'Synthetic answer' } },
  )
  rows.push({ type: 'user', cwd: b.cwd, message: { content: 'Synthetic final correction' } })
  writeFileSync(join(history, 'many.jsonl'), rows.map(JSON.stringify).join('\n'))
  const releases = []; let calls = 0, started
  const initial = new Promise(r => started = r)
  const pending = report({ days: 0, host: 'claude', hosts: ['claude'], claudeDir: history, seed: true, log: () => {}, completeFn: async () => {
    calls++; if (calls === 4) started()
    return await new Promise(resolve => { releases.push(resolve); if (calls > 4) resolve('0 unverified') })
  } })
  await initial; writeFileSync(join(b.home, 'config.json'), '{"capture":false}')
  for (const release of releases) release('0 unverified')
  await pending; assert.equal(calls, 4); assert.equal(corrections().length, 0)
})
test('a late Stop after deletion does not recreate missing session storage', () => {
  const b = box(); collect(b)
  rmSync(b.home, { recursive: true, force: true })
  handle('claude', { hook_event_name: 'Stop', session_id: 'synthetic', cwd: b.cwd, last_assistant_message: 'SYNTHETIC-LATE-ANSWER' })
  assert.equal(existsSync(b.home), false)
})
function smallHistory(b) {
  const dir = join(b.base, 'small-history'); mkdirSync(dir)
  writeFileSync(join(dir, 'example.jsonl'), [
    { type: 'user', cwd: b.cwd, timestamp: '2026-01-10T00:00:00Z', message: { content: 'Synthetic request' } },
    { type: 'assistant', cwd: b.cwd, message: { content: 'Synthetic answer' } },
    { type: 'user', cwd: b.cwd, message: { content: 'You did not run the synthetic backfill.' } },
  ].map(JSON.stringify).join('\n'))
  return dir
}
test('invalid configuration rejects manual report before provider processing', async () => {
  const b = box('{"capture":"false"}'); let calls = 0
  await assert.rejects(report({ days: 0, host: 'claude', claudeDir: smallHistory(b), log: () => {}, completeFn: async () => { calls++; return '0 unverified' } }), /configuration is invalid/)
  assert.equal(calls, 0); assert.equal(existsSync(join(b.home, 'corrections.jsonl')), false)
})
test('capture off rejects explicit seeding before provider dispatch', async () => {
  const b = box('{"capture":false}'); let calls = 0
  await assert.rejects(report({ days: 0, host: 'claude', claudeDir: smallHistory(b), seed: true, log: () => {}, completeFn: async () => { calls++; return '0 unverified' } }), /Cannot seed/)
  assert.equal(calls, 0); assert.equal(existsSync(join(b.home, 'corrections.jsonl')), false)
})
test('non-seeding reports remain explicit provider actions while capture is off', async () => {
  const b = box('{"capture":false}'); let calls = 0
  await report({ days: 0, host: 'claude', claudeDir: smallHistory(b), log: () => {}, completeFn: async () => { calls++; return '0 unverified' } })
  assert.equal(calls, 1); assert.equal(existsSync(join(b.home, 'corrections.jsonl')), false)
})
