import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, delimiter } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { explainRecall, pickCorrections } from '../src/similar.mjs'
import { projectKey } from '../src/scope.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const base = mkdtempSync(join(tmpdir(), 'otw-explain-'))
after(() => rmSync(base, { recursive: true, force: true }))
let n = 0
const abouts = ['fix the flaky login tests', 'rename configuration keys', 'migrate billing schema backfill', 'write concise release notes', 'deploy staging build', 'add export button', 'update documentation']
function box(config = '{"capture":false}') {
  const dir = join(base, String(n++)), home = join(dir, 'data'), a = join(dir, 'ws-a'), b = join(dir, 'ws-b')
  for (const d of [dir, home, a, b]) mkdirSync(d)
  const rec = (id, about, cwd, extra = {}) => JSON.stringify({ id, about, quote: 'SYNTHETIC correction ' + id, at: 1, project: projectKey(cwd), origin: 'interactive-user', ...extra })
  writeFileSync(join(home, 'corrections.jsonl'), [...abouts.map((x, i) => rec(i, x, a)), rec('other', 'fix the flaky login tests', b), rec('legacy', 'fix the flaky login tests', a, { origin: 'unknown' }), 'not json'].join('\n') + '\n')
  if (config !== null) writeFileSync(join(home, 'config.json'), config)
  const env = { ...process.env, OTW_HOME: home, HOME: join(dir, 'h'), CODEX_HOME: join(dir, 'c'), CLAUDE_CONFIG_DIR: join(dir, 'cl'), PATH: [dirname(process.execPath), ...(process.platform === 'win32' ? [] : ['/usr/bin', '/bin'])].join(delimiter) }
  const run = (args, cwd = a) => { const r = spawnSync(process.execPath, [join(root, 'bin/otw.mjs'), 'explain', ...args], { env, cwd, encoding: 'utf8', timeout: 8000 }); assert.equal(r.error, undefined); return r }
  const snapshot = () => readdirSync(home).sort().map(f => f + ':' + statSync(join(home, f)).size + ':' + readFileSync(join(home, f), 'utf8').length).join('|')
  return { dir, home, a, b, run, snapshot }
}

test('explainRecall picks exactly what pickCorrections picks, for every prompt and both modes', () => {
  const t = box(), key = projectKey(t.a)
  const list = readFileSync(join(t.home, 'corrections.jsonl'), 'utf8').split('\n').filter(Boolean).flatMap(l => { try { return [JSON.parse(l)] } catch { return [] } })
  for (const prompt of ['please check the flaky login tests today', 'rename the config keys to kebab-case', 'ok', 'zzzz qqqq xxxx wwww vvvv', 'What is the capital of Mars?', 'yes do it']) {
    for (const wide of [true, false, undefined]) {
      const want = pickCorrections(list, prompt, 2, undefined, key, wide).map(c => String(c.quote).slice(0, 200))
      const got = explainRecall(list, prompt, 2, key, wide).picks.map(p => p.quote)
      assert.deepEqual(got, want, `${prompt} / ${wide}`)
    }
  }
})
test('explain shows picks with scores, never writes anything, and reports the exclusions', () => {
  const t = box(), before = t.snapshot()
  const r = t.run(['please check the flaky login tests today']); assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /would attach \d+ quotes?:/)
  assert.match(r.stdout, /similarity 0\.\d\d {2}"SYNTHETIC correction 0"/)
  assert.match(r.stdout, /other directories 1, not recalled 1/)
  assert.equal(t.snapshot(), before)
})
test('explain follows the working directory and the recallWide setting', () => {
  const t = box('{"capture":false,"recallWide":false}')
  assert.match(t.run(['please check the flaky login tests today']).stdout, /similarity floor 0\.18 \(recallWide is off\)/)
  const none = t.run(['please check the flaky login tests today'], t.dir)
  assert.match(none.stdout, /this working directory 0/); assert.match(none.stdout, /would attach: nothing/)
  const viaFlag = t.run(['please check the flaky login tests today', '--cwd', t.b]); assert.match(viaFlag.stdout, /this working directory 1/)
})
test('explain reports recall off and configuration errors, and needs a prompt', () => {
  assert.match(box('{"capture":false,"recall":false}').run(['please check the flaky login tests today']).stdout, /recall is off in config\.json/)
  assert.match(box('{"recall":"yes"}').run(['please check the flaky login tests today']).stdout, /configuration error/)
  const bad = box(); for (const args of [[], ['--cwd', bad.a], ['please check', '--cwd']]) assert.equal(bad.run(args).status, 2, args.join(' '))
  assert.match(bad.run(['please check the flaky login tests', '--cwd', 'relative/dir']).stdout, /no usable working directory/)
})

test('status explains an empty store and stays quiet once there are records', () => {
  const t = box(), empty = box()
  writeFileSync(join(empty.home, 'corrections.jsonl'), '')
  const run = (b) => spawnSync(process.execPath, [join(root, 'bin/otw.mjs'), 'status'], { env: { ...process.env, OTW_HOME: b.home, HOME: join(b.dir, 'h'), CODEX_HOME: join(b.dir, 'c') }, encoding: 'utf8', timeout: 8000 }).stdout
  assert.match(run(empty), /No corrections stored yet/)
  assert.doesNotMatch(run(t), /No corrections stored yet/)
})
