// Which past corrections to quote for a new prompt: the 3 whose request is most like it (TF-IDF over words and
// character bigrams, in memory), then the latest, 6 distinct. Measured on 39 replayed requests (see README,
// "Evidence"): the person's own words plus "predict the objection and avoid it" won 25 to 3 against nothing,
// while one-line rules distilled from the same corrections did no better than random rules.

export const QUOTES = 6
export const SIMILAR_QUOTES = 3
// Below this the top hit shares little more than common words. The corrections list is short, so a low bar still
// keeps the similar slots useful; anything that misses falls through to the latest corrections.
export const MIN_SIMILAR = 0.05
// A hit at or above this is the same text sent again: nothing new to show.
export const SAME = 0.95

export function features(text) {
  const f = new Map()
  const words = text.toLowerCase().match(/[\p{L}\p{N}_-]+/gu) ?? []
  for (const w of words) {
    if (w.length >= 2) f.set(`w:${w}`, (f.get(`w:${w}`) ?? 0) + 1)
    for (let i = 0; i + 1 < w.length; i++) {
      const b = `b:${w.slice(i, i + 2)}`
      f.set(b, (f.get(b) ?? 0) + 1)
    }
  }
  return f
}

function weigh(f, idf) {
  const vec = new Map()
  let sq = 0
  for (const [k, tf] of f) {
    const w = (1 + Math.log(tf)) * (idf.get(k) ?? 0)
    if (w > 0) {
      vec.set(k, w)
      sq += w * w
    }
  }
  return { vec, norm: Math.sqrt(sq) }
}

export function build(texts) {
  const feats = texts.map(features)
  const df = new Map()
  for (const f of feats) for (const k of f.keys()) df.set(k, (df.get(k) ?? 0) + 1)
  const idf = new Map()
  for (const [k, d] of df) idf.set(k, Math.log((texts.length + 1) / (d + 1)))
  return { idf, docs: feats.map((f, i) => ({ i, ...weigh(f, idf) })) }
}

// Indexes of the documents most like the query, best first.
export function search(index, query, minScore, limit) {
  const { vec, norm } = weigh(features(query), index.idf)
  if (norm === 0) return []
  const scored = []
  for (const d of index.docs) {
    if (d.norm === 0) continue
    let dot = 0
    for (const [k, w] of vec) {
      const v = d.vec.get(k)
      if (v) dot += w * v
    }
    const s = dot / (norm * d.norm)
    if (s >= minScore && s < SAME) scored.push({ i: d.i, s })
  }
  return scored.sort((a, b) => b.s - a.s).slice(0, limit).map(x => x.i)
}

export const one = (s, n) => {
  // Box-drawing characters come from text copied off a terminal pane.
  const t = String(s).replace(/[│┃║╎╏]/g, ' ').replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n)}…` : t
}

export function pickCorrections(list, prompt, now, n = QUOTES) {
  const past = list.filter(c => c.at < now && String(c.quote ?? '').trim())
  if (past.length === 0) return []
  const texts = past.map(c => String(c.about || c.quote).slice(0, 300))
  const similar = search(build(texts), prompt, MIN_SIMILAR, SIMILAR_QUOTES).map(i => past[i])
  const latest = [...past].sort((a, b) => b.at - a.at)
  const out = []
  const seen = new Set()
  for (const c of [...similar, ...latest]) {
    const key = one(c.quote, 60)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(c)
    if (out.length === n) break
  }
  return out
}

// The Korean wording is the one that was measured; the English one says the same.
const WORDING = {
  ko: {
    head: '[ownwords] 이 사용자가 실제로 했던 지적 (원문, 이번 요청과 비슷한 것과 최근 것):',
    ask: '답하기 전에, 지금 쓰려는 답에 이 사용자가 무엇이라고 지적할지 한 줄로 예측하고, 그 지적을 받지 않게 답을 고쳐서 내라. 예측 문장 자체는 답에 쓰지 않는다.',
  },
  en: {
    head: '[ownwords] What this user actually said when correcting earlier answers (verbatim; the most similar to this request, then the latest):',
    ask: 'Before answering, predict in one line what this user would object to in the answer you are about to give, and change the answer so it does not draw that objection. Do not write the prediction in the answer.',
  },
}

export const langOf = text => (/[가-힣]/.test(text) ? 'ko' : 'en')

export function correctionBlock(cs, lang = 'en') {
  const w = WORDING[lang] ?? WORDING.en
  return [w.head, ...cs.map(c => `- "${one(c.quote, 200)}"`), w.ask].join('\n')
}
