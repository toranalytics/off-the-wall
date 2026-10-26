import { createHash } from 'node:crypto'
import { realpathSync } from 'node:fs'
import { posix, win32 } from 'node:path'

// A cwd scope is deliberately NOT a repository/worktree-root scope.
export function projectKey(cwd) {
  if (typeof cwd !== 'string' || !cwd.trim() || cwd.includes('\0')) return undefined
  // Slash-leading paths are POSIX, including // paths. UNC must use its explicit
  // backslash prefix, avoiding case-folding valid POSIX directories.
  const windows = /^[a-z]:[\\/]/i.test(cwd) || /^\\\\[^\\/]+[\\/][^\\/]+/.test(cwd)
  const paths = windows ? win32 : posix
  if (!paths.isAbsolute(cwd)) return undefined
  let canonical = paths.normalize(cwd)
  // Never resolve a Windows fixture relative to this process's POSIX cwd.
  if (!windows || process.platform === 'win32') {
    try { canonical = realpathSync(canonical) } catch {}
  }
  canonical = paths.normalize(canonical)
  const root = paths.parse(canonical).root
  while (canonical.length > root.length && (windows ? /[\\/]$/ : /\/$/).test(canonical)) canonical = canonical.slice(0, -1)
  if (windows) canonical = canonical.toLowerCase()
  return `cwd:${createHash('sha256').update(canonical).digest('hex')}`
}
export const isProjectKey = key => typeof key === 'string' && /^cwd:[0-9a-f]{64}$/.test(key)
