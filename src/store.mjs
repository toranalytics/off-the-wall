// Foreground actions may initialize storage. Detached writers may only append to the
// same existing files they were authorized for; they never recreate directories.
import { constants, openSync, closeSync, fstatSync, statSync, readFileSync, writeFileSync, writeSync, mkdirSync, renameSync, unlinkSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { loadConfig } from './config.mjs'
export { DEFAULT_CONFIG } from './config.mjs'
export const home = () => process.env.OTW_HOME || join(homedir(), '.otw')
export const config = () => loadConfig(home())
const ensure = dir => (mkdirSync(dir, { recursive: true, mode: 0o700 }), dir)
const identity = s => `${s.dev}:${s.ino}:${s.birthtimeNs ?? s.birthtimeMs}`
const directoryRevision = s => `${s.mtimeNs}:${s.ctimeNs}`
const stat = path => statSync(path, { bigint: true })
const epochFile = () => join(home(), '.capture-generation')
const epoch = () => {
  try { const value = readFileSync(epochFile(), 'utf8'); return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value) ? value : null }
  catch { return null }
}
function atomicWrite(file, value) {
  const temp = `${file}.${randomUUID()}.tmp`
  try { writeFileSync(temp, value, { flag: 'wx', mode: 0o600 }); renameSync(temp, file) }
  finally { try { unlinkSync(temp) } catch {} }
}
export function corrections() {
  try {
    return readFileSync(join(home(), 'corrections.jsonl'), 'utf8').split('\n').filter(Boolean).flatMap(line => {
      try { const c = JSON.parse(line); return c && typeof c === 'object' && !Array.isArray(c) ? [c] : [] }
      catch { return [] }
    })
  } catch { return [] }
}

// Called only at a foreground capture/seed boundary, never by a detached worker.
export function authorizeCapture() {
  const cfg = config()
  if (cfg.configIssue || cfg.capture !== true) return null
  try {
    ensure(join(home(), 'sessions'))
    if (!epoch()) atomicWrite(epochFile(), randomUUID())
    const files = {}
    for (const name of ['corrections.jsonl', 'log.jsonl']) {
      const fd = openSync(join(home(), name), constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT, 0o600)
      try { const s = fstatSync(fd, { bigint: true }); if (!s.isFile()) return null; files[name] = identity(s) }
      finally { closeSync(fd) }
    }
    const root = stat(home())
    const ticket = { configAbsenceRevision: cfg.configRevision === 'absent' ? directoryRevision(root) : '', version: 1, generation: epoch(), root: identity(root), corrections: files['corrections.jsonl'], log: files['log.jsonl'], configRevision: cfg.configRevision }
    return captureAuthorized(ticket) ? ticket : null
  } catch { return null }
}
export function captureAuthorized(ticket) {
  if (!ticket || ticket.version !== 1 || !['generation', 'root', 'corrections', 'log', 'configRevision'].every(k => typeof ticket[k] === 'string' && ticket[k])) return false
  const cfg = config()
  if (cfg.configIssue || cfg.capture !== true || cfg.configRevision !== ticket.configRevision) return false
  try {
    const root = stat(home())
    if (cfg.configRevision === 'absent' && directoryRevision(root) !== ticket.configAbsenceRevision) return false
    return epoch() === ticket.generation && identity(root) === ticket.root && identity(stat(join(home(), 'corrections.jsonl'))) === ticket.corrections
  } catch { return false }
}
function appendAuthorized(name, data, ticket) {
  let fd
  try {
    // No O_CREAT and no mkdir. Deletion after open leaves only an unlinked old fd,
    // and deletion/recreation before open is rejected by the bound file identity.
    fd = openSync(join(home(), name), constants.O_WRONLY | constants.O_APPEND)
    const opened = fstatSync(fd, { bigint: true })
    const expected = name === 'corrections.jsonl' ? ticket?.corrections : ticket?.log
    if (!opened.isFile() || identity(opened) !== expected || !captureAuthorized(ticket)) return false
    const bytes = Buffer.from(data)
    const written = writeSync(fd, bytes)
    if (written !== bytes.length) throw new Error('Incomplete storage append')
    return true
  } catch { return false }
  finally { if (fd !== undefined) closeSync(fd) }
}
export function appendCaptured(list, ticket) {
  if (!list.length) return captureAuthorized(ticket)
  return appendAuthorized('corrections.jsonl', list.map(c => JSON.stringify(c) + '\n').join(''), ticket)
}
export function logCaptured(entry, ticket) {
  return appendAuthorized('log.jsonl', JSON.stringify({ at: Date.now(), ...entry }) + '\n', ticket)
}
const sessionFile = (host, id) => join(home(), 'sessions', `${host}-${String(id).replace(/[^\w.-]/g, '_')}.json`)
export function session(host, id) {
  try { const s = JSON.parse(readFileSync(sessionFile(host, id), 'utf8')); return s && typeof s === 'object' && !Array.isArray(s) ? s : {} }
  catch { return {} }
}
export function saveSession(host, id, state) {
  const file = sessionFile(host, id)
  ensure(dirname(file))
  atomicWrite(file, JSON.stringify(state))
}
export function log(entry) {
  // Foreground diagnostics may create a log in an existing root, not a directory.
  // Detached writers and asynchronous launch errors must use logCaptured.
  try { const fd = openSync(join(home(), 'log.jsonl'), constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT, 0o600); try { writeSync(fd, JSON.stringify({ at: Date.now(), ...entry }) + '\n') } finally { closeSync(fd) } }
  catch {}
}
