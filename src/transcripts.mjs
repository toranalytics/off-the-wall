// Turn ends from the history both CLIs already keep on the machine: (the end of an answer, the message the person
// typed next, the request that answer was for). Only what the person typed counts as a message.
import { closeSync, openSync, readdirSync, readSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { typed } from './hook.mjs'

function files(dir, keep, out = []) {
  let entries = []
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const d of entries) {
    const p = join(dir, d.name)
    if (d.isDirectory()) {
      if (d.name !== 'subagents') files(p, keep, out)
    } else if (keep(d.name, p)) out.push(p)
  }
  return out
}

// Read in chunks: a long Codex session can pass 500 MB, more than one string can hold. A line over MAX_LINE is an
// image or a tool dump, never typed text or a final answer, and is skipped without parsing.
export const MAX_LINE = 1 << 20
export function* lines(p) {
  const fd = openSync(p, 'r')
  const buf = Buffer.alloc(1 << 20)
  let parts = []
  let size = 0
  const emit = function* () {
    if (size > 0 && size <= MAX_LINE) {
      try {
        yield JSON.parse(Buffer.concat(parts).toString('utf8'))
      } catch {}
    }
    parts = []
    size = 0
  }
  try {
    for (let n; (n = readSync(fd, buf, 0, buf.length, null)) > 0; ) {
      let start = 0
      for (let i = buf.indexOf(10, 0); i >= 0 && i < n; i = buf.indexOf(10, start)) {
        if (size + (i - start) <= MAX_LINE) parts.push(Buffer.from(buf.subarray(start, i)))
        size += i - start
        yield* emit()
        start = i + 1
      }
      if (start < n) {
        if (size + (n - start) <= MAX_LINE) parts.push(Buffer.from(buf.subarray(start, n)))
        size += n - start
      }
    }
    yield* emit()
  } finally {
    closeSync(fd)
  }
}

const textOf = content =>
  typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content.filter(c => c?.type === 'text' || c?.type === 'input_text' || c?.type === 'output_text').map(c => c.text).join('\n')
      : ''

// Claude Code: ~/.claude/projects/<folder>/<session>.jsonl
export function claudePairs(file) {
  const out = []
  let answer = ''
  let request = ''
  for (const d of lines(file)) {
    if (d.isSidechain) continue
    const at = Date.parse(d.timestamp ?? '') || 0
    if (d.type === 'assistant') {
      const t = textOf(d.message?.content)
      if (t.trim()) answer = t
    } else if (d.type === 'user' && !d.isMeta && !d.isCompactSummary && !d.toolUseResult) {
      const c = d.message?.content
      if (Array.isArray(c) && c.some(x => x?.type === 'tool_result')) continue
      const t = textOf(c)
      if (!typed(t)) continue
      if (answer) out.push({ at, answer: answer.slice(-600), reply: t.slice(0, 800), about: request.slice(0, 300), host: 'claude' })
      request = t
      answer = ''
    }
  }
  return out
}

// Codex: ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl. Each turn's final answer is task_complete's
// last_agent_message; user-role messages that start with injected instructions are not typed.
const CODEX_INJECTED = /^(#\s*AGENTS\.md|<|\[)/
// With attachments Codex sends "# Files mentioned by the user: … ## My request: <what was typed>".
const MY_REQUEST = /^\s*#\s*Files mentioned by the user:[\s\S]*?\n##\s*My request[^\n]*:\s*\n/
export const typedPart = t => t.replace(MY_REQUEST, '')
export function codexPairs(file) {
  const out = []
  let answer = ''
  let request = ''
  for (const d of lines(file)) {
    const p = d.payload ?? {}
    // Threads Codex starts itself (approval reviews, spawned subagents) carry a subagent source or a non-user
    // thread source; their "user" messages are written by Codex. Seen 2026-10: 68 of 100 recent rollouts.
    if (d.type === 'session_meta' && (typeof p.source === 'object' || (p.thread_source && p.thread_source !== 'user'))) return []
    const at = Date.parse(d.timestamp ?? '') || 0
    if (d.type === 'event_msg' && p.type === 'task_complete' && p.last_agent_message) answer = p.last_agent_message
    else if (d.type === 'response_item' && p.type === 'message' && p.role === 'user') {
      const t = typedPart(textOf(p.content))
      if (!typed(t) || CODEX_INJECTED.test(t.trim())) continue
      if (answer) out.push({ at, answer: answer.slice(-600), reply: t.slice(0, 800), about: request.slice(0, 300), host: 'codex' })
      request = t
      answer = ''
    }
  }
  return out
}

export function historyPairs({ days = 30, hosts = ['claude', 'codex'], claudeDir, codexDir } = {}) {
  const since = days > 0 ? Date.now() - days * 86_400_000 : 0 // 0: no time limit
  const recent = (name, p) => name.endsWith('.jsonl') && statSync(p).mtimeMs >= since
  const pairs = []
  if (hosts.includes('claude')) for (const f of files(claudeDir ?? join(homedir(), '.claude', 'projects'), recent)) pairs.push(...claudePairs(f))
  if (hosts.includes('codex')) for (const f of files(codexDir ?? join(homedir(), '.codex', 'sessions'), (n, p) => n.startsWith('rollout-') && recent(n, p))) pairs.push(...codexPairs(f))
  return pairs.filter(p => p.at >= since).sort((a, b) => a.at - b.at)
}
