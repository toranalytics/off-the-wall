import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, delimiter } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { pickCorrections, build, search, QUOTES, MIN_SIMILAR } from '../src/similar.mjs'
import { projectKey } from '../src/scope.mjs'

const project = 'cwd:' + 'a'.repeat(64), other = 'cwd:' + 'b'.repeat(64)
const record = (id, about, extra = {}) => ({ id, about, quote: `Synthetic correction ${id}`, at: 1, project, origin: 'history-user', ...extra })
const store = ['migrate billing schema backfill', 'fix flaky login tests', 'rename configuration keys', 'write concise release notes', 'deploy staging build', 'add export button', 'update documentation'].map((about, id) => record(id, about))
const prompt = 'abcdefghijklmnopqrstuvwxyz'
// Unrelated synthetic requests retain only the incidental bigram "ab".
const weak = Array.from({ length: 8 }, (_, i) => record(i, '1234567890 '.repeat(20) + ' ab ' + i))
const ids = rows => rows.map(c => c.id)

test('default and explicit false retain pre-change ID snapshots', () => {
  for (const [query, expected] of [['billing migration backfill', [0]], ['login test', [1, 4]], ['release notes', [3]], ['zzzzzz', []], ['update documentation', [6, 2]]]) {
    assert.deepEqual(ids(pickCorrections(store, query, 2, undefined, project)), expected)
    assert.deepEqual(ids(pickCorrections(store, query, 2, undefined, project, false)), expected)
  }
})
test('wide returns six by existing score below the default floor, with quote deduplication', () => {
  const rows = [weak[0], { ...weak[0], id: 'duplicate' }, ...weak.slice(1)].reverse()
  const ranked = search(build(rows.map(c => c.about)), prompt, 1e-6, rows.length).map(i => rows[i])
  const seen = new Set()
  const expected = ranked.filter(c => !seen.has(c.quote) && seen.add(c.quote)).slice(0, QUOTES)
  assert.deepEqual(search(build(rows.map(c => c.about)), prompt, MIN_SIMILAR, rows.length), [])
  assert.deepEqual(pickCorrections(rows, prompt, 2, undefined, project), [])
  const got = pickCorrections(rows, prompt, 2, undefined, project, true)
  assert.equal(got.length, 6)
  assert.deepEqual(ids(got), ids(expected))
  assert.equal(pickCorrections(rows, prompt, 2, 2, project, true).length, 2)
})
test('wide excludes zero overlap, other projects, invalid origins and nonhuman records', () => {
  const rows = [weak[0], record('zero', '0123456789'), record('other', prompt, { project: other }), record('origin', prompt, { origin: 'assistant' }), record('meta', prompt, { isMeta: true }), record('future', prompt, { at: 3 }), record('command', prompt, { quote: '/clear' })]
  assert.deepEqual(ids(pickCorrections(rows, prompt, 2, undefined, project, true)), [0])
  assert.deepEqual(pickCorrections([record('zero', '0123456789')], prompt, 2, undefined, project, true), [])
  assert.deepEqual(pickCorrections([], prompt, 2, undefined, project, true), [])
  for (const query of ['', '/clear', '<system-reminder>context</system-reminder>']) assert.deepEqual(pickCorrections(weak, query, 2, undefined, project, true), [])
})

const root = fileURLToPath(new URL('..', import.meta.url))
const base = mkdtempSync(join(tmpdir(), 'otw-wide-'))
after(() => rmSync(base, { recursive: true, force: true }))
let counter = 0
function sandbox(config, rows = weak) {
  const dir = join(base, String(counter++))
  for (const name of ['', 'home', 'codex', 'claude', 'data', 'scratch', 'workspace']) mkdirSync(join(dir, name))
  writeFileSync(join(dir, 'openssl.cnf'), '')
  const cwd = join(dir, 'workspace'), home = join(dir, 'data')
  writeFileSync(join(home, 'config.json'), JSON.stringify({ capture: false, routing: false, ...config }))
  writeFileSync(join(home, 'corrections.jsonl'), rows.map(c => JSON.stringify({ ...c, project: projectKey(cwd) })).join('\n') + '\n')
  const env = { ...process.env, HOME: join(dir, 'home'), USERPROFILE: join(dir, 'home'), CODEX_HOME: join(dir, 'codex'), CLAUDE_CONFIG_DIR: join(dir, 'claude'), OTW_HOME: home, TMPDIR: join(dir, 'scratch'), OPENSSL_CONF: join(dir, 'openssl.cnf'), OTW_CHILD: '', OTW_DEBUG: '', PATH: [dirname(process.execPath), ...(process.platform === 'win32' ? [join(process.env.SystemRoot ?? 'C:\\Windows', 'System32')] : ['/usr/bin', '/bin'])].join(delimiter) }
  const run = (file, args, input) => {
    const result = spawnSync(process.execPath, [join(root, file), ...args], { env, input, encoding: 'utf8', timeout: 5000 })
    assert.equal(result.error, undefined); assert.equal(result.status, 0, result.stderr)
    return result.stdout
  }
  return { run, hook: (host, event, more = {}) => JSON.parse(run('src/hook.mjs', [host], JSON.stringify({ hook_event_name: event, session_id: 'synthetic', cwd, ...more }))) }
}
for (const host of ['claude', 'codex']) {
  test(`${host}: SessionStart then prompt uses opt-in config; recall false wins`, () => {
    for (const [config, inject] of [[{}, false], [{ recallWide: false }, false], [{ recallWide: true }, true], [{ recallWide: true, recall: false }, false]]) {
      const box = sandbox(config)
      assert.deepEqual(box.hook(host, 'SessionStart'), {})
      const output = box.hook(host, 'UserPromptSubmit', { prompt })
      if (inject) {
        assert.match(output.hookSpecificOutput.additionalContext, /\[off-the-wall\]/)
        assert.equal(output.hookSpecificOutput.additionalContext.split('\n').filter(line => line.startsWith('- ')).length, 6)
        assert.deepEqual(box.hook(host, 'UserPromptSubmit', { prompt, isMeta: true }), {})
      } else assert.deepEqual(output, {})
    }
  })
  test(`${host}: digits-only history versus Latin prompt never injects, even wide`, () => {
    for (const config of [{}, { recallWide: true }]) {
      const box = sandbox(config, [record(0, '0123456789')])
      assert.deepEqual(box.hook(host, 'SessionStart'), {})
      assert.deepEqual(box.hook(host, 'UserPromptSubmit', { prompt }), {})
    }
  })
}
test('status keeps the old flags line unless wide is explicitly enabled', () => {
  for (const [config, suffix] of [[{}, ''], [{ recallWide: false }, ''], [{ recallWide: true }, ' · recall wide']]) {
    const box = sandbox({ capture: true, routing: true, ...config })
    const output = box.run('bin/otw.mjs', ['status'])
    assert.ok(output.split('\n').includes('recall on · capture on · routing on' + suffix))
  }
})
