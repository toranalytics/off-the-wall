import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

process.env.OTW_HOME = mkdtempSync(join(tmpdir(), 'otw-test-'))
const { correctionBlock, langOf, pickCorrections } = await import('../src/similar.mjs')
const { parseBatch, parseRule, batchPrompt } = await import('../src/judge.mjs')
const { handle, typed } = await import('../src/hook.mjs')
const { appendCaptured, authorizeCapture, session } = await import('../src/store.mjs')
const { claudePairs, codexPairs, lines, MAX_LINE, typedPart } = await import('../src/transcripts.mjs')
const { judgeAll, summary, shareLink } = await import('../src/report.mjs')
const { DEFAULT_CONFIG } = await import('../src/store.mjs')

const { projectKey } = await import('../src/scope.mjs')
const project = projectKey(process.env.OTW_HOME)
const T = Date.UTC(2026, 0, 10)
const C = (dt, about, quote) => ({ at: T + dt, about, quote, project, origin: 'history-user' })
const list = [
  C(1, 'migrate the billing tables to the new schema and backfill', 'you said migrated but never ran the backfill, run it'),
  C(2, 'fix the flaky login test', 'stop asking me which option, just pick and do it'),
  C(3, 'rename the config keys across the repo', 'you only renamed half of them, do all of them'),
  C(4, 'write the release notes', 'too long, nobody reads that'),
  C(5, 'deploy the staging build', 'check it actually started before saying done'),
  C(6, 'add the export button', 'stop asking me which option, just pick and do it'),
  C(7, 'update the docs', 'wrong folder'),
  C(1000, 'a correction from the future', 'not yet said'),
]

test('only relevant scoped corrections, distinct and never from after now', () => {
  const got = pickCorrections(list, 'backfill the billing schema migration on staging', T + 100, 6, project)
  assert.equal(got[0].quote, list[0].quote)
  assert.ok(got.length >= 1 && got.length < 6)
  assert.ok(!got.some(c => c.quote === 'not yet said'))
  assert.equal(got.filter(c => c.quote.startsWith('stop asking')).length, 0)
  assert.deepEqual(pickCorrections([], 'x', T), [])
})

test('the block quotes verbatim and asks for the objection to be predicted, in the prompt language', () => {
  const b = correctionBlock(list.slice(0, 2), 'en')
  assert.match(b, /"you said migrated but never ran the backfill, run it"/)
  assert.match(b, /predict in one line/)
  assert.equal(langOf('배포해줘'), 'ko')
  assert.match(correctionBlock(list.slice(0, 1), 'ko'), /예측하고/)
})

test('judge replies: NONE is no rule, a line is a rule, junk is nothing', () => {
  assert.equal(parseRule('NONE'), null)
  assert.equal(parseRule('Run the check before saying it is done.'), 'Run the check before saying it is done.')
  assert.equal(parseRule('ok'), null)
  const m = parseBatch('0 stopped\n3: unverified\n#7 wrong\n9 nonsense\n42 scope', 10)
  assert.deepEqual([...m], [[0, 'stopped'], [3, 'unverified'], [7, 'wrong']])
  assert.equal(parseBatch('NONE', 5).size, 0)
  assert.match(batchPrompt([{ answer: 'a', reply: 'b' }]), /### 0/)
})

test('typed text only: slash commands and injected text are not the person', () => {
  assert.equal(typed('fix it'), true)
  for (const t of ['/clear', '<command-name>x</command-name>', '[Request interrupted by user]', '  ']) assert.equal(typed(t), false)
})

const cfg = DEFAULT_CONFIG
const ev = (host, sid, e) => ({ session_id: sid, cwd: process.env.OTW_HOME, ...e })

test('session start carries the routing rule for each host', () => {
  const c = handle('claude', ev('claude', 's1', { hook_event_name: 'SessionStart' }), { cfg })
  assert.match(c.hookSpecificOutput.additionalContext, /haiku: pure retrieval/)
  const x = handle('codex', ev('codex', 's1', { hook_event_name: 'SessionStart' }), { cfg })
  assert.match(x.hookSpecificOutput.additionalContext, /gpt-6-luna, reasoning_effort low/)
  assert.match(x.hookSpecificOutput.additionalContext, /spawn_agent/)
  assert.match(x.hookSpecificOutput.additionalContext, /fork_turns: "none"/)
})

test('a prompt after an answer is judged in the background; the prompt carries the quotes', () => {
  assert.equal(appendCaptured(list.slice(0, 3), authorizeCapture()), true)
  const jobs = []
  const spawnJudge = j => jobs.push(j)
  const now = T + 500
  handle('claude', ev('claude', 's2', { hook_event_name: 'SessionStart' }), { cfg, now })
  const first = handle('claude', ev('claude', 's2', { hook_event_name: 'UserPromptSubmit', prompt: 'migrate the billing tables' }), { cfg, now, spawnJudge })
  assert.equal(jobs.length, 0) // no answer yet to judge
  assert.match(first.hookSpecificOutput.additionalContext, /never ran the backfill/)
  assert.doesNotMatch(first.hookSpecificOutput.additionalContext, /Subagent routing/) // already given at session start
  handle('claude', ev('claude', 's2', { hook_event_name: 'Stop', last_assistant_message: 'Migrated. Done.' }), { cfg, now })
  handle('claude', ev('claude', 's2', { hook_event_name: 'UserPromptSubmit', prompt: 'you never ran the backfill' }), { cfg, now, spawnJudge })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].answer, 'Migrated. Done.')
  assert.equal(jobs[0].about, 'migrate the billing tables')
  assert.equal(jobs[0].model, 'haiku')
  // a slash command is neither judged nor given quotes
  const slash = handle('claude', ev('claude', 's2', { hook_event_name: 'UserPromptSubmit', prompt: '/clear' }), { cfg, now, spawnJudge })
  assert.equal(jobs.length, 1)
  assert.equal(slash, null)
})

test('without a session start (or after compaction) the first prompt carries the routing rule', () => {
  const r = handle('codex', ev('codex', 's3', { hook_event_name: 'UserPromptSubmit', prompt: 'hello there' }), { cfg, now: T, spawnJudge: () => {} })
  assert.match(r.hookSpecificOutput.additionalContext, /Subagent routing/)
  const again = handle('codex', ev('codex', 's3', { hook_event_name: 'UserPromptSubmit', prompt: 'hello there' }), { cfg, now: T, spawnJudge: () => {} })
  assert.ok(!again || !/Subagent routing/.test(again.hookSpecificOutput.additionalContext))
  handle('codex', ev('codex', 's3', { hook_event_name: 'PostCompact' }), { cfg })
  const after = handle('codex', ev('codex', 's3', { hook_event_name: 'UserPromptSubmit', prompt: 'hello there' }), { cfg, now: T, spawnJudge: () => {} })
  assert.match(after.hookSpecificOutput.additionalContext, /Subagent routing/)
})

const deny = r => r?.hookSpecificOutput?.permissionDecision === 'deny'

test('Claude: an Agent call with no model is sent back once per turn; named, typed and forked ones pass', () => {
  const s = 's4'
  const pre = input => handle('claude', ev('claude', s, { hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: input }), { cfg })
  handle('claude', ev('claude', s, { hook_event_name: 'UserPromptSubmit', prompt: 'go' }), { cfg, spawnJudge: () => {} })
  assert.equal(deny(pre({ subagent_type: 'general-purpose', model: 'sonnet' })), false)
  assert.equal(deny(pre({ subagent_type: 'Explore' })), false) // carries its own model
  assert.equal(deny(pre({ subagent_type: 'fork' })), false)
  assert.equal(deny(pre({ subagent_type: 'general-purpose' })), true)
  assert.equal(deny(pre({ subagent_type: 'general-purpose' })), false) // second time this turn: let it run
  handle('claude', ev('claude', s, { hook_event_name: 'UserPromptSubmit', prompt: 'next' }), { cfg, spawnJudge: () => {} })
  assert.equal(deny(pre({})), true) // a new turn: asked again
  assert.equal(handle('claude', ev('claude', s, { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: {} }), { cfg }), null)
})

test('Codex: spawn_agent needs both model and reasoning_effort; a forked context passes', () => {
  const s = 's5'
  const pre = input => handle('codex', ev('codex', s, { hook_event_name: 'PreToolUse', tool_name: 'spawn_agent', tool_input: input }), { cfg })
  handle('codex', ev('codex', s, { hook_event_name: 'UserPromptSubmit', prompt: 'go' }), { cfg, spawnJudge: () => {} })
  assert.equal(deny(pre({ message: 'x', model: 'gpt-6-luna', reasoning_effort: 'low' })), false)
  assert.equal(deny(pre({ message: 'x', fork_context: true })), false)
  assert.equal(deny(pre({ message: 'x', model: 'gpt-6-luna' })), true)
  // multi-agent v2 tool name and arguments
  handle('codex', ev('codex', s, { hook_event_name: 'UserPromptSubmit', prompt: 'next' }), { cfg, spawnJudge: () => {} })
  const v2 = input => handle('codex', ev('codex', s, { hook_event_name: 'PreToolUse', tool_name: 'collaborationspawn_agent', tool_input: input }), { cfg })
  assert.equal(deny(v2({ task_name: 't', message: 'x', fork_turns: 'none', model: 'gpt-6-luna', reasoning_effort: 'low' })), false)
  assert.equal(deny(v2({ task_name: 't', message: 'x', fork_turns: 'all' })), true)
  assert.equal(handle('codex', ev('codex', s, { hook_event_name: 'PreToolUse', tool_name: 'collaborationwait_agent', tool_input: {} }), { cfg }), null)
})

test('routing off: no rule, no send-back', () => {
  const off = { ...cfg, routing: false }
  assert.equal(handle('claude', ev('claude', 's6', { hook_event_name: 'SessionStart' }), { cfg: off }), null)
  assert.equal(handle('claude', ev('claude', 's6', { hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: {} }), { cfg: off }), null)
})

const jsonl = rows => {
  const f = join(process.env.OTW_HOME, `t${Math.random()}.jsonl`)
  writeFileSync(f, rows.map(r => JSON.stringify(r)).join('\n') + '\n{broken')
  return f
}

test('Claude history: active meta and commands invalidate pending answers', () => {
  const ts = '2026-01-10T00:00:00Z'
  const f = jsonl([
    { type: 'user', timestamp: ts, message: { content: 'build the thing' } },
    { type: 'assistant', timestamp: ts, message: { content: [{ type: 'text', text: 'Built it.' }] } },
    { type: 'user', timestamp: ts, message: { content: [{ type: 'tool_result', content: 'x' }] } },
    { type: 'user', timestamp: ts, message: { content: [{ type: 'tool_result', content: 'x' }, { type: 'text', text: 'hook note beside a tool result' }] } },
    { type: 'user', timestamp: ts, isMeta: true, message: { content: 'meta' } },
    { type: 'assistant', timestamp: ts, isSidechain: true, message: { content: [{ type: 'text', text: 'side' }] } },
    { type: 'user', timestamp: ts, message: { content: '<command-name>/clear</command-name>' } },
    { type: 'user', timestamp: ts, message: { content: [{ type: 'text', text: 'you did not run the tests' }] } },
  ])
  const p = claudePairs(f)
  assert.equal(p.length, 0) // do not attribute an answer across active meta or /clear
})

test('Codex history: the final answer of a turn, then the next typed message; injected instructions skipped', () => {
  const ts = '2026-01-10T00:00:00Z'
  const um = text => ({ type: 'response_item', timestamp: ts, payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } })
  const f = jsonl([
    um('# AGENTS.md instructions\n...'),
    um('<environment_context>x</environment_context>'),
    um('make the chart'),
    { type: 'event_msg', timestamp: ts, payload: { type: 'task_complete', last_agent_message: 'Chart done.' } },
    um('# AGENTS.md instructions for the next turn'),
    um('the axis labels are wrong'),
  ])
  const p = codexPairs(f)
  assert.equal(p.length, 1)
  const meta = payload => ({ type: 'session_meta', timestamp: ts, payload })
  const rest = [um('make the chart'), { type: 'event_msg', timestamp: ts, payload: { type: 'task_complete', last_agent_message: 'Done.' } }, um('wrong colours')]
  assert.equal(codexPairs(jsonl([meta({ source: { subagent: { other: 'guardian' } }, thread_source: 'guardian_review' }), ...rest])).length, 0)
  assert.equal(codexPairs(jsonl([meta({ source: 'cli', thread_source: 'subagent' }), ...rest])).length, 0)
  assert.equal(codexPairs(jsonl([meta({ source: 'vscode', thread_source: 'user' }), ...rest])).length, 1)
  assert.deepEqual([p[0].answer, p[0].reply, p[0].about], ['Chart done.', 'the axis labels are wrong', 'make the chart'])
})

test('report: batches of 20, failed calls counted, categories ranked with quotes', async () => {
  const pairs = Array.from({ length: 45 }, (_, i) => ({ at: T + i, answer: `a${i}`, reply: `r${i}`, about: '', host: 'claude' }))
  let call = 0
  const completeFn = async (h, m, prompt) => {
    call++
    if (prompt.includes('r40')) throw new Error('down')
    return prompt.includes('### 19') ? '1 stopped\n2 stopped\n3 unverified' : 'NONE'
  }
  const res = await judgeAll(pairs, { host: 'claude', model: 'haiku', completeFn, parallel: 2 })
  assert.equal(call, 3)
  assert.equal(res.failed, 1)
  assert.equal(res.found.length, 6)
  const s = summary(pairs, res.found, { days: 30, failed: res.failed, batches: res.batches })
  assert.match(s, /45 candidate user replies; the judge labelled 6 \(13%\)/)
  assert.match(s, /4×  stopped or asked/)
  assert.match(s, /1 of 3 judge calls failed/)
  assert.ok(s.indexOf('stopped') < s.indexOf('claimed done'))
})

test('the share link carries counts and category names, never the quoted replies', () => {
  const pairs = Array.from({ length: 10 }, (_, i) => ({ at: i }))
  const found = [
    { category: 'scope', reply: 'SECRET-REPLY-1' }, { category: 'scope', reply: 'SECRET-REPLY-2' },
    { category: 'unverified', reply: 'SECRET-REPLY-3' },
  ]
  const link = shareLink(pairs, found, { days: 30 })
  assert.ok(link.startsWith('https://github.com/toranalytics/off-the-wall/discussions/new?'))
  const q = new URL(link).searchParams
  assert.equal(q.get('category'), 'show-and-tell')
  assert.equal(q.get('title'), 'My #1 (model-labelled): shrank or changed the scope (2×)')
  assert.match(q.get('body'), /3 model-labelled possible corrections in 10 candidate replies/)
  assert.doesNotMatch(link + q.get('body'), /SECRET-REPLY/)
  assert.equal(shareLink(pairs, [], { days: 30 }), null)
})

test('the session file keeps a scoped human-turn answer for the next judge', () => {
  handle('codex', ev('codex', 's7', { hook_event_name: 'UserPromptSubmit', prompt: 'a synthetic fixture request' }), { cfg, spawnJudge: () => {} })
  handle('codex', ev('codex', 's7', { hook_event_name: 'Stop', last_assistant_message: 'x'.repeat(900) }), { cfg })
  assert.equal(session('codex', 's7').lastAnswer.length, 600)
})

test('history files are read in chunks; an oversized line is skipped, the lines around it are kept', () => {
  const f = join(process.env.OTW_HOME, 'big.jsonl')
  const big = JSON.stringify({ type: 'blob', data: 'x'.repeat(MAX_LINE + 10) })
  const small = n => JSON.stringify({ n, pad: 'y'.repeat(700_000) }) // lines that cross the 1 MB chunk edge
  writeFileSync(f, [small(1), big, small(2), small(3), '{broken', JSON.stringify({ n: 4 })].join('\n'))
  assert.deepEqual([...lines(f)].map(d => d.n), [1, 2, 3, 4])
})

test('Codex attachments: only the typed request after the file list counts', () => {
  const t = '\n# Files mentioned by the user:\n\n## a.pdf: /x/a.pdf\n\nDistinguish instructions.\n\n## My request:\nthat is the wrong file'
  assert.equal(typedPart(t), 'that is the wrong file')
  assert.equal(typedPart('plain text'), 'plain text')
})

const { codexClasses } = await import('../src/policy.mjs')
const { config } = await import('../src/store.mjs')
test('Codex classes come from the account model list; older models and unknown descriptions are skipped', () => {
  const cache = { models: [
    { slug: 'm-work', description: 'Latest workhorse model for coding and everyday work.', priority: 1 },
    { slug: 'm-big', description: 'Frontier intelligence for the most demanding work.', priority: 2 },
    { slug: 'm-old', description: 'Older generation workhorse model.', priority: 0 },
    { slug: 'm-fast', description: 'Fast and affordable model for easier tasks.', priority: 4 },
    { slug: 'm-hidden', description: 'Fast and efficient model.', priority: 3, visibility: 'hide' },
  ] }
  assert.deepEqual(codexClasses(cache), { large: 'm-big', small: 'm-fast', mid: 'm-work' })
  assert.deepEqual(codexClasses({ models: [{ slug: 'x', description: 'something new' }] }), {})
  assert.deepEqual(codexClasses(null), {})
})

test('config: detected Codex models, judge on the mid class, config.json wins', () => {
  const ch = mkdtempSync(join(tmpdir(), 'codexhome-'))
  writeFileSync(join(ch, 'models_cache.json'), JSON.stringify({ models: [
    { slug: 'w', description: 'workhorse' }, { slug: 'f', description: 'Frontier' }, { slug: 's', description: 'Fast and affordable' } ] }))
  process.env.CODEX_HOME = ch
  assert.deepEqual(config().models.codex, { small: 's', mid: 'w', large: 'f' })
  assert.equal(config().judge.codex, 'w')
  writeFileSync(join(process.env.OTW_HOME, 'config.json'), JSON.stringify({ judge: { codex: 'mine' }, models: { codex: { large: 'L' } } }))
  assert.equal(config().judge.codex, 'mine')
  assert.deepEqual(config().models.codex, { small: 's', mid: 'w', large: 'L' })
  assert.equal(config().models.claude.small, 'haiku')
  delete process.env.CODEX_HOME
})
