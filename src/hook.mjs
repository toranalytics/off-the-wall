#!/usr/bin/env node
// Shared Claude Code/Codex hook. Failures never block the host session.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { isMain } from './main.mjs'
import { authorizeCapture, captureAuthorized, config, corrections, log, logCaptured, saveSession, session } from './store.mjs'
import { correctionBlock, langOf, pickCorrections } from './similar.mjs'
import { denyReason, policy, subagentCall } from './policy.mjs'
import { isNonhumanMetadata, isPassiveContext, isUserInput, typedPart } from './input.mjs'
import { projectKey } from './scope.mjs'

const WORKER = fileURLToPath(new URL('./worker.mjs', import.meta.url))
export const typed = (text, meta = {}) => isUserInput(text, meta)
const context = (event, text) => ({ hookSpecificOutput: { hookEventName: event, additionalContext: text } })
const emptyPair = () => ({ lastPrompt: '', lastAnswer: '', pairable: false, captureTurn: false, captureAuthorization: undefined })

export function handle(host, e, { now = Date.now(), cfg = config(), spawnJudge = detachedJudge } = {}) {
  const ev = e.hook_event_name
  const knownId = typeof e.session_id === 'string' && e.session_id.trim() !== '' && e.session_id !== 'unknown'
  const id = knownId ? e.session_id : 'unknown'
  const project = projectKey(e.cwd)
  if (ev === 'SessionStart') {
    const s = session(host, id)
    const nonhumanSession = !!s.nonhumanSession || isNonhumanMetadata({ ...e, source: ['startup', 'resume', 'clear', 'compact'].includes(e.source) ? undefined : e.source })
    const keep = !nonhumanSession && cfg.capture && knownId && project && s.project === project && s.memoryVersion === 2 && !['clear', 'compact'].includes(e.source)
    saveSession(host, id, { ...s, ...(!keep ? emptyPair() : {}), project, memoryVersion: 2, nonhumanSession, primed: cfg.routing })
    return cfg.routing ? context('SessionStart', policy(host, cfg.models[host])) : null
  }
  if (ev === 'PostCompact') {
    const s = session(host, id)
    if (Object.keys(s).length) saveSession(host, id, { ...s, ...emptyPair(), memoryVersion: 2, primed: false })
    return null
  }
  if (ev === 'UserPromptSubmit') {
    const prompt = typedPart(typeof e.prompt === 'string' ? e.prompt : '')
    const s = session(host, id)
    const same = !!project && s.project === project && s.memoryVersion === 2
    const human = !s.nonhumanSession && isUserInput(prompt, e)
    const ticket = cfg.capture === true && human && knownId && project ? authorizeCapture() : null
    const canCapture = !!ticket
    const next = { ...s, ...emptyPair(), project, memoryVersion: 2, turn: (s.turn ?? 0) + 1 }
    if (canCapture) {
      if (same && s.pairable && s.lastAnswer && captureAuthorized(s.captureAuthorization)) spawnJudge({ host, model: cfg.judge[host], answer: s.lastAnswer, reply: prompt, about: s.lastPrompt ?? '', at: now, project, origin: 'interactive-user', sessionId: id, captureAuthorization: s.captureAuthorization })
      next.lastPrompt = prompt.slice(0, 300)
      next.pairable = true
      next.captureTurn = true
      next.captureAuthorization = ticket
    } else if (!human && cfg.capture && same && knownId && !s.nonhumanSession && !isNonhumanMetadata(e) && isPassiveContext(prompt)) {
      // Passive context is not a new turn. Freeze later assistant updates.
      next.lastPrompt = s.lastPrompt ?? ''
      next.lastAnswer = s.lastAnswer ?? ''
      next.pairable = !!s.pairable
      next.captureAuthorization = s.captureAuthorization
    }
    const parts = []
    if (human && cfg.routing && !s.primed) {
      parts.push(policy(host, cfg.models[host]))
      next.primed = true
    }
    if (human && cfg.recall && project) {
      const cs = pickCorrections(corrections(), prompt, now, undefined, project)
      if (cs.length) parts.push(correctionBlock(cs, langOf(prompt)))
    }
    saveSession(host, id, next)
    return parts.length ? context('UserPromptSubmit', parts.join('\n\n')) : null
  }
  if (ev === 'Stop') {
    const s = session(host, id)
    const answer = String(e.last_assistant_message ?? '')
    const same = !!project && s.project === project && s.memoryVersion === 2
    const nonhuman = s.nonhumanSession || isNonhumanMetadata(e, { allowAssistantRole: true })
    if (cfg.capture === true && knownId && same && s.pairable && s.captureTurn && !nonhuman && captureAuthorized(s.captureAuthorization)) {
      if (answer) saveSession(host, id, { ...s, lastAnswer: answer.slice(-600) })
    } else if (Object.keys(s).length && (!cfg.capture || !same || nonhuman || !captureAuthorized(s.captureAuthorization))) saveSession(host, id, { ...s, ...emptyPair() })
    return {}
  }
  if (ev === 'PreToolUse' && cfg.routing) {
    const call = subagentCall(host, e.tool_name, e.tool_input)
    if (!call) return null
    const s = session(host, id)
    log({ host, kind: 'subagent', named: call.named, model: call.model ?? null, effort: call.effort ?? null })
    if (call.named || s.deniedTurn === s.turn) return null
    saveSession(host, id, { ...s, deniedTurn: s.turn })
    return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: denyReason(host) } }
  }
  return null
}
function detachedJudge(job) {
  const p = spawn(process.execPath, [WORKER], { detached: true, stdio: ['pipe', 'ignore', 'ignore'], env: { ...process.env, OTW_CHILD: '1' } })
  p.on('error', err => logCaptured({ kind: 'judge-spawn-error', code: err.code ?? 'spawn-error' }, job.captureAuthorization))
  p.stdin.on('error', () => {})
  p.stdin.end(JSON.stringify(job))
  p.unref()
}
async function main() {
  const host = process.argv[2] === 'codex' ? 'codex' : 'claude'
  if (process.env.OTW_CHILD === '1') { process.stdout.write('{}'); return }
  let raw = ''
  for await (const chunk of process.stdin) raw += chunk
  let out = null
  try {
    const e = JSON.parse(raw)
    if (process.env.OTW_DEBUG) log({ host, kind: 'event', event: e.hook_event_name, tool: e.tool_name ?? null, input: e.tool_input ? Object.keys(e.tool_input) : null })
    out = handle(host, e)
  } catch (err) { log({ host, kind: 'error', name: err?.name ?? 'Error', ...(process.env.OTW_DEBUG ? { message: String(err?.message ?? err) } : {}) }) }
  process.stdout.write(out ? JSON.stringify(out) : '{}')
}
if (isMain(import.meta.url)) main()
