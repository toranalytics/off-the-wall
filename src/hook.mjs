#!/usr/bin/env node
// The one hook program for both hosts: `node hook.mjs claude` or `node hook.mjs codex`. It reads the event on stdin
// and prints its answer on stdout. Every failure lets the session go on untouched.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { config, corrections, log, saveSession, session } from './store.mjs'
import { correctionBlock, langOf, pickCorrections } from './similar.mjs'
import { denyReason, policy, subagentCall } from './policy.mjs'

const WORKER = fileURLToPath(new URL('./worker.mjs', import.meta.url))

// Text that arrives as a prompt but nobody typed: slash commands, command output, injected reminders.
export const typed = text => {
  const t = String(text ?? '').trim()
  return t.length > 0 && !/^(\/|<|\[Request interrupted|Caveat:)/.test(t)
}

const context = (event, text) => ({ hookSpecificOutput: { hookEventName: event, additionalContext: text } })

// One event in, the answer out (an object to print, or null for nothing). `spawnJudge` is a seam for tests.
export function handle(host, e, { now = Date.now(), cfg = config(), spawnJudge = detachedJudge } = {}) {
  const ev = e.hook_event_name
  const id = e.session_id ?? 'unknown'

  if (ev === 'SessionStart') {
    const s = session(host, id)
    saveSession(host, id, { ...s, primed: cfg.routing })
    return cfg.routing ? context('SessionStart', policy(host, cfg.models[host])) : null
  }

  if (ev === 'PostCompact') {
    // The routing text may be gone with the compacted history: the next prompt carries it again.
    saveSession(host, id, { ...session(host, id), primed: false })
    return null
  }

  if (ev === 'UserPromptSubmit') {
    const prompt = String(e.prompt ?? '')
    const s = session(host, id)
    const next = { ...s, turn: (s.turn ?? 0) + 1 }
    if (typed(prompt)) {
      if (cfg.capture && s.lastAnswer) spawnJudge({ host, model: cfg.judge[host], answer: s.lastAnswer, reply: prompt, about: s.lastPrompt ?? '', at: now })
      next.lastPrompt = prompt.slice(0, 300)
    }
    const parts = []
    if (cfg.routing && !s.primed) {
      parts.push(policy(host, cfg.models[host]))
      next.primed = true
    }
    if (cfg.recall && typed(prompt)) {
      const cs = pickCorrections(corrections(), prompt, now)
      if (cs.length) parts.push(correctionBlock(cs, langOf(prompt)))
    }
    saveSession(host, id, next)
    return parts.length ? context('UserPromptSubmit', parts.join('\n\n')) : null
  }

  if (ev === 'Stop') {
    const answer = String(e.last_assistant_message ?? '')
    if (answer) saveSession(host, id, { ...session(host, id), lastAnswer: answer.slice(-600) })
    return {}
  }

  if (ev === 'PreToolUse' && cfg.routing) {
    const call = subagentCall(host, e.tool_name, e.tool_input)
    if (!call) return null
    const s = session(host, id)
    log({ host, kind: 'subagent', named: call.named, model: call.model ?? null, effort: call.effort ?? null })
    // Sent back once per turn; a second unnamed call runs as asked rather than block the work.
    if (call.named || s.deniedTurn === s.turn) return null
    saveSession(host, id, { ...s, deniedTurn: s.turn })
    return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: denyReason(host) } }
  }

  return null
}

function detachedJudge(job) {
  const p = spawn(process.execPath, [WORKER], { detached: true, stdio: ['pipe', 'ignore', 'ignore'], env: { ...process.env, OWNWORDS_CHILD: '1' } })
  p.stdin.end(JSON.stringify(job))
  p.unref()
}

async function main() {
  const host = process.argv[2] === 'codex' ? 'codex' : 'claude'
  if (process.env.OWNWORDS_CHILD === '1') {
    // The judge's own CLI run: Stop on Codex wants JSON, everything else wants nothing.
    process.stdout.write('{}')
    return
  }
  let raw = ''
  for await (const chunk of process.stdin) raw += chunk
  let out = null
  try {
    const e = JSON.parse(raw)
    if (process.env.OWNWORDS_DEBUG) log({ host, kind: 'event', event: e.hook_event_name, tool: e.tool_name ?? null, input: e.tool_input ? Object.keys(e.tool_input) : null })
    out = handle(host, e)
  } catch (err) {
    log({ host, kind: 'error', message: String(err?.message ?? err) })
  }
  process.stdout.write(out ? JSON.stringify(out) : '{}')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
