#!/usr/bin/env node
// Detached from the hook: judges one (previous answer, new prompt) pair and records a correction. The prompt the
// person sent has already gone on; this never holds it.
import { complete } from './host.mjs'
import { judgePrompt, parseRule } from './judge.mjs'
import { addCorrections, log } from './store.mjs'

let raw = ''
for await (const chunk of process.stdin) raw += chunk
try {
  const job = JSON.parse(raw)
  const rule = parseRule(await complete(job.host, job.model, judgePrompt(job.answer, job.reply), 90_000))
  if (rule) addCorrections([{ at: job.at, about: job.about, quote: String(job.reply).slice(0, 800), rule, host: job.host, src: 'live' }])
  log({ host: job.host, kind: 'judge', correction: !!rule, ...(process.env.OTW_DEBUG ? { answer: String(job.answer).slice(0, 160), reply: String(job.reply).slice(0, 80) } : {}) })
} catch (err) {
  log({ kind: 'judge-error', message: String(err?.message ?? err) })
}
