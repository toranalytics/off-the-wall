// The only file the experiment edits. Each variant applies to prompts under 20 trimmed characters only.
export const VARIANTS = {
  V0: { note: 'current main (floor 0.18)', floor: 0.18 },
  S1: { note: 'floor 0.30', floor: 0.30 },
  S2: { note: 'floor 0.40', floor: 0.40 },
  S3: { note: '0.18 + whole-word anchor (word in <30% of records)', floor: 0.18, anchor: true },
  S4: { note: '0.18, at most 3 quotes', floor: 0.18, cap: 3 },
  S5: { note: '0.25 + whole-word anchor', floor: 0.25, anchor: true },
}
