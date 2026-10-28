// Read-only config boundary. Invalid or unstable config never enables a feature.
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { TextDecoder } from 'node:util'
import { codexClasses, DEFAULT_MODELS } from './policy.mjs'

export const DEFAULT_CONFIG = {
  recall: true,
  recallWide: false,
  capture: true,
  routing: true,
  judge: { claude: 'haiku', codex: 'gpt-6.1-sol' },
  models: DEFAULT_MODELS,
}

const FLAGS = ['recall', 'recallWide', 'capture', 'routing']
const HOSTS = ['claude', 'codex']
const CLASSES = ['small', 'mid', 'large']
const ISSUE = 'config-invalid'
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const model = value => typeof value === 'string' && value.trim().length > 0 && !/[\u0000-\u001f\u007f-\u009f]/u.test(value)
const fields = (value, allowed) => object(value) && Object.keys(value).every(key => allowed.includes(key))

function valid(value) {
  if (!fields(value, [...FLAGS, 'judge', 'models'])) return false
  for (const key of FLAGS) if (Object.hasOwn(value, key) && typeof value[key] !== 'boolean') return false
  if (Object.hasOwn(value, 'judge')) {
    if (!fields(value.judge, HOSTS) || !Object.values(value.judge).every(model)) return false
  }
  if (Object.hasOwn(value, 'models')) {
    if (!fields(value.models, HOSTS)) return false
    for (const host of Object.keys(value.models)) {
      if (!fields(value.models[host], CLASSES) || !Object.values(value.models[host]).every(model)) return false
    }
  }
  return true
}

function detected() {
  const codex = { ...DEFAULT_MODELS.codex }
  try {
    const dir = process.env.CODEX_HOME || join(homedir(), '.codex')
    const classes = codexClasses(JSON.parse(fs.readFileSync(join(dir, 'models_cache.json'), 'utf8')))
    for (const key of CLASSES) if (model(classes[key])) codex[key] = classes[key]
  } catch {} // Optional account cache is not the user's config.
  return {
    models: { claude: { ...DEFAULT_MODELS.claude }, codex },
    judge: { ...DEFAULT_CONFIG.judge, codex: codex.mid },
  }
}

// BigInt stats retain nanosecond precision on supported filesystems. Reading may
// update atime, so it is excluded. Neither contents nor paths appear in tokens.
const identity = stat => [stat.dev, stat.ino, stat.mode, stat.nlink, stat.size, stat.mtimeNs, stat.ctimeNs].map(String).join(':')
const digest = value => createHash('sha256').update(value).digest('hex')
const same = (a, b) => identity(a) === identity(b)

function readSnapshot(file) {
  let fd
  let revision = 'error:unreadable'
  try {
    let entry
    try {
      entry = fs.lstatSync(file, { bigint: true })
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
      return { value: {}, revision: 'absent', issue: null }
    }
    revision = 'error:' + digest(identity(entry))
    // NONBLOCK prevents a named pipe hanging before we can reject it.
    fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NONBLOCK || 0))
    const before = fs.fstatSync(fd, { bigint: true })
    if (!before.isFile()) throw new Error('not-file')
    const bytes = fs.readFileSync(fd)
    const after = fs.fstatSync(fd, { bigint: true })
    const current = fs.statSync(file, { bigint: true })
    const currentEntry = fs.lstatSync(file, { bigint: true })
    if (!same(before, after) || !same(after, current) || !same(entry, currentEntry)) throw new Error('unstable')
    // Bind opened contents to their target AND pathname entry (possibly a link).
    const token = digest(identity(after) + '|' + identity(currentEntry) + '|' + digest(bytes))
    revision = 'error:' + token
    let text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
    if (text.startsWith('\uFEFF')) text = text.slice(1)
    const value = JSON.parse(text)
    if (!valid(value)) throw new Error('invalid')
    return { value, revision: 'file:' + token, issue: null }
  } catch {
    return { value: {}, revision, issue: ISSUE }
  } finally {
    if (fd !== undefined) {
      try { fs.closeSync(fd) } catch {} // Never expose source paths or exceptions.
    }
  }
}

export function loadConfig(dir) {
  let snapshot
  try {
    snapshot = readSnapshot(join(dir, 'config.json'))
  } catch {
    snapshot = { value: {}, revision: 'error:unreadable', issue: ISSUE }
  }
  const defaults = detected()
  const value = snapshot.value
  return {
    ...DEFAULT_CONFIG,
    ...value,
    ...(snapshot.issue ? { recall: false, recallWide: false, capture: false, routing: false } : {}),
    judge: { ...defaults.judge, ...value.judge },
    models: {
      claude: { ...defaults.models.claude, ...value.models?.claude },
      codex: { ...defaults.models.codex, ...value.models?.codex },
    },
    configIssue: snapshot.issue,
    configRevision: snapshot.revision,
  }
}
