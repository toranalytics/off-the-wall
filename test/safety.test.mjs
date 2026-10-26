import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

process.env.OTW_HOME = mkdtempSync(join(tmpdir(), 'otw-safety-'))
process.env.CODEX_HOME = join(process.env.OTW_HOME, 'no-model-cache')
const { handle } = await import('../src/hook.mjs')
const { pickCorrections } = await import('../src/similar.mjs')
const { DEFAULT_CONFIG, saveSession, session } = await import('../src/store.mjs')
const cfg = { ...DEFAULT_CONFIG, routing: false }
const cwd = join(process.env.OTW_HOME, 'workspace')
mkdirSync(cwd)
const P = 'cwd:' + 'a'.repeat(64)
const Q = 'cwd:' + 'b'.repeat(64)
const at = 1_800_000_000_000
const c = (x = {}) => ({ at: at - 1, about: 'invoice database schema migration backfill', quote: 'Run the database backfill before claiming migration complete.', project: P, origin: 'interactive-user', ...x })
const event = (id, name, more = {}) => ({ session_id: id, cwd, hook_event_name: name, ...more })
const submit = (id, prompt, more, jobs) => handle('claude', event(id, 'UserPromptSubmit', { prompt, ...more }), { cfg, now: at, spawnJudge: j => jobs.push(j) })
const stop = (id, answer, settings = cfg) => handle('claude', event(id, 'Stop', { last_assistant_message: answer }), { cfg: settings, now: at })

test('recall never pads a disjoint query with latest corrections', () => {
  assert.deepEqual(pickCorrections([c()], 'quasar photon telescope astronomy', at, 6, P), [])
})
test('same topic from a different project is not recalled', () => {
  assert.deepEqual(pickCorrections([c({ project: Q })], c().about, at, 6, P), [])
})
test('unknown current project and legacy unscoped records fail closed', () => {
  assert.deepEqual(pickCorrections([c()], c().about, at), [])
  assert.deepEqual(pickCorrections([c({ project: undefined })], c().about, at, 6, P), [])
})
test('unknown input origin and explicit meta records are never recalled', () => {
  assert.deepEqual(pickCorrections([c({ origin: undefined })], c().about, at, 6, P), [])
  assert.deepEqual(pickCorrections([c({ isMeta: true })], c().about, at, 6, P), [])
})
test('an exact repeated request can retrieve its single eligible correction', () => {
  assert.deepEqual(pickCorrections([c()], c().about, at, 6, P), [c()])
})
test('explicit metadata prevents judging and breaks a machine-answer chain', () => {
  const jobs = []
  submit('meta', 'prepare the invoice migration', {}, jobs)
  stop('meta', 'Invoice migration prepared.')
  submit('meta', 'Automated summary: the assistant did not run the checks.', { isMeta: true }, jobs)
  assert.equal(jobs.length, 0)
  stop('meta', 'AUTOMATED ANSWER MUST NOT BECOME HUMAN CONTEXT')
  submit('meta', 'You forgot the backfill.', {}, jobs)
  assert.equal(jobs.length, 0)
})
test('a command then its answer is not attributed to the next human', () => {
  const jobs = []
  submit('command', 'prepare migration', {}, jobs)
  stop('command', 'Prepared migration.')
  submit('command', '/clear', {}, jobs)
  stop('command', 'AUTOMATIC COMMAND OUTPUT')
  submit('command', 'That is the wrong migration.', {}, jobs)
  assert.equal(jobs.length, 0)
})
test('capture off does not persist prompt or answer excerpts', () => {
  const off = { ...cfg, capture: false }
  handle('claude', event('off', 'UserPromptSubmit', { prompt: 'SYNTHETIC-PROMPT-SECRET' }), { cfg: off })
  stop('off', 'SYNTHETIC-ANSWER-SECRET', off)
  assert.doesNotMatch(JSON.stringify(session('claude', 'off')), /SYNTHETIC-(PROMPT|ANSWER)-SECRET/)
})
test('without a workspace the live hook cannot create a capture job', () => {
  const jobs = []
  submit('unknown-cwd', 'prepare migration', { cwd: undefined }, jobs)
  stop('unknown-cwd', 'Prepared migration.')
  submit('unknown-cwd', 'You forgot to execute it.', { cwd: undefined }, jobs)
  assert.equal(jobs.length, 0)
})
test('legacy pending answers are not promoted into new scoped captures', () => {
  const jobs = []
  saveSession('claude', 'legacy', { lastAnswer: 'UNATTRIBUTED LEGACY ANSWER', lastPrompt: 'old unscoped task' })
  submit('legacy', 'You did not verify it.', {}, jobs)
  assert.equal(jobs.length, 0)
})
test('a known automated session stays quarantined across compact/resume lifecycle starts', () => {
  const jobs = []
  const id = 'automation-lifecycle'
  handle('claude', event(id, 'SessionStart', { source: 'startup', metadata: { source: 'automation' } }), { cfg })
  for (const source of ['compact', 'resume', 'startup', 'clear']) handle('claude', event(id, 'SessionStart', { source }), { cfg })
  submit(id, 'prepare invoice migration', {}, jobs)
  stop(id, 'Automation migration result.')
  submit(id, 'You did not verify the backfill.', {}, jobs)
  assert.equal(jobs.length, 0)
  assert.equal(session('claude', id).nonhumanSession, true)
})
test('system/tool Stop metadata cannot become a human-turn assistant answer', () => {
  for (const role of ['system', 'tool']) {
    const jobs = [], id = 'stop-role-' + role
    submit(id, 'prepare invoice migration', {}, jobs)
    handle('claude', event(id, 'Stop', { role, last_assistant_message: 'AUTOMATED ' + role }), { cfg })
    submit(id, 'You did not verify the migration.', {}, jobs)
    assert.equal(jobs.length, 0)
  }
})
