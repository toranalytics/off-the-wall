// Everything Off the Wall keeps lives in one folder on the person's machine (OTW_HOME, default ~/.otw).
// corrections.jsonl is append-only: the detached judges of several sessions may write at the same time, and a
// single short append does not interleave.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { codexClasses, DEFAULT_MODELS } from './policy.mjs'

export const home = () => process.env.OTW_HOME || join(homedir(), '.otw')
const ensure = d => (existsSync(d) || mkdirSync(d, { recursive: true }), d)

export const DEFAULT_CONFIG = {
  recall: true, // quote past corrections on each prompt
  capture: true, // judge each prompt for a correction of the previous answer
  routing: true, // the orchestrator names a model for every subagent
  judge: { claude: 'haiku', codex: 'gpt-6.1-sol' },
  models: DEFAULT_MODELS,
}

function detected() {
  try {
    const dir = process.env.CODEX_HOME || join(homedir(), '.codex')
    const codex = { ...DEFAULT_MODELS.codex, ...codexClasses(JSON.parse(readFileSync(join(dir, 'models_cache.json'), 'utf8'))) }
    return { models: { ...DEFAULT_MODELS, codex }, judge: { ...DEFAULT_CONFIG.judge, codex: codex.mid } }
  } catch {
    return { models: DEFAULT_MODELS, judge: DEFAULT_CONFIG.judge }
  }
}

export function config() {
  const d = detected()
  let c = {}
  try {
    c = JSON.parse(readFileSync(join(home(), 'config.json'), 'utf8'))
  } catch {}
  return {
    ...DEFAULT_CONFIG,
    ...c,
    judge: { ...d.judge, ...c.judge },
    models: { claude: { ...d.models.claude, ...c.models?.claude }, codex: { ...d.models.codex, ...c.models?.codex } },
  }
}

export function corrections() {
  try {
    return readFileSync(join(home(), 'corrections.jsonl'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .flatMap(l => {
        try {
          const c = JSON.parse(l)
          return c && typeof c === 'object' && !Array.isArray(c) ? [c] : []
        } catch {
          return []
        }
      })
  } catch {
    return []
  }
}

export function addCorrections(list) {
  if (list.length === 0) return
  appendFileSync(join(ensure(home()), 'corrections.jsonl'), list.map(c => JSON.stringify(c) + '\n').join(''))
}

const sessionFile = (host, id) => join(ensure(join(home(), 'sessions')), `${host}-${String(id).replace(/[^\w.-]/g, '_')}.json`)

export function session(host, id) {
  try {
    const s = JSON.parse(readFileSync(sessionFile(host, id), 'utf8'))
    return s && typeof s === 'object' && !Array.isArray(s) ? s : {}
  } catch {
    return {}
  }
}

export function saveSession(host, id, s) {
  writeFileSync(sessionFile(host, id), JSON.stringify(s))
}

export function log(entry) {
  try {
    appendFileSync(join(ensure(home()), 'log.jsonl'), JSON.stringify({ at: Date.now(), ...entry }) + '\n')
  } catch {}
}
