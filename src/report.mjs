// `otw report`: how often, in the history already on this machine, the person had to correct how the
// assistant worked, and for what. With --seed the corrections found become the quotes recall starts from.
import { complete } from './host.mjs'
import { batchPrompt, CATEGORIES, parseBatch } from './judge.mjs'
import { one, recallable } from './similar.mjs'
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
    `${days > 0 ? `Last ${days} days` : 'All history'}: ${pairs.length} candidate user replies; the judge labelled ${found.length} (${pct}%) as possible corrections.`,
    ...(failed ? [`(${failed} of ${batches} judge calls failed; those turns are not counted.)`] : []),
    '',
    ...ranked.flatMap(([k, cs]) => [
      `${String(cs.length).padStart(4)}×  ${CATEGORIES[k]}`,
      ...cs.slice(-2).map(c => `        "${one(c.reply, 110)}"`),
    ]),
  ]
  return lines.join('\n')
}

// A prefilled "Show and tell" discussion carrying only the counts and category names, never the quoted replies,
// so a user can post their #1 back to the project in one click.
export function shareLink(pairs, found, { days }) {
  const by = new Map()
  for (const c of found) by.set(c.category, (by.get(c.category) ?? 0) + 1)
  const ranked = [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
  if (!ranked.length) return null
  const title = `My #1 (model-labelled): ${CATEGORIES[ranked[0][0]]} (${ranked[0][1]}×)`
  const body = [
    `\`otw report\`, ${days > 0 ? `last ${days} days` : 'all history'}: ${found.length} model-labelled possible corrections in ${pairs.length} candidate replies.`,
    '',
    ...ranked.map(([k, n], i) => `${i + 1}. ${CATEGORIES[k]}: ${n}×`),
    '',
    'Filters and model labels may be wrong. This is not a before/after comparison or evidence of effectiveness.',
    'I reviewed these counts before sharing. Same as yours?',
  ].join('\n')
  const q = new URLSearchParams({ category: 'show-and-tell', title, body })
  return `https://github.com/toranalytics/off-the-wall/discussions/new?${q}`
}

// Preserve old records; append a provenance-tagged copy only when the source really supplies it.
// A legacy unscoped copy must not prevent safe reseeding of the same historical reply.
export function seedCorrections(found, existing = corrections()) {
  const identity = c => JSON.stringify([c.project, c.at, c.quote])
  const have = new Set(existing.filter(recallable).map(identity))
  const fresh = []
  let skipped = 0
  for (const c of found) {
    const candidate = { at: c.at, about: c.about, quote: c.reply, rule: CATEGORIES[c.category], host: c.host, src: 'history', project: c.project, origin: c.origin }
    if (!candidate.rule || !recallable(candidate)) { skipped++; continue }
    const key = identity(candidate)
    if (have.has(key)) continue
    have.add(key)
    fresh.push(candidate)
  }
  return { fresh, skipped }
}

export async function report({ days = 30, hosts, max = 400, seed = false, host, claudeDir, codexDir, completeFn = complete, log = console.log } = {}) {
  if (!Number.isInteger(days) || days < 0 || !Number.isInteger(max) || max < 1 || (host && !['claude', 'codex'].includes(host)) || (hosts && (!Array.isArray(hosts) || hosts.some(h => !['claude', 'codex'].includes(h))))) throw new Error('Invalid report days, max, or host')
  const cfg = config()
  const pairs = historyPairs({ days, hosts, claudeDir, codexDir }).slice(-max)
  if (pairs.length === 0) return log(`No turn ends found${days > 0 ? ` in the last ${days} days` : ''}.`)
  const judgeHost = host ?? (pairs.filter(p => p.host === 'claude').length >= pairs.length / 2 ? 'claude' : 'codex')
  log(`Reading ${pairs.length} turn ends with ${judgeHost} (${cfg.judge[judgeHost]}), ${Math.ceil(pairs.length / BATCH)} calls…`)
  const res = await judgeAll(pairs, { host: judgeHost, model: cfg.judge[judgeHost], completeFn, onProgress: (d, n) => process.stderr.write(`\r  ${d}/${n}`) })
  process.stderr.write('\n')
  log(summary(pairs, res.found, { days, failed: res.failed, batches: res.batches }))
  const share = shareLink(pairs, res.found, { days })
  if (share) log(`\nCompare your #1 with other people's (counts only, nothing quoted):\n${share}`)
  if (seed) {
    const { fresh, skipped } = seedCorrections(res.found)
    addCorrections(fresh)
    log(`\nSaved ${fresh.length} scoped, origin-tagged corrections. Only relevant matches in the same working directory can be recalled.`)
    if (skipped) log(`Skipped ${skipped} corrections without usable workspace/input provenance; report only, not saved for recall.`)
  } else log('\nRun with --seed to start recall from these corrections.')
}
