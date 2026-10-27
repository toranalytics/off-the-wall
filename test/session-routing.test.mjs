import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { handle } from '../src/hook.mjs'
import { DEFAULT_CONFIG, session } from '../src/store.mjs'

const previousHome = process.env.OTW_HOME
const home = mkdtempSync(join(tmpdir(), 'otw-session-routing-'))
process.env.OTW_HOME = home
after(() => {
  if (previousHome === undefined) delete process.env.OTW_HOME
  else process.env.OTW_HOME = previousHome
  rmSync(home, { recursive: true, force: true })
})
const cfg = { ...DEFAULT_CONFIG, capture: false, recall: false }
const routing = output => assert.match(output?.hookSpecificOutput?.additionalContext ?? '', /# Subagent routing \(Off the Wall\)/)
const send = (host, id, name, extra = {}, options = {}) => handle(host, {
  session_id: id, cwd: home, hook_event_name: name, ...extra,
}, { cfg, spawnJudge: () => assert.fail('routing tests must not dispatch a judge'), ...options })
const start = (host, id, source) => send(host, id, 'SessionStart', source === undefined ? {} : { source })
const prompt = (host, id) => send(host, id, 'UserPromptSubmit', { prompt: 'Synthetic lifecycle request' })

for (const host of ['claude', 'codex']) {
  test(`${host}: startup injects routing once before subsequent prompts`, () => {
    const id = 'startup'
    routing(start(host, id, 'startup'))
    assert.equal(session(host, id).primed, true)
    assert.equal(prompt(host, id), null)
    assert.equal(prompt(host, id), null)
  })
  test(`${host}: resume of a primed session adds no routing copy`, () => {
    const id = 'primed-resume'
    routing(start(host, id, 'startup'))
    assert.equal(prompt(host, id), null)
    const turn = session(host, id).turn
    assert.equal(start(host, id, 'resume'), null)
    assert.equal(start(host, id, 'resume'), null)
    assert.equal(session(host, id).primed, true)
    assert.equal(session(host, id).turn, turn)
    assert.equal(prompt(host, id), null)
  })
  test(`${host}: resume without saved priming injects routing`, () => {
    routing(start(host, 'missing-resume', 'resume'))
    const id = 'unprimed-resume'
    routing(start(host, id, 'startup'))
    send(host, id, 'PostCompact')
    assert.equal(session(host, id).primed, false)
    routing(start(host, id, 'resume'))
    assert.equal(prompt(host, id), null)
  })
  for (const source of ['startup', 'clear', 'compact', 'unrecognized', undefined]) {
    test(`${host}: ${source ?? 'missing source'} still injects even when primed`, () => {
      const id = `repeat-${source ?? 'missing'}`
      routing(start(host, id, 'startup'))
      routing(start(host, id, source))
      assert.equal(session(host, id).primed, true)
      assert.equal(prompt(host, id), null)
    })
  }
  test(`${host}: PostCompact then compact re-primes without a prompt duplicate`, () => {
    const id = 'post-compact'
    routing(start(host, id, 'startup'))
    send(host, id, 'PostCompact')
    assert.equal(session(host, id).primed, false)
    routing(start(host, id, 'compact'))
    assert.equal(session(host, id).primed, true)
    assert.equal(prompt(host, id), null)
  })
  test(`${host}: routing disabled on resume stays silent and unprimed`, () => {
    const id = 'disabled-resume'
    routing(start(host, id, 'startup'))
    assert.equal(send(host, id, 'SessionStart', { source: 'resume' }, { cfg: { ...cfg, routing: false } }), null)
    assert.equal(session(host, id).primed, false)
    routing(start(host, id, 'resume'))
  })
}
