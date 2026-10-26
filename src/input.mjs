// Text-only boundaries, not a language or length classifier. Unknown prose remains a candidate, not authenticated human authorship.
const MY_REQUEST = /^\s*#\s*Files mentioned by the user:[\s\S]*?\n##\s*My request[^\n]*:\s*\n/
export const typedPart = text => String(text ?? '').replace(MY_REQUEST, '')

const FLAGS = ['isMeta', 'isCompactSummary', 'isSidechain', 'toolUseResult', 'isAutomated', 'automated']
const NONHUMAN = /^(?:assistant|system|developer|tool|tool_result|model|agent|subagent|automation|automated|scheduled|scheduler|cron|hook|extension|sdk|api|relay|guardian|guardian_review|review|exec|compact|compaction|internal|bot|mcp|background)(?:$|[-_:/.])/i

// Inspect only provenance fields, never arbitrary message text. Object sources denote
// structured agent origins (e.g. Codex's { subagent: ... }); unknown ones fail closed.
export function isNonhumanMetadata(meta = {}, { allowAssistantRole = false } = {}) {
  if (!meta || typeof meta !== 'object') return false
  if (FLAGS.some(k => Boolean(meta[k]))) return true
  for (const k of ['origin', 'source', 'role', 'thread_source', 'threadSource', 'input_source', 'inputSource']) {
    const value = meta[k]
    if (k === 'role' && value === 'assistant' && allowAssistantRole) continue
    if (value && typeof value === 'object') return true
    if (typeof value === 'string' && NONHUMAN.test(value.trim())) return true
  }
  if (meta.thread_source && meta.thread_source !== 'user') return true
  if (meta.threadSource && meta.threadSource !== 'user') return true
  return ['metadata', 'message', 'payload'].some(k => meta[k] && meta[k] !== meta && isNonhumanMetadata(meta[k], { allowAssistantRole }))
}

const PASSIVE = /^(?:<\s*(?:system-reminder|environment_context|environment-context|environment_instructions|environment-instructions|environment_details|user_instructions|developer_instructions|instructions|permissions_instructions|permissions-instructions)(?:\s|>)|#{1,6}\s*AGENTS\.md(?:\s+instructions\b|\s+for\b|\s*$))/i
const MACHINE = /^(?:<\s*(?:command-name|command-message|command-args|local-command-caveat|local-command-stdout|local-command-stderr|request-interrupted|turn_aborted|task-notification|teammate-message|subagent-notification|agent-message|aside_agent_message|system_message|automated-message|automation)(?:\s|>)|\[\s*(?:Request interrupted\b|request-interrupted\b|Automated(?:\s+message|\s+task)?\]|Automation\]|System reminder\]|Relay\]|Subagent\])|Caveat:\s*The messages below were generated\b|(?:This is an automated (?:message|task)|You are running (?:an automated|a scheduled) task|\[?Automated (?:message|task)\]?\s*:|(?:Automation|Relay|Scheduled task|Cron job)\s*:))/i

// A single command-shaped name (optionally with arguments) is a slash command.
// Additional path separators or a filename extension are evidence of a filepath,
// not a command. A bare /name remains ambiguous and is conservatively excluded.
const SLASH_COMMAND = /^\/[a-z][a-z0-9_-]*(?::[a-z0-9_-]+)*(?:\s|$)/i

// Passive context has no new request. Parsers retain the preceding final answer but
// freeze answer updates until another human turn, so an injected response cannot replace it.
export const isPassiveContext = text => PASSIVE.test(typedPart(text).trim())
export function isUserInput(text, meta = {}) {
  const t = typedPart(text).trim()
  return Boolean(t) && !SLASH_COMMAND.test(t) && !isNonhumanMetadata(meta) && !PASSIVE.test(t) && !MACHINE.test(t)
}
