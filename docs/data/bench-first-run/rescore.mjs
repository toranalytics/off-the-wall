import fs from 'node:fs'; import path from 'node:path'
const { PREF } = await import('/Users/SJB/Desktop/ownwords-toranalytics/bench/tasks.mjs')
const P = '/Users/SJB/.aside/u/0/sessions/2026-10-22_0s8heOAE5qcpaKfV/tmp/claude-cli/config/projects'
const T = '/private/var/folders/yx/n52s3wv931z8pghtndd40njm0000gr/T'
const rows = []
for (const d of fs.readdirSync(P).filter(x => x.includes('otw-bench-'))) {
  const dir = path.join(T, d.split('-T-')[1]); if (!fs.existsSync(dir)) continue
  for (const f of fs.readdirSync(path.join(P, d)).filter(x => x.endsWith('.jsonl'))) {
    const lines = fs.readFileSync(path.join(P, d, f), 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
    const raw = lines.map(l => JSON.stringify(l)).join('\n'), hasBlock = raw.includes('[off-the-wall]')
    const user = lines.find(l => l.type === 'user' && typeof l.message?.content === 'string')?.message.content ?? lines.find(l => l.type === 'user')?.message?.content?.[0]?.text
    const t = PREF.find(t => user && user.includes(t.prompt.slice(0, 40)))
    const ev = [], texts = []
    for (const l of lines) if (l.type === 'assistant') for (const c of l.message?.content || []) { if (c.type === 'tool_use') ev.push({ name: c.name, input: c.input }); if (c.type === 'text') texts.push(c.text) }
    if (!t) { rows.push({ unknown: true, dir: d }); continue }
    const sc = t.score(dir, ev, texts.at(-1) || '')
    rows.push({ task: t.pref, arm: hasBlock ? 'otw' : 'none', pass: !!sc.pass })
  }
}
const unk = rows.filter(r => r.unknown).length, ok = rows.filter(r => !r.unknown)
const tot = { none: [0, 0], otw: [0, 0] }, by = {}
for (const r of ok) { by[r.task] ??= { none: [0, 0], otw: [0, 0] }; by[r.task][r.arm][0] += r.pass; by[r.task][r.arm][1]++; tot[r.arm][0] += r.pass; tot[r.arm][1]++ }
console.log('sessions', rows.length, 'unmatched', unk)
for (const [k, v] of Object.entries(by).sort()) console.log(k, 'off', v.none.join('/'), 'on', v.otw.join('/'))
console.log('TOTAL off', tot.none.join('/'), 'on', tot.otw.join('/'))
