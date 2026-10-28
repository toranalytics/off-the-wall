import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pickCorrections, GATE_RARE } from '../src/similar.mjs'
import { loadConfig, DEFAULT_CONFIG } from '../src/config.mjs'

const project = 'cwd:' + 'a'.repeat(64)
const rec = (id, about, quote = 'Synthetic correction ' + id) => ({ id, about, quote, at: 1, project, origin: 'history-user' })
// 40 stored requests: one about invoices, 39 unrelated filler that mention "update" and "write" in many records.
const filler = Array.from({ length: 39 }, (_, i) => rec('f' + i, `update the report ${i} and write notes about topic${i}`))
const store = [rec('inv', 'fix the invoice rounding bug in the billing export'), ...filler]
const ids = rows => rows.map(c => c.id)
const pick = (prompt, gate, list = store) => ids(pickCorrections(list, prompt, 2, undefined, project, true, gate))

test('gate off (the default) is unchanged wide recall', () => {
  assert.equal(DEFAULT_CONFIG.recallGate, false)
  assert.deepEqual(pick('write an update about the weather today', false), pick('write an update about the weather today', undefined))
  assert.equal(pick('write an update about the weather today', false).length, 6)
})
test('gate on: unrelated prompt sharing only common words and bigrams gets nothing', () => {
  assert.deepEqual(pick('Explain how photosynthesis works in plants', true), [])
})
test('gate on: a prompt sharing a rare whole word keeps that record', () => {
  assert.ok(pick('please check the invoice totals before release', true).includes('inv'))
})
test('gate on: two shared common words are enough; a single common word is not', () => {
  assert.ok(GATE_RARE <= 0.05)
  const two = pick('update the report formatting for the quarterly review', true)
  assert.ok(two.length > 0 && two.every(id => id.startsWith('f')))
  const one = pick('translate the annual summary into French please', true)
  assert.deepEqual(one, [])
})
test('gate never applies below the 20-character wide guard, and is ignored when wide is off', () => {
  assert.deepEqual(ids(pickCorrections(store, 'invoice bug', 2, undefined, project, true, true)), ids(pickCorrections(store, 'invoice bug', 2, undefined, project, true, false)))
  assert.deepEqual(ids(pickCorrections(store, 'please check the invoice totals before release', 2, undefined, project, false, true)), ids(pickCorrections(store, 'please check the invoice totals before release', 2, undefined, project, false, false)))
})
test('gate on in a tiny store needs two shared whole words (a single word cannot be rare enough)', () => {
  const tiny = [rec('a', 'fix the invoice rounding bug'), rec('b', 'rename configuration keys')]
  assert.deepEqual(pick('please check invoice totals before release', true, tiny), [])
  assert.deepEqual(pick('fix the invoice totals before release please', true, tiny), ['a'])
})
test('recallGate is a strict boolean flag and config errors turn it off', () => {
  const dir = mkdtempSync(join(tmpdir(), 'otw-gate-'))
  try {
    for (const [cfg, expected, issue] of [[{}, false, false], [{ recallGate: true }, true, false], [{ recallGate: 'true' }, false, true], [{ recallGate: 1 }, false, true], [{ recallGate: true, bogus: 1 }, false, true]]) {
      writeFileSync(join(dir, 'config.json'), JSON.stringify(cfg))
      const loaded = loadConfig(dir)
      assert.equal(loaded.recallGate, expected)
      assert.equal(!!loaded.configIssue, issue)
    }
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
