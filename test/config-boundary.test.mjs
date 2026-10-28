import assert from 'node:assert/strict'
import fs from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { DEFAULT_CONFIG, loadConfig } from '../src/config.mjs'

// Every cache lookup is redirected before the first load. Never use real profiles.
const base = fs.mkdtempSync(join(tmpdir(), 'otw-config-boundary-'))
const originalCodexHome = process.env.CODEX_HOME
process.env.CODEX_HOME = join(base, 'codex')
fs.mkdirSync(process.env.CODEX_HOME)
after(() => {
  if (originalCodexHome === undefined) delete process.env.CODEX_HOME
  else process.env.CODEX_HOME = originalCodexHome
  fs.rmSync(base, { recursive: true, force: true })
})
let counter = 0
const fixture = () => {
  const dir = join(base, 'config-' + counter++)
  fs.mkdirSync(dir)
  return dir
}
const put = (dir, value) => fs.writeFileSync(join(dir, 'config.json'), JSON.stringify(value))
const closed = cfg => {
  assert.equal(cfg.configIssue, 'config-invalid')
  for (const key of ['capture', 'recall', 'routing', 'recallWide']) assert.equal(cfg[key], false)
  assert.match(cfg.configRevision, /^error:(?:unreadable|[a-f0-9]{64})$/)
}
const patch = (key, replacement, run) => {
  const previous = fs[key]
  fs[key] = replacement(previous)
  try { return run() } finally { fs[key] = previous }
}

test('original defaults are retained; missing config and missing parent are normal, read-only defaults', () => {
  assert.deepEqual(DEFAULT_CONFIG, {
    capture: true, recall: true, routing: true, recallWide: false,
    judge: { claude: 'haiku', codex: 'gpt-6.1-sol' },
    models: { claude: { small: 'haiku', mid: 'sonnet', large: 'opus' }, codex: { small: 'gpt-6-luna', mid: 'gpt-6.1-sol', large: 'gpt-6-astra' } },
  })
  const dir = join(base, 'absent-parent')
  const cfg = loadConfig(dir)
  assert.deepEqual(cfg, { ...DEFAULT_CONFIG, configIssue: null, configRevision: 'absent' })
  assert.equal(fs.existsSync(dir), false)
  const present = fixture()
  assert.equal(loadConfig(present).configRevision, 'absent')
  assert.deepEqual(fs.readdirSync(present), [])
})

test('boolean false remains false, while omitted flags retain defaults', () => {
  const dir = fixture()
  put(dir, { capture: false })
  const cfg = loadConfig(dir)
  assert.equal(cfg.configIssue, null)
  assert.equal(cfg.capture, false)
  assert.equal(cfg.recall, true)
  assert.equal(cfg.routing, true)
  put(dir, { capture: false, recall: false, routing: false })
  const off = loadConfig(dir)
  assert.equal(off.capture || off.recall || off.routing, false)
  assert.equal(off.configIssue, null)
})

for (const [name, value] of [
  ['wide string', { recallWide: 'true' }], ['wide number', { recallWide: 1 }], ['wide null', { recallWide: null }],
  ['stringfalse', { capture: 'false' }], ['stringtrue', { recall: 'true' }],
  ['numeric', { routing: 0 }], ['null flag', { capture: null }],
  ['null root', null], ['array root', []], ['string root', 'false'], ['boolean root', false], ['number root', 7],
  ['root typo', { caputre: false }], ['unknown root', { storage: {} }],
  ['null judge', { judge: null }], ['array judge', { judge: [] }], ['scalar judge', { judge: 'haiku' }],
  ['unknown judge host', { judge: { claud: 'haiku' } }], ['empty judge', { judge: { claude: '' } }],
  ['blank judge', { judge: { codex: '  ' } }], ['numeric judge', { judge: { claude: 7 } }],
  ['control judge', { judge: { codex: 'model\nsecret' } }], ['C1 control', { judge: { codex: 'm\u0085x' } }],
  ['null models', { models: null }], ['array models', { models: [] }], ['unknown model host', { models: { other: {} } }],
  ['null host', { models: { claude: null } }], ['array host', { models: { codex: [] } }],
  ['scalar host', { models: { codex: 'm' } }], ['unknown class', { models: { claude: { medium: 'sonnet' } } }],
  ['empty class', { models: { claude: { small: '' } } }], ['wrong class type', { models: { codex: { mid: false } } }],
  ['control class', { models: { codex: { large: 'foo\u0000bar' } } }],
]) test('fails closed: ' + name, () => {
  const dir = fixture()
  put(dir, value)
  const cfg = loadConfig(dir)
  closed(cfg)
  assert.deepEqual(loadConfig(dir), cfg, 'error results are deterministic')
})

for (const raw of ['{malformed SECRET-CONTENT', '', '\uFEFF\uFEFF{}', '{"__proto__":{"capture":true}}']) {
  test('malformed, empty, double BOM and prototype keys are sanitized: ' + JSON.stringify(raw), () => {
    const dir = fixture()
    fs.writeFileSync(join(dir, 'config.json'), raw)
    const cfg = loadConfig(dir)
    closed(cfg)
    assert.ok(!JSON.stringify(cfg).includes('SECRET-CONTENT'))
    assert.ok(!JSON.stringify(cfg).includes(dir))
  })
}

test('one UTF-8 BOM is accepted and partial custom model IDs are not allowlisted', () => {
  const dir = fixture()
  fs.writeFileSync(join(dir, 'config.json'), '\uFEFF' + JSON.stringify({ capture: false, judge: { claude: 'future-model:β' }, models: { codex: { large: 'custom/provider-model-v99' } } }))
  const cfg = loadConfig(dir)
  assert.equal(cfg.configIssue, null)
  assert.equal(cfg.capture, false)
  assert.equal(cfg.judge.claude, 'future-model:β')
  assert.equal(cfg.judge.codex, DEFAULT_CONFIG.judge.codex)
  assert.equal(cfg.models.codex.large, 'custom/provider-model-v99')
  assert.equal(cfg.models.codex.mid, DEFAULT_CONFIG.models.codex.mid)
  assert.deepEqual(cfg.models.claude, DEFAULT_CONFIG.models.claude)
})

test('detected Codex defaults and mid-class judge survive partial overrides', () => {
  const cache = join(process.env.CODEX_HOME, 'models_cache.json')
  fs.writeFileSync(cache, JSON.stringify({ models: [
    { slug: 'w', description: 'workhorse' }, { slug: 'f', description: 'Frontier' }, { slug: 's', description: 'Fast and affordable' },
  ] }))
  try {
    const dir = fixture()
    const detected = loadConfig(dir)
    assert.deepEqual(detected.models.codex, { small: 's', mid: 'w', large: 'f' })
    assert.equal(detected.judge.codex, 'w')
    put(dir, { judge: { codex: 'mine' }, models: { codex: { large: 'L' } } })
    const cfg = loadConfig(dir)
    assert.equal(cfg.judge.codex, 'mine')
    assert.deepEqual(cfg.models.codex, { small: 's', mid: 'w', large: 'L' })
    cfg.models.claude.small = 'mutated'
    assert.equal(loadConfig(dir).models.claude.small, 'haiku')
    fs.writeFileSync(cache, JSON.stringify({ models: [{ slug: 'bad\nmodel', description: 'workhorse' }] }))
    assert.equal(loadConfig(fixture()).judge.codex, DEFAULT_CONFIG.judge.codex)
  } finally { fs.unlinkSync(cache) }
})

test('stable reads have stable revisions; edit-away-and-back and same-content replacement invalidate them', () => {
  const dir = fixture()
  const file = join(dir, 'config.json')
  put(dir, { capture: true })
  // Start on an exactly representable whole-second timestamp.
  fs.utimesSync(file, 946684800, 946684800)
  const first = loadConfig(dir)
  assert.match(first.configRevision, /^file:[a-f0-9]{64}$/)
  assert.equal(loadConfig(dir).configRevision, first.configRevision)
  const old = fs.statSync(file, { bigint: true })
  put(dir, { capture: false })
  put(dir, { capture: true })
  // Even restoring mtime must not restore the revision: ctime remains changed.
  fs.utimesSync(file, 946684800, 946684800)
  assert.equal(fs.statSync(file, { bigint: true }).mtimeNs, old.mtimeNs)
  assert.notEqual(loadConfig(dir).configRevision, first.configRevision)
  const beforeReplace = loadConfig(dir).configRevision
  const replacement = join(dir, 'replacement')
  fs.writeFileSync(replacement, fs.readFileSync(file))
  fs.renameSync(replacement, file)
  assert.notEqual(loadConfig(dir).configRevision, beforeReplace)
})

test('same-content rewrite changes revision without relying on a content hash', () => {
  const dir = fixture()
  const file = join(dir, 'config.json')
  put(dir, {})
  const first = loadConfig(dir).configRevision
  put(dir, {})
  const later = new Date(Date.now() + 2000)
  fs.utimesSync(file, later, later)
  assert.notEqual(loadConfig(dir).configRevision, first)
})

test('unreadable existing config is closed with no exception or path disclosure', () => {
  const dir = fixture()
  put(dir, {})
  patch('openSync', original => (file, ...args) => {
    if (file === join(dir, 'config.json')) throw Object.assign(new Error('SECRET ' + file), { code: 'EACCES' })
    return original(file, ...args)
  }, () => {
    const cfg = loadConfig(dir)
    closed(cfg)
    assert.ok(!JSON.stringify(cfg).includes('SECRET'))
    assert.ok(!JSON.stringify(cfg).includes(dir))
  })
})

test('directory config is an error, not an absent file', () => {
  const dir = fixture()
  fs.mkdirSync(join(dir, 'config.json'))
  closed(loadConfig(dir))
})

// Windows cannot rename over a file that is still open, so the replacement this test performs is impossible there.
test('path replacement during opened-file read cannot pair old content with new metadata', { skip: process.platform === 'win32' && 'cannot replace an open file on Windows' }, () => {
  const dir = fixture()
  const file = join(dir, 'config.json')
  put(dir, { capture: true })
  let swapped = false
  patch('readFileSync', original => (input, ...args) => {
    const result = original(input, ...args)
    if (typeof input === 'number' && !swapped) {
      swapped = true
      const other = join(dir, 'other')
      fs.writeFileSync(other, '{"capture":false}')
      fs.renameSync(other, file)
    }
    return result
  }, () => closed(loadConfig(dir)))
  assert.equal(swapped, true)
  assert.equal(loadConfig(dir).capture, false)
})

test('in-place edit during opened-file read is rejected', () => {
  const dir = fixture()
  const file = join(dir, 'config.json')
  put(dir, {})
  let changed = false
  patch('readFileSync', original => (input, ...args) => {
    const result = original(input, ...args)
    if (typeof input === 'number' && !changed) {
      changed = true
      fs.writeFileSync(file, '{"capture":false}')
    }
    return result
  }, () => closed(loadConfig(dir)))
  assert.equal(changed, true)
})

test('reads do not write config, sessions, corrections or any storage', () => {
  const dir = fixture()
  put(dir, { capture: false })
  const file = join(dir, 'config.json')
  const before = fs.readFileSync(file)
  const stat = fs.statSync(file, { bigint: true })
  const result = patch('writeFileSync', () => () => { throw new Error('unexpected write') }, () => loadConfig(dir))
  assert.equal(result.configIssue, null)
  assert.deepEqual(fs.readFileSync(file), before)
  assert.deepEqual(fs.readdirSync(dir), ['config.json'])
  const end = fs.statSync(file, { bigint: true })
  for (const key of ['ino', 'size', 'mtimeNs', 'ctimeNs']) assert.equal(end[key], stat[key])
})


test('malformed UTF-8 cannot become an enabled replacement-character model', () => {
  const dir = fixture()
  fs.writeFileSync(join(dir, 'config.json'), Buffer.concat([
    Buffer.from('{"judge":{"claude":"'), Buffer.from([0xff]), Buffer.from('"}}'),
  ]))
  closed(loadConfig(dir))
})

test('errors finding pathname metadata are closed and deterministic', () => {
  const dir = fixture()
  put(dir, {})
  patch('lstatSync', original => (file, ...args) => {
    if (file === join(dir, 'config.json')) throw Object.assign(new Error('SECRET ' + file), { code: 'EIO' })
    return original(file, ...args)
  }, () => {
    const cfg = loadConfig(dir)
    closed(cfg)
    assert.equal(cfg.configRevision, 'error:unreadable')
    assert.deepEqual(loadConfig(dir), cfg)
  })
})

test('recallWide accepts only booleans, defaults off, and participates in revisions', () => {
  const dir = fixture()
  assert.equal(loadConfig(dir).recallWide, false)
  put(dir, { recallWide: false })
  const off = loadConfig(dir)
  assert.equal(off.configIssue, null)
  assert.equal(off.recallWide, false)
  put(dir, { recallWide: true, recall: false })
  const wide = loadConfig(dir)
  assert.equal(wide.configIssue, null)
  assert.equal(wide.recallWide, true)
  assert.equal(wide.recall, false)
  assert.notEqual(wide.configRevision, off.configRevision)
  assert.equal(loadConfig(dir).configRevision, wide.configRevision)
})
