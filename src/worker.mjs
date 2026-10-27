#!/usr/bin/env node
import { isMain } from './main.mjs'
import { complete } from './host.mjs'
import { judgePrompt, parseRule } from './judge.mjs'
import { isUserInput } from './input.mjs'
import { isProjectKey } from './scope.mjs'
import { appendCaptured, captureAuthorized, logCaptured } from './store.mjs'

export async function judgeJob(job, { completeFn = complete, saveFn = appendCaptured, logFn } = {}) {
  if (!job || !['claude', 'codex'].includes(job.host) || !isProjectKey(job.project) || job.origin !== 'interactive-user' || (typeof job.sessionId !== 'string' || !job.sessionId.trim()) || !Number.isFinite(job.at) || job.at <= 0 || (typeof job.answer !== 'string' || !job.answer.trim()) || (typeof job.reply !== 'string' || !isUserInput(job.reply, job))) return { skipped: true, correction: false, reason: 'invalid-provenance' }
  const ticket = job.captureAuthorization
  if (!captureAuthorized(ticket)) return { skipped: true, correction: false, reason: 'revoked' }
  const rule = parseRule(await completeFn(job.host, job.model, judgePrompt(job.answer, job.reply), 90_000))
  if (!captureAuthorized(ticket)) return { skipped: true, correction: false, reason: 'revoked' }
  if (rule) {
    const saved = saveFn([{ at: job.at, about: String(job.about ?? '').slice(0, 300), quote: String(job.reply).slice(0, 800), rule, host: job.host, src: 'live', project: job.project, origin: job.origin, sessionId: job.sessionId }], ticket)
    if (saved === false) return { skipped: true, correction: false, reason: 'revoked-or-unwritable' }
  }
  const entry = { host: job.host, kind: 'judge', correction: !!rule, ...(process.env.OTW_DEBUG ? { answer: String(job.answer).slice(0, 160), reply: String(job.reply).slice(0, 80) } : {}) }
  if (logFn) logFn(entry)
  else logCaptured(entry, ticket)
  return { skipped: false, correction: !!rule }
}
async function main() {
  let raw = '', job
  for await (const chunk of process.stdin) raw += chunk
  try { job = JSON.parse(raw); await judgeJob(job) }
  catch (err) { if (job?.captureAuthorization) logCaptured({ kind: 'judge-error', name: err?.name ?? 'Error', ...(process.env.OTW_DEBUG ? { message: String(err?.message ?? err) } : {}) }, job.captureAuthorization) }
}
if (isMain(import.meta.url)) main()
