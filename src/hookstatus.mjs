// Diagnostics only: session contents and config values never enter the output.
import { readdirSync, statSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const TRUST_HINT = 'Codex skips plugin hooks until you trust them: open /hooks (or accept "Hooks need review" at startup) and choose Trust all.'

function relativeTime(mtime, now) {
  const seconds = Math.max(0, Math.floor((now - mtime) / 1000))
  if (seconds < 60) return 'just now'
  for (const [unit, size] of [['day', 86400], ['hour', 3600], ['minute', 60]]) {
    if (seconds >= size) {
      const count = Math.floor(seconds / size)
      return `${count} ${unit}${count === 1 ? '' : 's'} ago`
    }
  }
}

export function hookActivity(otwHome, now = Date.now()) {
  let newest
  try {
    const dir = join(otwHome, 'sessions')
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const match = /^([a-z][a-z0-9_]*)-.+\.json$/i.exec(entry.name)
      if (!entry.isFile() || !match) continue
      try {
        const stat = statSync(join(dir, entry.name))
        if (stat.isFile() && (!newest || stat.mtimeMs > newest.mtime)) newest = { host: match[1], mtime: stat.mtimeMs }
      } catch {} // An entry may disappear during inspection.
    }
  } catch {} // Missing or unreadable session directories are not fatal.
  return newest
    ? [`hooks: last activity ${newest.host} ${relativeTime(newest.mtime, now)}`]
    : ['hooks: no activity recorded yet', TRUST_HINT]
}

// Deliberately a narrow text check, not a TOML parser or proof that hooks will run.
export function codexTrust(codexHome = process.env.CODEX_HOME || join(homedir(), '.codex')) {
  let text
  try { text = readFileSync(join(codexHome, 'config.toml'), 'utf8') }
  catch { return null }
  let count = 0, target = false, counted = false, multiline = null
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    // Avoid counting apparent sections inside TOML multiline string values.
    if (multiline) {
      if (line.includes(multiline)) multiline = null
      continue
    }
    if (line.startsWith('#')) continue
    if (line.startsWith('[')) {
      target = /^\[hooks\.state\."off-the-wall@(?:[^"\\]|\\.)+"\]\s*(?:#.*)?$/.test(line)
      counted = false
    } else if (target && !counted && /^trusted_hash\s*=\s*[^#\s]/.test(line)) {
      count++; counted = true
    }
    const value = /^[^#=]+\s*=\s*(.*)$/.exec(line)?.[1]
    for (const quote of ['"""', "'''"]) {
      if (value?.startsWith(quote) && !value.slice(3).includes(quote)) multiline = quote
    }
  }
  return count ? `codex hooks: ${count} trusted entries` : 'codex hooks: none found (trust them in /hooks)'
}

export function hookStatus(otwHome, options = {}) {
  const lines = hookActivity(otwHome, options.now)
  const trust = codexTrust(options.codexHome)
  if (trust !== null) lines.push(trust)
  return lines
}
