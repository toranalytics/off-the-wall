#!/usr/bin/env node
// Draws the README images from real outputs and measured numbers, so they can be checked and redrawn:
//   node scripts/make-assets.mjs
// - assets/report.svg: assets/report-example.txt, the real output of
//   `ownwords report --host claude --claude-dir examples/claude-history --days 0`
// - assets/context.svg: the block the hook really attaches, built from the corrections in that example history
// - assets/evidence.svg, assets/routing.svg: the numbers in the README's Evidence section
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { correctionBlock } from '../src/similar.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const C = { bg: '#16181d', panel: '#1f232b', line: '#2c313b', text: '#e6e1d6', dim: '#8b93a1', amber: '#f4b24a', teal: '#2bb3a3', red: '#e5604d' }
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const FONT = `font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"`

// 15px monospace advances about 9.1px per character.
const CH = 9.6
function terminal(title, lines, { color = () => C.text } = {}) {
  const width = Math.ceil(Math.max(720, 56 + CH * Math.max(...lines.map(l => l.length)), 120 + 8.4 * title.length))
  const lh = 22
  const h = 70 + lines.length * lh + 20
  const rows = lines
    .map((l, i) => `<text x="28" y="${82 + i * lh}" fill="${color(l)}" font-size="15" ${FONT} xml:space="preserve">${esc(l)}</text>`)
    .join('\n')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}" viewBox="0 0 ${width} ${h}">
<rect width="${width}" height="${h}" rx="14" fill="${C.bg}"/>
<rect x="1" y="1" width="${width - 2}" height="44" rx="13" fill="${C.panel}"/>
<circle cx="26" cy="23" r="7" fill="${C.red}"/><circle cx="48" cy="23" r="7" fill="${C.amber}"/><circle cx="70" cy="23" r="7" fill="${C.teal}"/>
<text x="${width / 2}" y="29" fill="${C.dim}" font-size="14" text-anchor="middle" ${FONT}>${esc(title)}</text>
${rows}
</svg>\n`
}

// The report, as printed.
const report = readFileSync(`${root}assets/report-example.txt`, 'utf8').trimEnd().split('\n')
writeFileSync(
  `${root}assets/report.svg`,
  terminal('ownwords report --claude-dir examples/claude-history --days 0', report, {
    color: l => (/×/.test(l) ? C.amber : /^\s+"/.test(l) ? C.teal : /^(All|Last)/.test(l) ? C.text : C.dim),
  }),
)

// The context block for a new prompt, from the corrections found in the example history.
const quotes = report.filter(l => /^\s+"/.test(l)).map((l, i) => ({ at: i, about: '', quote: l.trim().slice(1, -1) }))
const block = correctionBlock(quotes.slice(0, 6), 'en')
const wrap = (s, n) => s.split('\n').flatMap(l => {
  const out = []
  let cur = ''
  for (const w of l.split(' ')) {
    if ((cur + ' ' + w).trim().length > n) out.push(cur), (cur = w)
    else cur = (cur + ' ' + w).trim()
  }
  return [...out, cur]
})
writeFileSync(
  `${root}assets/context.svg`,
  terminal('added before the agent answers your next prompt', wrap(block, 92), {
    color: l => (l.startsWith('[ownwords]') ? C.amber : l.startsWith('- "') ? C.teal : C.text),
  }),
)

// Measured comparison: wins / ties / losses against nothing attached (39 replayed requests).
function bars(title, subtitle, rows, legend) {
  const w = 1000
  const sub = Array.isArray(subtitle) ? subtitle : [subtitle]
  const top = 70 + sub.length * 20
  const rh = 46
  const h = top + rows.length * rh + 60
  const x0 = 330
  const span = w - x0 - 40
  const total = Math.max(...rows.map(r => r.parts.reduce((a, p) => a + p.v, 0)))
  const body = rows
    .map((r, i) => {
      let x = x0
      const y = top + i * rh
      const segs = r.parts
        .map(p => {
          const pw = (p.v / total) * span
          const s = `<rect x="${x}" y="${y}" width="${pw}" height="28" fill="${p.c}" rx="3"/>${pw > 28 ? `<text x="${x + pw / 2}" y="${y + 19}" fill="${C.bg}" font-size="14" font-weight="700" text-anchor="middle" ${FONT}>${esc(String(p.label ?? p.v))}</text>` : ''}`
          x += pw
          return s
        })
        .join('')
      return `<text x="${x0 - 14}" y="${y + 19}" fill="${r.strong ? C.amber : C.text}" font-size="14" text-anchor="end" ${FONT}${r.strong ? ' font-weight="700"' : ''}>${esc(r.name)}</text>${segs}`
    })
    .join('\n')
  let lx = x0
  const leg = legend
    .map(l => {
      const s = `<rect x="${lx}" y="${h - 38}" width="14" height="14" fill="${l.c}" rx="2"/><text x="${lx + 22}" y="${h - 26}" fill="${C.dim}" font-size="13" ${FONT}>${esc(l.t)}</text>`
      lx += 22 + 8 * l.t.length + 34
      return s
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="${w}" height="${h}" rx="14" fill="${C.bg}"/>
<text x="28" y="40" fill="${C.text}" font-size="20" font-weight="700" ${FONT}>${esc(title)}</text>
${sub.map((t, i) => `<text x="28" y="${66 + i * 19}" fill="${C.dim}" font-size="13" ${FONT}>${esc(t)}</text>`).join('')}
${body}
${leg}
</svg>\n`
}

const wtl = (w, t, l) => [{ v: w, c: C.teal }, { v: t, c: C.line, label: t }, { v: l, c: C.red }]
writeFileSync(
  `${root}assets/evidence.svg`,
  bars(
    'Quoting your words beats summarising them',
    ['39 real requests replayed · answers by Opus 5.5 · compared with nothing attached', 'blind pairwise grading, asked in both orders; a win needs both to agree'],
    [
      { name: 'the actual correction (ceiling)', parts: wtl(36, 3, 0) },
      { name: 'ownwords: 6 quotes + predict', parts: wtl(25, 11, 3), strong: true },
      { name: '3 random one-line rules', parts: wtl(18, 15, 6) },
      { name: '3 distilled one-line rules', parts: wtl(14, 17, 8) },
    ],
    [{ c: C.teal, t: 'better' }, { c: C.line, t: 'tie' }, { c: C.red, t: 'worse' }],
  ),
)

writeFileSync(
  `${root}assets/routing.svg`,
  bars(
    'Same delegation, cheaper subagent',
    ['Claude Code · main model Opus 5.5 · one task: a subagent lists 27 exported functions', '2 runs each · all 4 runs listed all 27'],
    [
      { name: 'routing on, run 1 (Haiku)', parts: [{ v: 0.171, c: C.teal, label: '$0.171' }], strong: true },
      { name: 'routing on, run 2 (Haiku)', parts: [{ v: 0.173, c: C.teal, label: '$0.173' }], strong: true },
      { name: 'routing off, run 1 (Opus)', parts: [{ v: 0.3, c: C.red, label: '$0.300' }] },
      { name: 'routing off, run 2 (Opus)', parts: [{ v: 0.439, c: C.red, label: '$0.439' }] },
    ],
    [{ c: C.teal, t: 'subagent on Haiku' }, { c: C.red, t: 'subagent inherits Opus' }],
  ),
)
console.log('assets written')
