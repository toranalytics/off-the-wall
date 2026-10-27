import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync, readdirSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { hookActivity, codexTrust, hookStatus, TRUST_HINT } from '../src/hookstatus.mjs'
const now = Date.now()
function box() {
  const root = mkdtempSync(join(tmpdir(), 'otw-hookstatus-'))
  const otw = join(root, 'otw'), codex = join(root, 'codex')
  mkdirSync(otw); mkdirSync(codex)
  return { root, otw, codex }
}
function session(b, name, age = 0) {
  mkdirSync(join(b.otw, 'sessions'), { recursive: true })
  const file = join(b.otw, 'sessions', name)
  writeFileSync(file, 'not JSON: contents are not consulted')
  const at = new Date(now - age); utimesSync(file, at, at)
}
function trustConfig(b, text) { writeFileSync(join(b.codex, 'config.toml'), text) }
const trusted = i => `[hooks.state."off-the-wall@off-the-wall:hooks/codex.json:event${i}:0:0"]\ntrusted_hash = "synthetic-${i}"\n`

test('no sessions: hint and no new writes', () => {
  const b = box()
  assert.deepEqual(hookStatus(b.otw, { codexHome: b.codex, now }), ['hooks: no activity recorded yet', TRUST_HINT])
  assert.deepEqual(readdirSync(b.otw), []); assert.deepEqual(readdirSync(b.codex), [])
})
test('fresh session uses mtime, not content', () => {
  const b = box(); session(b, 'codex-fresh.json')
  assert.deepEqual(hookActivity(b.otw, now), ['hooks: last activity codex just now'])
})
test('old session reports relative age', () => {
  const b = box(); session(b, 'claude-old.json', 3 * 86400000)
  assert.deepEqual(hookActivity(b.otw, now), ['hooks: last activity claude 3 days ago'])
})
test('newest matching regular file wins, unrelated files and symlinks ignored', () => {
  const b = box(); session(b, 'claude-old.json', 7200000); session(b, 'codex-new.json', 120000)
  session(b, 'unrelated.json'); session(b, 'claude-bad.jsonl')
  mkdirSync(join(b.otw, 'sessions', 'claude-dir.json'))
  symlinkSync(join(b.otw, 'sessions', 'unrelated.json'), join(b.otw, 'sessions', 'claude-link.json'))
  assert.deepEqual(hookActivity(b.otw, now), ['hooks: last activity codex 2 minutes ago'])
})
test('relative time handles one hour and future timestamp', () => {
  const b = box(); session(b, 'codex-old.json', 3600000)
  assert.deepEqual(hookActivity(b.otw, now), ['hooks: last activity codex 1 hour ago'])
  session(b, 'codex-future.json', -60000)
  assert.deepEqual(hookActivity(b.otw, now), ['hooks: last activity codex just now'])
})
test('counts five trusted plugin sections once each', () => {
  const b = box(); trustConfig(b, Array.from({ length: 5 }, (_, i) => trusted(i)).join(''))
  assert.equal(codexTrust(b.codex), 'codex hooks: 5 trusted entries')
})
test('sections lacking trusted_hash do not count; unrelated sections do not leak into count', () => {
  const b = box(); trustConfig(b, '[hooks.state."off-the-wall@missing"]\nother = "x"\n[unrelated]\ntrusted_hash = "no"\n[hooks.state."other@plugin"]\ntrusted_hash = "no"\n')
  assert.equal(codexTrust(b.codex), 'codex hooks: none found (trust them in /hooks)')
})
test('missing and unreadable config are silently omitted', () => {
  const b = box(); assert.equal(codexTrust(b.codex), null)
  mkdirSync(join(b.codex, 'config.toml')); assert.equal(codexTrust(b.codex), null)
})
test('comments, repeated keys and multiline strings do not inflate counts', () => {
  const b = box(); trustConfig(b, '# ' + trusted(0).replace(/\n/g, '\n# ') + '\nsecret = """\n' + trusted(1) + '"""\n' + trusted(2) + 'trusted_hash = "duplicate"\n')
  assert.equal(codexTrust(b.codex), 'codex hooks: 1 trusted entries')
})
test('status CLI prints only counts, never unrelated secrets-looking config values', () => {
  const b = box(); trustConfig(b, 'api_key = "SYNTHETIC-SECRET-DO-NOT-PRINT"\n' + trusted(1))
  const cli = fileURLToPath(new URL('../bin/otw.mjs', import.meta.url))
  const p = spawnSync(process.execPath, [cli, 'status'], { env: { ...process.env, HOME: b.root, CODEX_HOME: b.codex, CLAUDE_CONFIG_DIR: join(b.root, 'claude'), OTW_HOME: b.otw }, encoding: 'utf8' })
  assert.equal(p.status, 0, p.stderr)
  assert.match(p.stdout, /hooks: no activity recorded yet/)
  assert.match(p.stdout, /codex hooks: 1 trusted entries/)
  assert.doesNotMatch(p.stdout + p.stderr, /SYNTHETIC-SECRET|synthetic-1|api_key|trusted_hash/)
  assert.deepEqual(readdirSync(b.otw), [])
})
