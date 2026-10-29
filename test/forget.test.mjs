import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, delimiter } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { projectKey } from '../src/scope.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const base = mkdtempSync(join(tmpdir(), 'otw-forget-'))
after(() => rmSync(base, { recursive: true, force: true }))
let n = 0
function box() {
  const dir = join(base, String(n++)), home = join(dir, 'data'), a = join(dir, 'ws-a'), b = join(dir, 'ws-b')
  for (const d of [dir, home, join(home, 'sessions'), a, b]) mkdirSync(d)
  const rec = (id, cwd) => JSON.stringify({ id, about: 'SYNTHETIC request ' + id, quote: 'SYNTHETIC correction ' + id, at: 1, project: projectKey(cwd), origin: 'interactive-user' })
  writeFileSync(join(home, 'corrections.jsonl'), [rec('a1', a), rec('b1', b), 'not json at all', rec('a2', a)].join('\n') + '\n')
  writeFileSync(join(home, 'config.json'), '{"capture":true}')
  writeFileSync(join(home, 'log.jsonl'), '{"kind":"x"}\n')
  writeFileSync(join(home, 'sessions', 'claude-s1.json'), JSON.stringify({ project: projectKey(a) }))
  writeFileSync(join(home, 'sessions', 'claude-s2.json'), JSON.stringify({ project: projectKey(b) }))
  const env = { ...process.env, OTW_HOME: home, HOME: join(dir, 'h'), CODEX_HOME: join(dir, 'c'), CLAUDE_CONFIG_DIR: join(dir, 'cl'), PATH: [dirname(process.execPath), ...(process.platform === 'win32' ? [] : ['/usr/bin', '/bin'])].join(delimiter) }
  const run = (args, cwd = a) => { const r = spawnSync(process.execPath, [join(root, 'bin/otw.mjs'), 'forget', ...args], { env, cwd, encoding: 'utf8', timeout: 8000 }); assert.equal(r.error, undefined); return r }
  const lines = () => readFileSync(join(home, 'corrections.jsonl'), 'utf8').split('\n').filter(Boolean)
  return { dir, home, a, b, run, lines, env }
}

test('forget without --yes only reports and changes nothing', () => {
  const t = box(), before = readFileSync(join(t.home, 'corrections.jsonl'), 'utf8')
  for (const args of [['--all'], ['--project']]) {
    const r = t.run(args); assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /nothing was deleted/)
    assert.equal(readFileSync(join(t.home, 'corrections.jsonl'), 'utf8'), before)
    assert.ok(existsSync(join(t.home, 'log.jsonl')) && existsSync(join(t.home, 'sessions', 'claude-s1.json')))
  }
  assert.doesNotMatch(t.run(['--all']).stdout, /SYNTHETIC/)
})
test('forget --all --yes removes corrections, sessions and log but keeps config.json', () => {
  const t = box(), r = t.run(['--all', '--yes']); assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /corrections: 4 of 4 deleted/)
  assert.ok(!existsSync(join(t.home, 'corrections.jsonl')) && !existsSync(join(t.home, 'log.jsonl')))
  assert.deepEqual(readdirSync(join(t.home, 'sessions')), [])
  assert.equal(readFileSync(join(t.home, 'config.json'), 'utf8'), '{"capture":true}')
  assert.match(t.run(['--all', '--yes']).stdout, /corrections: 0 of 0/)
})
test('forget --project --yes removes only that working directory and keeps unreadable lines and other state', () => {
  const t = box(), r = t.run(['--project', '--yes']); assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /corrections: 2 of 4 deleted/)
  const left = t.lines(); assert.equal(left.length, 2)
  assert.ok(left.some(l => l.includes('"b1"')) && left.includes('not json at all') && !left.some(l => l.includes('"a1"') || l.includes('"a2"')))
  assert.deepEqual(readdirSync(join(t.home, 'sessions')), ['claude-s2.json'])
  assert.ok(existsSync(join(t.home, 'log.jsonl')))
  const other = t.run(['--project', t.b, '--yes'], t.a); assert.match(other.stdout, /corrections: 1 of 2 deleted/)
  assert.deepEqual(t.lines(), ['not json at all'])
})
test('forget rejects bad or ambiguous arguments and relative directories', () => {
  const t = box()
  for (const args of [[], ['--all', '--project'], ['--bogus'], ['--all', 'extra'], ['--project', 'relative/dir']]) {
    const r = t.run(args); assert.equal(r.status, 2, args.join(' ')); assert.ok(readFileSync(join(t.home, 'corrections.jsonl'), 'utf8').includes('"a1"'))
  }
})
test('forget refuses a non-regular corrections file and never follows links', { skip: process.platform === 'win32' && 'symlinks need elevated rights on Windows' }, () => {
  const t = box(), elsewhere = join(t.dir, 'precious.txt')
  writeFileSync(elsewhere, 'keep me'); rmSync(join(t.home, 'corrections.jsonl')); symlinkSync(elsewhere, join(t.home, 'corrections.jsonl'))
  const r = t.run(['--all', '--yes']); assert.equal(r.status, 1)
  assert.equal(readFileSync(elsewhere, 'utf8'), 'keep me')
})
test('a capture authorized before forget cannot append afterwards (both modes)', async () => {
  for (const args of [['--all', '--yes'], ['--project', '--yes']]) {
    const t = box(); Object.assign(process.env, { OTW_HOME: t.home, HOME: join(t.dir, 'h'), CODEX_HOME: join(t.dir, 'c') })
    const { authorizeCapture, appendCaptured } = await import('../src/store.mjs')
    const ticket = authorizeCapture(); assert.ok(ticket)
    assert.equal(appendCaptured([{ id: 'before' }], ticket), true)
    assert.equal(t.run(args).status, 0)
    assert.equal(appendCaptured([{ id: 'late' }], ticket), false, args.join(' '))
    assert.ok(!(existsSync(join(t.home, 'corrections.jsonl')) && readFileSync(join(t.home, 'corrections.jsonl'), 'utf8').includes('late')))
    assert.ok(authorizeCapture())
  }
})
