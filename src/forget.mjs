// `otw forget`: delete what Off the Wall stored, on request. Foreground only; it never runs from a hook.
// Deleting or replacing corrections.jsonl changes its file identity, so any capture that was already authorized
// (see store.mjs) is rejected when it tries to append afterwards.
import { lstatSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { projectKey } from './scope.mjs'

const kind = path => { try { const s = lstatSync(path); return s.isSymbolicLink() ? 'link' : s.isFile() ? 'file' : s.isDirectory() ? 'dir' : 'other' } catch { return 'none' } }
const parse = line => { try { const v = JSON.parse(line); return v && typeof v === 'object' && !Array.isArray(v) ? v : null } catch { return null } }

function sessionFiles(root) {
  const dir = join(root, 'sessions')
  if (kind(dir) !== 'dir') return []
  return readdirSync(dir).filter(n => /\.(json|tmp)$/.test(n)).map(n => join(dir, n)).filter(p => kind(p) === 'file')
}

// scope: { all: true } or { project: '<cwd:key>' }. Returns what exists and what would go; does not change anything.
export function planForget(root, scope) {
  const out = { problems: [], corrections: { total: 0, remove: 0, keep: 0, unreadable: 0 }, sessions: [], log: false, keptLines: null }
  const file = join(root, 'corrections.jsonl')
  const k = kind(file)
  if (k === 'link' || k === 'dir' || k === 'other') out.problems.push('corrections.jsonl is not a regular file; nothing was touched')
  else if (k === 'file') {
    const lines = readFileSync(file, 'utf8').split('\n').filter(Boolean)
    const kept = []
    for (const line of lines) {
      const c = parse(line)
      const drop = scope.all || (c && c.project === scope.project)
      out.corrections.total++
      if (!c) out.corrections.unreadable++
      if (drop) out.corrections.remove++
      else { out.corrections.keep++; kept.push(line) }
    }
    out.keptLines = kept
  }
  for (const path of sessionFiles(root)) {
    if (scope.all) { out.sessions.push(path); continue }
    try { if (JSON.parse(readFileSync(path, 'utf8'))?.project === scope.project) out.sessions.push(path) } catch {}
  }
  if (scope.all) out.log = kind(join(root, 'log.jsonl')) === 'file'
  return out
}

export function applyForget(root, scope, plan) {
  const done = { corrections: 0, sessions: 0, log: false }
  if (!plan.problems.length && plan.keptLines && plan.corrections.remove) {
    const file = join(root, 'corrections.jsonl')
    if (scope.all) unlinkSync(file)
    else {
      // New file, new identity: an already-authorized append to the old one is rejected.
      const temp = `${file}.${randomUUID()}.tmp`
      try { writeFileSync(temp, plan.keptLines.map(l => l + '\n').join(''), { flag: 'wx', mode: 0o600 }); renameSync(temp, file) }
      finally { try { unlinkSync(temp) } catch {} }
    }
    done.corrections = plan.corrections.remove
  }
  for (const path of plan.sessions) { try { unlinkSync(path); done.sessions++ } catch {} }
  if (plan.log) { try { unlinkSync(join(root, 'log.jsonl')); done.log = true } catch {} }
  return done
}

export const USAGE = `otw forget --all [--yes]
  Deletes every stored correction, the per-session state and the diagnostic log under the Off the Wall folder.
  config.json stays. Without --yes it only shows what would be deleted.
otw forget --project [DIR] [--yes]
  Deletes only the corrections (and session state) recorded for that working directory (default: the current one).
  The diagnostic log is not touched in this mode.
Nothing outside the Off the Wall folder is changed: Claude Code and Codex histories and anything your model provider
already received stay as they are.`

export function runForget(root, args, cwd) {
  const has = n => args.includes(`--${n}`)
  const arg = n => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null }
  const known = new Set(['--all', '--project', '--yes'])
  const stray = args.filter((a, i) => a.startsWith('--') ? !known.has(a) : args[i - 1] !== '--project')
  if (stray.length || has('all') === has('project')) return { code: 2, lines: [USAGE] }
  let scope
  if (has('all')) scope = { all: true }
  else {
    const dir = arg('project') ?? cwd
    const key = projectKey(dir)
    if (!key) return { code: 2, lines: [`not an absolute directory: ${dir}`] }
    scope = { project: key }
  }
  const plan = planForget(root, scope)
  const lines = []
  if (plan.problems.length) return { code: 1, lines: plan.problems }
  const c = plan.corrections
  lines.push(`folder ${root}`)
  lines.push(`corrections: ${c.remove} of ${c.total} ${has('yes') ? 'deleted' : 'would be deleted'}${c.unreadable ? ` (${c.unreadable} unreadable line${c.unreadable === 1 ? '' : 's'}${scope.all ? '' : ' kept'})` : ''}`)
  lines.push(`session state files: ${plan.sessions.length} ${has('yes') ? 'deleted' : 'would be deleted'}`)
  if (scope.all) lines.push(`diagnostic log: ${plan.log ? (has('yes') ? 'deleted' : 'would be deleted') : 'none'}`)
  if (!has('yes')) { lines.push('nothing was deleted. Add --yes to delete.'); return { code: 0, lines } }
  applyForget(root, scope, plan)
  lines.push('Claude Code and Codex histories and text already sent to a model provider are not affected.')
  return { code: 0, lines }
}
