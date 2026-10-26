// Turn ends from the history both CLIs already keep on the machine: (the end of an answer, the message the person
// typed next, the request that answer was for). Only what the person typed counts as a message.
import { closeSync, openSync, readdirSync, readSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { typedPart, isUserInput, isNonhumanMetadata, isPassiveContext } from './input.mjs'
import { projectKey } from './scope.mjs'
export { typedPart } from './input.mjs'

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
// image or a tool dump. It may still carry cwd/source metadata, so parsers treat
// unreadable rows as boundaries rather than silently inheriting an earlier scope.
export const MAX_LINE = 1 << 20
const UNREADABLE_RECORD = Symbol('unreadable transcript record')
export function* lines(p, { boundaries = false } = {}) {
  const fd = openSync(p, 'r')
  const buf = Buffer.alloc(1 << 20)
  let parts = []
  let size = 0
  const emit = function* () {
    if (size > 0 && size <= MAX_LINE) {
      try {
        yield JSON.parse(Buffer.concat(parts).toString('utf8'))
      } catch {
        if (boundaries) yield UNREADABLE_RECORD
      }
    } else if (size > MAX_LINE && boundaries) yield UNREADABLE_RECORD
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

// isMeta also labels passive instruction injection. It is not by itself an
// actionable automated turn when the body is an explicit passive envelope.
function passiveMetadata(meta) {
  if (!meta || typeof meta !== 'object') return meta
  const clean = { ...meta, isMeta: false }
  for (const key of ['message', 'payload', 'metadata']) {
    if (meta[key] && meta[key] !== meta) clean[key] = passiveMetadata(meta[key])
  }
  return clean
}

// Shared exchange state: only an answer following a human request can form a pair.
function exchange(host) {
  let answer = '', request = '', scope, acceptingAnswer = false
  const out = []
  return {
    out,
    reset() { answer = ''; request = ''; scope = undefined; acceptingAnswer = false },
    passive() { acceptingAnswer = false },
    answer(text) { if (acceptingAnswer && typeof text === 'string' && text.trim()) answer = text },
    user(text, meta, at, project) {
      if (!isUserInput(text, meta)) {
        // Explicit automation metadata takes precedence over a passive-looking body.
        if (isPassiveContext(text) && !isNonhumanMetadata(passiveMetadata(meta))) this.passive()
        else this.reset()
        return
      }
      // Changing cwd cannot turn an answer from another working directory into recall.
      if (answer && scope === project) out.push({ at, answer: answer.slice(-600), reply: text.slice(0, 800), about: request.slice(0, 300), host, ...(scope ? { project: scope } : {}), origin: 'history-user' })
      request = text
      answer = ''
      scope = project
      acceptingAnswer = true
    },
  }
}

// Only explicit record markers count as compaction, not prose mentioning a summary.
function isCompaction(d, host) {
  const records = [d, d.message, d.payload].filter(x => x && typeof x === 'object')
  const markers = host === 'claude'
    ? ['compact_boundary', 'compacted', 'summary']
    : ['context_compacted', 'compacted']
  return records.some(r => r.isCompactSummary || r.compacted === true ||
    [r.type, r.subtype].some(value => markers.includes(value)))
}

// Provenance recovery must come from an authoritative context, not a user-shaped
// payload inside an automated turn. Missing/unknown context never clears a latch.
function contextSource(d) {
  const records = [d, d.payload, d.metadata, d.payload?.metadata].filter(x => x && typeof x === 'object')
  const entries = records.flatMap(r => ['source', 'origin', 'thread_source', 'threadSource', 'input_source', 'inputSource', 'role']
    .filter(k => Object.hasOwn(r, k)).map(k => [k, r[k]]))
  return {
    signature: entries.length ? JSON.stringify(entries) : undefined,
    interactive: records.some(r => ['cli', 'vscode', 'user'].includes(r.source) || r.thread_source === 'user' || r.threadSource === 'user'),
  }
}

// Claude Code: cwd comes only from explicit transcript records, never the filename.
export function claudePairs(file) {
  const state = exchange('claude')
  let project
  for (const d of lines(file, { boundaries: true })) {
    if (d === UNREADABLE_RECORD || !d || typeof d !== 'object' || Array.isArray(d)) {
      state.reset()
      project = undefined
      continue
    }
    if (Object.hasOwn(d, 'cwd')) {
      const next = projectKey(d.cwd)
      // Explicit invalid cwd is a boundary too; omission alone preserves context.
      if (!next || next !== project) state.reset()
      project = next
    }
    if (isCompaction(d, 'claude')) { state.reset(); continue }
    const at = Date.parse(d.timestamp ?? '') || 0
    if (d.type === 'assistant') {
      if (isNonhumanMetadata(d, { allowAssistantRole: true })) state.reset()
      else state.answer(textOf(d.message?.content))
    } else if (d.type === 'user') {
      const c = d.message?.content
      // Tool-result messages continue the human turn, including mixed hook notes.
      if (Array.isArray(c) && c.some(x => x?.type === 'tool_result')) continue
      state.user(typedPart(textOf(c)), d, at, project)
    } else if (d.type === 'session_meta' && isNonhumanMetadata(d)) return []
  }
  return state.out
}

// Codex session_meta / turn_context are the sole cwd authorities.
export function codexPairs(file) {
  const state = exchange('codex')
  let project, sourceSignature
  let blockedContext = false
  for (const d of lines(file, { boundaries: true })) {
    if (d === UNREADABLE_RECORD || !d || typeof d !== 'object' || Array.isArray(d)) {
      state.reset()
      project = undefined
      continue
    }
    const p = d.payload ?? {}
    if (d.type === 'session_meta' || d.type === 'turn_context') {
      if (Object.hasOwn(p, 'cwd')) {
        const next = projectKey(p.cwd)
        if (!next || next !== project) state.reset()
        project = next
      }
      const source = contextSource(d)
      if (source.signature !== undefined) {
        if (source.signature !== sourceSignature) state.reset()
        sourceSignature = source.signature
      }
      if (isNonhumanMetadata(d)) {
        blockedContext = true
        state.reset()
      } else if (source.interactive && blockedContext) {
        blockedContext = false
        state.reset()
      }
    }
    if (isCompaction(d, 'codex')) { state.reset(); continue }
    if (blockedContext) continue
    const at = Date.parse(d.timestamp ?? '') || 0
    if (d.type === 'event_msg' && p.type === 'task_complete') {
      if (isNonhumanMetadata(d, { allowAssistantRole: true })) state.reset()
      else state.answer(p.last_agent_message)
    } else if (d.type === 'response_item' && p.type === 'message' && p.role === 'assistant') {
      if (isNonhumanMetadata(d, { allowAssistantRole: true })) state.reset()
    } else if (d.type === 'response_item' && p.type === 'message' && p.role === 'user') {
      if (Array.isArray(p.content) && p.content.some(x => x?.type === 'tool_result')) continue
      state.user(typedPart(textOf(p.content)), d, at, project)
    }
  }
  return state.out
}

export function historyPairs({ days = 30, hosts = ['claude', 'codex'], claudeDir, codexDir } = {}) {
  const since = days > 0 ? Date.now() - days * 86_400_000 : 0 // 0: no time limit
  const recent = (name, p) => name.endsWith('.jsonl') && statSync(p).mtimeMs >= since
  const pairs = []
  if (hosts.includes('claude')) for (const f of files(claudeDir ?? join(homedir(), '.claude', 'projects'), recent)) pairs.push(...claudePairs(f))
  if (hosts.includes('codex')) for (const f of files(codexDir ?? join(homedir(), '.codex', 'sessions'), (n, p) => n.startsWith('rollout-') && recent(n, p))) pairs.push(...codexPairs(f))
  return pairs.filter(p => p.at >= since).sort((a, b) => a.at - b.at)
}
