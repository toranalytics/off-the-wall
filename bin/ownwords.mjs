#!/usr/bin/env node
import { report } from '../src/report.mjs'
import { config, corrections, home } from '../src/store.mjs'

const [cmd, ...rest] = process.argv.slice(2)
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
  console.log(`folder ${home()}\ncorrections ${cs.length} (live ${cs.filter(c => c.src === 'live').length}, from history ${cs.filter(c => c.src === 'history').length})`)
  console.log(`recall ${cfg.recall ? 'on' : 'off'} · capture ${cfg.capture ? 'on' : 'off'} · routing ${cfg.routing ? 'on' : 'off'}`)
} else {
  console.log(`ownwords report [--days 30 | --days 0] [--max 400] [--host claude|codex] [--seed] [--claude-dir DIR] [--codex-dir DIR]
  Reads your Claude Code and Codex history on this machine and shows how often you corrected how the assistant
  worked, and for what. --seed saves those corrections so they are quoted back from the next prompt on.
  --days 0 reads all history. Try it without your own history: --host claude --claude-dir examples/claude-history --days 0
ownwords status`)
}
