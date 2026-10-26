#!/usr/bin/env node
// Detached, origin-tagged capture. Invalid/unscoped jobs never call a model.
import { isMain } from './main.mjs'
import { complete } from './host.mjs'
import { judgePrompt, parseRule } from './judge.mjs'
import { isUserInput } from './input.mjs'
import { isProjectKey } from './scope.mjs'
import { addCorrections, log } from './store.mjs'

export async function judgeJob(job, { completeFn = complete, saveFn = addCorrections, logFn = log } = {}) {
  if (!job || !['claude', 'codex'].includes(job.host) || !isProjectKey(job.project) || job.origin !== 'interactive-user' || (typeof job.sessionId !== 'string' || !job.sessionId.trim()) || !Number.isFinite(job.at) || job.at <= 0 || (typeof job.answer !== 'string' || !job.answer.trim()) || (typeof job.reply !== 'string' || !isUserInput(job.reply, job))) {
    logFn({ kind: 'judge-skipped', reason: 'missing-or-nonhuman-provenance' })
    return { skipped: true, correction: false }
  }
  const rule = parseRule(await completeFn(job.host, job.model, judgePrompt(job.answer, job.reply), 90_000))
  if (rule) saveFn([{ at: job.at, about: String(job.about ?? '').slice(0, 300), quote: String(job.reply).slice(0, 800), rule, host: job.host, src: 'live', project: job.project, origin: job.origin, sessionId: job.sessionId }])
  logFn({ host: job.host, kind: 'judge', correction: !!rule, ...(process.env.OTW_DEBUG ? { answer: String(job.answer).slice(0, 160), reply: String(job.reply).slice(0, 80) } : {}) })
  return { skipped: false, correction: !!rule }
}
async function main() {
  let raw = ''
  for await (const chunk of process.stdin) raw += chunk
  try { await judgeJob(JSON.parse(raw)) }
  catch (err) { log({ kind: 'judge-error', name: err?.name ?? 'Error', ...(process.env.OTW_DEBUG ? { message: String(err?.message ?? err) } : {}) }) }
}
if (isMain(import.meta.url)) main()
