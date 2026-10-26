// Is the person's new message a correction of how the assistant worked? One small-model call per prompt, run in a
// detached process so the prompt never waits for it. The prompt is the one measured on 56 hand-labelled turn ends
// (precision 0.82, recall 0.72 with Claude Haiku); the only change is that the rule comes back in the user's
// language instead of always Korean.

export const JUDGE_PROMPT = `Below is the end of an AI assistant's answer and the user's next message.

[assistant answer, end]
{answer}

[user's next message]
{reply}

Does the user's message say the assistant did something wrong in how it worked — stopped or asked when it should have continued, shrank the scope, claimed done without checking, misunderstood, was too slow, gave a wrong result, ignored an earlier instruction? Swearing at the assistant counts. A plain go-ahead ("ok go on", "ㅇㅇ 진행해", "do the next thing"), a new request, a question or a status check does not count.

If it does not count, answer exactly: NONE
If it counts, answer with one line in the language of the user's message: a rule the assistant should follow next time, generalised beyond this task (e.g. "Carry out the next step of an approved plan without asking."). No preamble.`

export function judgePrompt(answer, reply) {
  const excerpts = { answer: String(answer).slice(-600), reply: String(reply).slice(0, 800) }
  return JUDGE_PROMPT.replace(/\{(answer|reply)\}/g, (_, key) => excerpts[key])
}

// The judge's reply as a rule, or null for NONE or anything that is not one plausible line.
export function parseRule(reply) {
  const line = String(reply).split('\n').map(l => l.trim()).find(Boolean) ?? ''
  if (/^NONE\b/i.test(line)) return null
  const rule = line.replace(/^(rule|NEW|규칙)\s*[:：]?\s*/i, '').replace(/^["“]|["”]$/g, '').trim()
  if (rule.length < 10 || rule.length > 300) return null
  return rule
}

// --- Batch judge for the history report: many turn ends per call, each correction tagged with what it was about.
export const CATEGORIES = {
  stopped: 'stopped or asked when it should have continued',
  scope: 'shrank or changed the scope',
  unverified: 'claimed done without checking',
  misunderstood: 'misunderstood the request',
  slow: 'too slow or too heavy a process',
  wrong: 'gave a wrong result',
  ignored: 'ignored an earlier instruction or decision',
  other: 'another complaint about how it worked',
}

export function batchPrompt(pairs) {
  const items = pairs
    .map((p, i) => `### ${i}\n[assistant answer, end]\n${String(p.answer).slice(-600)}\n[user's next message]\n${String(p.reply).slice(0, 800)}`)
    .join('\n\n')
  return `Below are ${pairs.length} numbered pairs: the end of an AI assistant's answer and the user's next message.

For each pair, decide: does the user's message say the assistant did something wrong in how it worked — stopped or asked when it should have continued, shrank the scope, claimed done without checking, misunderstood, was too slow, gave a wrong result, ignored an earlier instruction? Swearing at the assistant counts. A plain go-ahead ("ok go on", "ㅇㅇ 진행해", "do the next thing"), a new request, a question or a status check does not count.

Answer with one line per pair that counts, and nothing else:
<number> <category>
where <category> is one of: ${Object.entries(CATEGORIES).map(([k, v]) => `${k} (${v})`).join(', ')}.
If no pair counts, answer exactly: NONE

${items}`
}

export function parseBatch(reply, n) {
  const out = new Map()
  for (const line of String(reply).split('\n')) {
    const m = /^\s*#*\s*(\d+)\s*[:.)-]?\s*([a-z]+)/i.exec(line)
    if (!m) continue
    const i = Number(m[1])
    const c = m[2].toLowerCase()
    if (i >= 0 && i < n && c in CATEGORIES) out.set(i, c)
  }
  return out
}
