// The only file the experiment edits. Each variant: filter(ctx, ranked) -> ranked', accept(ctx, cand, chosen) -> bool.
// ranked: [{ i, s }] best first, already past the wide floor. ctx gives texts, word statistics and quote vectors.
export const VARIANTS = {
  V0: { note: 'current main (wide recall, 20-char guard)', filter: (ctx, r) => r },
  V1: { note: 'relative gate 0.5 x top', filter: (ctx, r) => r.filter(x => x.s >= 0.5 * r[0].s) },
  V2: { note: 'relative gate 0.3 x top', filter: (ctx, r) => r.filter(x => x.s >= 0.3 * r[0].s) },
  V3: { note: 'absolute floor 0.05', filter: (ctx, r) => r.filter(x => x.s >= 0.05) },
  V4: {
    note: 'lexical anchor: share a whole word (>=3 chars, in <30% of records) with the prompt',
    filter: (ctx, r) => r.filter(x => ctx.sharedRareWord(x.i)),
  },
  V5: {
    note: 'near-duplicate suppression: cosine to a chosen quote >= 0.6 is skipped',
    filter: (ctx, r) => r,
    accept: (ctx, cand, chosen) => !chosen.some(o => ctx.quoteCos(cand.i, o.i) >= 0.6),
  },
}

// Round 2 (registered in plan-and-log.md before running)

VARIANTS.V7 = { note: 'V4 with rare cutoff 10%', filter: (ctx, r) => r.filter(x => ctx.sharedWords(x.i, 0.1) >= 1) }
VARIANTS.V8 = { note: 'V4 + relative gate 0.5', filter: (ctx, r) => { const a = r.filter(x => ctx.sharedWords(x.i, 0.3) >= 1); return a.filter(x => x.s >= 0.5 * (a[0]?.s ?? 0)) } }
VARIANTS.V9 = { note: '>=2 shared words, or 1 word in <5% of records', filter: (ctx, r) => r.filter(x => ctx.sharedWords(x.i, 1) >= 2 || ctx.sharedWords(x.i, 0.05) >= 1) }
