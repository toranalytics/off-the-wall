#!/usr/bin/env node
import { hookStatus } from '../src/hookstatus.mjs'
import { explainRecall, recallable } from '../src/similar.mjs'
import { projectKey } from '../src/scope.mjs'
import { report } from '../src/report.mjs'
import { config, corrections, home } from '../src/store.mjs'
import { runForget, USAGE as FORGET_USAGE } from '../src/forget.mjs'

const [cmd, ...rest] = process.argv.slice(2)
const EXPLAIN_USAGE = `otw explain "<prompt>" [--cwd DIR]
  Shows which stored corrections would be quoted before an answer to that prompt in that working directory
  (default: the current one), with similarity scores. Read-only: it does not call a model or change anything.`
const flag = (name, dflt) => {
  const i = rest.indexOf(`--${name}`)
  return i < 0 ? dflt : rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[i + 1] : true
}

if (cmd === 'report') {
  const only = flag('host', null)
  await report({
    days: Number(flag('days', 30)),
    max: Number(flag('max', 400)),
    seed: !!flag('seed', false),
    hosts: only ? [only] : ['claude', 'codex'],
    host: only ?? undefined,
    claudeDir: flag('claude-dir', undefined),
    codexDir: flag('codex-dir', undefined),
  })
} else if (cmd === 'status') {
  const cs = corrections()
  const cfg = config()
  if (cfg.configIssue) console.log('configuration error ' + cfg.configIssue + ': recall, capture and routing are disabled; fix config.json')
  console.log(`folder ${home()}\ncorrections ${cs.length} (live ${cs.filter(c => c.src === 'live').length}, from history ${cs.filter(c => c.src === 'history').length})`)
  const scoped = cs.filter(recallable).length
  console.log(`scoped/origin-tagged ${scoped} · quarantined ${cs.length - scoped} (not automatically recalled)`)
  console.log(`recall ${cfg.recall ? 'on' : 'off'} · capture ${cfg.capture ? 'on' : 'off'} · routing ${cfg.routing ? 'on' : 'off'}${cfg.recallWide ? '' : ' · recall narrow'}`)
  for (const line of hookStatus(home())) console.log(line)
} else if (cmd === 'explain') {
  // Read-only: shows what recall would attach to a prompt, without sending anything to a model or writing any file.
  const prompt = rest[0] && !rest[0].startsWith('--') ? rest[0] : null
  const cwd = flag('cwd', process.cwd())
  if (!prompt || cwd === true) { console.log(EXPLAIN_USAGE); process.exitCode = 2 }
  else {
    const cfg = config(), key = projectKey(cwd), r = explainRecall(corrections(), prompt, Date.now(), key, cfg.recallWide)
    console.log(`prompt (${prompt.trim().length} characters), working directory ${cwd}`)
    if (cfg.configIssue) console.log('configuration error ' + cfg.configIssue + ': recall is disabled until config.json is fixed')
    else if (!cfg.recall) console.log('recall is off in config.json: nothing would be attached')
    if (r.blocked) console.log(r.blocked)
    else {
      console.log(`stored corrections: ${r.total} (this working directory ${r.eligible}, other directories ${r.otherProject}, not recalled ${r.notRecallable})`)
      console.log(r.mode === 'wide' ? 'selection: wide recall (ranked by similarity, zero overlap excluded)' : `selection: similarity floor ${r.floor ?? 0.18}${cfg.recallWide ? ' (prompts under 20 characters keep the floor)' : ' (recallWide is off)'}`)
      if (!r.picks.length) console.log('would attach: nothing')
      else {
        console.log(`would attach ${r.picks.length} quote${r.picks.length === 1 ? '' : 's'}:`)
        r.picks.forEach((x, i) => console.log(`  ${i + 1}. similarity ${x.score.toFixed(2)}  ${JSON.stringify(x.quote)}${x.about ? `\n     about: ${JSON.stringify(x.about)}` : ''}`))
      }
      console.log('Similarity is word and character-pair overlap with the request each correction was about; it is not a relevance guarantee.')
    }
  }
} else if (cmd === 'forget') {
  const r = runForget(home(), rest, process.cwd())
  for (const line of r.lines) console.log(line)
  process.exitCode = r.code
} else {
  console.log(`otw report [--days 30 | --days 0] [--max 400] [--host claude|codex] [--seed] [--claude-dir DIR] [--codex-dir DIR]
  Reads your Claude Code and Codex history on this machine and shows how often you corrected how the assistant
  worked, and for what (model labels, not verified outcomes). --seed saves only origin-tagged corrections with
  an explicit history workspace; recall requires a relevant match in that same working directory.
  --days 0 reads all history. Try it without your own history: --host claude --claude-dir examples/claude-history --days 0
otw status
${FORGET_USAGE}`)
}
