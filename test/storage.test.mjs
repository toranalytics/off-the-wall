import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
process.env.OTW_HOME = mkdtempSync(join(tmpdir(), 'otw-storage-test-'))
const { corrections, session, saveSession } = await import('../src/store.mjs')
test('legacy objects remain unchanged while malformed stored shapes cannot break hook/status reads', () => {
  const invalid = [null, false, 1, 'not a record', []]
  const legacy = { at: 123, quote: 'Synthetic legacy correction' }
  const raw = [...invalid, legacy].map(JSON.stringify).join('\n') + '\n{malformed\n'
  const file = join(process.env.OTW_HOME, 'corrections.jsonl')
  writeFileSync(file, raw)
  assert.deepEqual(corrections(), [legacy])
  assert.equal(readFileSync(file, 'utf8'), raw, 'reading never rewrites or deletes legacy data')
  for (const value of invalid) { saveSession('claude', 'shape', value); assert.deepEqual(session('claude', 'shape'), {}) }
  saveSession('claude', 'shape', legacy); assert.deepEqual(session('claude', 'shape'), legacy)
})
