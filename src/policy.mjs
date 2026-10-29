// Routing: the main model is the orchestrator and picks the model for each subagent it starts. The rule is by what
// the written task leaves the subagent to decide, not by how subtle the subject is. On 30 held-out real delegations
// (labelled before the rule was tuned) Claude Opus following the Claude text picked the labelled model 28 times and
// never a weaker one. The Codex text maps the same three classes onto Codex's models; that mapping is by analogy
// and has not been measured.

const CLASSES = {
  small: 'pure retrieval or reshaping: find files, grep, list, extract fields, summarise a given text, convert formats, run a given command and report.',
  mid: 'everything with a stated goal and criteria: read-only investigation of a stated question, independent review or verification against stated criteria, implementation or fix to a stated scope, writing tests, producing an asset through an existing pipeline.',
  large: 'the task leaves the subagent to decide what the problem is or what to build: a fix whose cause the task does not state, root cause of a failure, deciding whether evidence proves or disproves a requirement, a new component that replaces an existing one, architecture or a structure others will build on, a migration or rollout plan, choosing between designs.',
}

const SELF = `A subagent starts with an empty context and re-reads what it needs, so work you can finish in a few steps is cheapest done by you. Hand work off when its output would flood your context, or when it can run in parallel with other work.`

export const DEFAULT_MODELS = {
  claude: { small: 'haiku', mid: 'sonnet', large: 'opus' },
  codex: { small: 'gpt-6-luna', mid: 'gpt-6.1-sol', large: 'gpt-6-astra' },
}

// Codex model names differ by account and change often, so the three classes are read from the model list Codex
// keeps for this account (~/.codex/models_cache.json): listed models in Codex's own order, sorted into classes by
// their description. A class with no match keeps its default; config.json overrides all of it.
const CODEX_CLASS = {
  large: /frontier|most (demanding|capable|intelligent)/i,
  small: /fast and (affordable|efficient)|easier tasks|lightweight|\bmini\b|\bnano\b/i,
  mid: /workhorse|everyday|balanced|general/i,
}
const OLDER = /\b(older|previous|legacy|deprecated)\b/i

export function codexClasses(cache) {
  const listed = (cache?.models ?? [])
    .filter(m => m?.slug && (m.visibility ?? 'list') === 'list' && !OLDER.test(m.description ?? ''))
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
  const out = {}
  for (const k of ['large', 'small', 'mid']) {
    const m = listed.find(x => CODEX_CLASS[k].test(x.description ?? '') && !Object.values(out).includes(x.slug))
    if (m) out[k] = m.slug
  }
  return out
}
// Listed, non-older models that no class claimed: their description names no tier, so they are not used for
// routing unless config.json names them. `otw status` shows them so a new model is not silently ignored.
export function codexUnclassified(cache) {
  const used = Object.values(codexClasses(cache))
  return (cache?.models ?? [])
    .filter(m => m?.slug && (m.visibility ?? 'list') === 'list' && !OLDER.test(m.description ?? '') && !used.includes(m.slug))
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
    .map(m => m.slug)
}
export const CODEX_EFFORT = { small: 'low', mid: 'medium', large: 'high' }

export function policy(host, models = DEFAULT_MODELS[host]) {
  if (host === 'codex') {
    return [
      '# Subagent routing (Off the Wall)',
      'You are the orchestrator. ' + SELF,
      'Every spawn_agent call names `model` and `reasoning_effort`, chosen by what the written task leaves the subagent to decide, not by how subtle the subject is:',
      ...['small', 'mid', 'large'].map(k => `- ${models[k]}, reasoning_effort ${CODEX_EFFORT[k]}: ${CLASSES[k]}`),
      'Unless the subagent needs the conversation so far, pass `fork_turns: "none"` and put what it needs in the message: by default the whole history is copied into it, and on a different model none of it is cached.',
    ].join('\n')
  }
  return [
    '# Subagent routing (Off the Wall)',
    'You are the orchestrator. ' + SELF,
    'Every Agent call that does not fork names `model`, chosen by what the written task leaves the subagent to decide, not by how subtle the subject is:',
    ...['small', 'mid', 'large'].map(k => `- ${models[k]}: ${CLASSES[k]}`),
  ].join('\n')
}

// Claude Code agent types that run on whatever model the caller names; the others carry their own model.
const CLAUDE_GENERIC = new Set(['general-purpose', 'claude', ''])

// The subagent call this rule applies to, and whether it names its model.
export function subagentCall(host, toolName, input = {}) {
  if (host === 'codex') {
    // spawn_agent, or collaborationspawn_agent in the multi-agent v2 tools (seen in codex-cli 0.162).
    if (!/(^|collaboration)spawn_agent$/.test(String(toolName))) return null
    // v1's fork_context runs the child on the parent's own snapshot; v2 takes the model even when it forks.
    if (input.fork_context === true) return null
    return { named: !!input.model && !!input.reasoning_effort, model: input.model, effort: input.reasoning_effort }
  }
  if (toolName !== 'Agent' && toolName !== 'Task') return null
  const type = String(input.subagent_type ?? '')
  if (type === 'fork' || !CLAUDE_GENERIC.has(type)) return null
  return { named: !!input.model, model: input.model }
}

export function denyReason(host) {
  return host === 'codex'
    ? 'Off the Wall routing: name `model` and `reasoning_effort` for this subagent by the routing rule in your instructions, then call spawn_agent again.'
    : 'Off the Wall routing: name the subagent `model` (haiku, sonnet or opus) by the routing rule in your instructions, then call Agent again.'
}
