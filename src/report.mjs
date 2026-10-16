// `ownwords report`: how often, in the history already on this machine, the person had to correct how the
// assistant worked, and for what. With --seed the corrections found become the quotes recall starts from.
import { complete } from './host.mjs'
import { batchPrompt, CATEGORIES, parseBatch } from './judge.mjs'
import { one } from './similar.mjs'
import { addCorrections, config, corrections } from './store.mjs'
import { historyPairs } from './transcripts.mjs'

export const BATCH = 20

export async function judgeAll(pairs, { host, model, onProgress = () => {}, completeFn = complete, parallel = 4, batch = BATCH, effort }) {
  const batches = []
  for (let i = 0; i < pairs.length; i += batch) batches.push(pairs.slice(i, i + batch))
  const found = []
  let done = 0
  let failed = 0
  const queue = batches.map((b, k) => ({ b, k }))
  await Promise.all(
    Array.from({ length: Math.min(parallel, queue.length) }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        try {
          const tags = parseBatch(await completeFn(host, model, batchPrompt(job.b), 180_000, effort), job.b.length)
          for (const [i, category] of tags) found.push({ ...job.b[i], category })
        } catch {
          failed++
        }
        onProgress(++done, batches.length)
      }
    }),
  )
  return { found: found.sort((a, b) => a.at - b.at), failed, batches: batches.length }
}

export function summary(pairs, found, { days, failed = 0, batches = 0 }) {
  const by = new Map()
  for (const c of found) by.set(c.category, [...(by.get(c.category) ?? []), c])
  const ranked = [...by.entries()].sort((a, b) => b[1].length - a[1].length)
  const pct = pairs.length ? Math.round((found.length / pairs.length) * 100) : 0
  const lines = [
    `${days > 0 ? `Last ${days} days` : 'All history'}: ${pairs.length} times you answered the assistant, ${found.length} of them (${pct}%) correcting how it worked.`,
    ...(failed ? [`(${failed} of ${batches} judge calls failed; those turns are not counted.)`] : []),
    '',
    ...ranked.flatMap(([k, cs]) => [
      `${String(cs.length).padStart(4)}×  ${CATEGORIES[k]}`,
      ...cs.slice(-2).map(c => `        "${one(c.reply, 110)}"`),
    ]),
  ]
  return lines.join('\n')
}

export async function report({ days = 30, hosts, max = 400, seed = false, host, claudeDir, codexDir, log = console.log } = {}) {
  const cfg = config()
  const pairs = historyPairs({ days, hosts, claudeDir, codexDir }).slice(-max)
  if (pairs.length === 0) return log(`No turn ends found${days > 0 ? ` in the last ${days} days` : ''}.`)
  const judgeHost = host ?? (pairs.filter(p => p.host === 'claude').length >= pairs.length / 2 ? 'claude' : 'codex')
  log(`Reading ${pairs.length} turn ends with ${judgeHost} (${cfg.judge[judgeHost]}), ${Math.ceil(pairs.length / BATCH)} calls…`)
  const res = await judgeAll(pairs, { host: judgeHost, model: cfg.judge[judgeHost], onProgress: (d, n) => process.stderr.write(`\r  ${d}/${n}`) })
  process.stderr.write('\n')
  log(summary(pairs, res.found, { days, failed: res.failed, batches: res.batches }))
  if (seed) {
    const have = new Set(corrections().map(c => `${c.at}|${c.quote}`))
    const fresh = res.found
      .map(c => ({ at: c.at, about: c.about, quote: c.reply, rule: CATEGORIES[c.category], host: c.host, src: 'history' }))
      .filter(c => !have.has(`${c.at}|${c.quote}`))
    addCorrections(fresh)
    log(`\nSaved ${fresh.length} corrections; from now on the most relevant ones are quoted back on each prompt.`)
  } else log('\nRun with --seed to start recall from these corrections.')
}
