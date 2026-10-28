# Experiment 7 (2026-10-28): cutting recall noise without losing the right correction

Status: plan, written before any variant is evaluated.

## Why
Since 0.3.0 wide recall is on by default: every prompt of 20+ characters receives up to 6 quotes, even for an unrelated prompt (experiment 4b: 6.0 quotes for "What is the capital of Mars?" with no floor, 1.8 with the old floor). Experiment 6 found no harm (40/42 vs 41/42) but a small cost (+9% output tokens) and the risk grows as the store grows. Goal: show fewer quotes when nothing in the store is really about the prompt, while keeping the target correction when it exists.

## Method borrowed from karpathy/autoresearch (program.md)
Read 2026-10-28 from https://github.com/karpathy/autoresearch and its program.md. What is borrowed:
- One immutable evaluator (like `prepare.py`): `eval7.mjs`, frozen by SHA-256 before any variant runs. Variants may not change it.
- One editable file (like `train.py`): `variants7.mjs`, a handful of small selector functions.
- A fixed, cheap experiment budget: the loop is offline (no model calls, seconds per variant). Model runs are only for a final confirmation.
- A baseline first: V0 is the current main behaviour; it is evaluated unchanged before anything else.
- Keep / discard against a stated metric, every attempt logged to `results7.tsv` (commit-free here: variant id, metrics, keep|discard|crash, description).
- Simplicity criterion: a variant that deletes or shortens code at equal metrics beats one that adds code; a gain that needs a lot of new logic is not worth it.
Not borrowed: "loop forever". The variant list is fixed below (7 variants), so the search cannot overfit the 20 tasks by trying hundreds of ideas.
Also from https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f (LLM Wiki): its "lint" pass looks for duplicates and stale items in a growing knowledge store. The store here also grows with near-duplicate corrections (repeats fill several of the 6 slots), so one variant (V5) suppresses near-duplicates. The wiki's main idea (compile knowledge once instead of re-retrieving) is not tested here: the earlier "distilled" arm was 8/33 against 16/33 for raw quotes + wide recall, so it is not a candidate now.

## Data (all synthetic, already in the repo, nothing new written for this)
- Single store: `exp5/store3.json` without ids containing `-r` (150 records). Repeat store: all 240 records (adds 3 repeats per preference).
- 20 preference tasks: `exp4/tasks4.mjs` (prompt, target preference id `pref`). A record belongs to the target family if its id equals the pref id or starts with `<pref>-r`.
- Unrelated prompts U: the 8 non-coding prompts of `exp4/side4.mjs` ("What is the capital of Mars?", ...). Any quote shown for them is noise.
- Holdout (not used to choose a variant, only to veto): `exp3/store2.json` (150) with `exp3/prompts2.json` (64 prompts with a category). A "category hit" = at least one pick has the prompt's category.

## Metrics (computed by eval7.mjs)
- HIT_single, HIT_repeat: tasks (of 20) whose picks contain a target-family record, on the single and the repeat store.
- NOISE_U: mean number of quotes shown on U (lower is better).
- OTHER: on the 20 tasks, mean number of picks that are not in the target family (single store).
- HOLD: category-hit rate over the 64 holdout prompts.
Baseline V0 uses the real `pickCorrections` from this repo (recallWide on, 20-character guard). The evaluator's own scoring must reproduce V0's picks exactly for all prompts (self-check); otherwise the evaluator is wrong and nothing is evaluated.

## Variants (fixed list, tried once each)
- V0: current main.
- V1: relative gate: keep a candidate only if score >= 0.5 x the top score.
- V2: relative gate 0.3.
- V3: absolute floor 0.05 (between the old 0.18 and the wide 1e-6).
- V4: lexical anchor: a candidate must share at least one whole word (>= 3 characters, appearing in fewer than 30% of the records) with the prompt; character-bigram-only overlap no longer counts.
- V5: near-duplicate suppression: skip a candidate whose cosine similarity to an already selected quote is >= 0.6 (so repeats of one preference take one slot).
- V6: the best combination of the variants that individually pass the rule below (decided after V1-V5, at most one combination, tried once).

## Keep rule (fixed now)
Keep a variant only if all hold: HIT_single >= V0, HIT_repeat >= V0, HOLD >= V0 - 0.02, and NOISE_U <= 0.75 x V0's NOISE_U. Among kept variants prefer the smaller code. If none is kept the answer is "no cheap offline gain; wide recall stays as is" and that is what gets written.

## Only if something is kept: confirmation with model calls
11 kept tasks of experiment 4, 3 fresh runs each, arms V0 and the kept variant (66 runs, Claude Code haiku, headless, synthetic), plus the 14 no-preference tasks of experiment 6, 3 runs, kept variant only (42 runs) compared with the earlier wide result. Ship as default only if the pass counts are not lower than V0 beyond noise and no preference-free task loses 2 of 3. These run on the logged-in Claude account (roughly USD 1 in total at earlier prices).

## Limits written in advance
20 tasks and one model-written store: an offline gain here says nothing about a real history. Hit means the target is shown, not that the model follows it (experiment 4: not always). The holdout veto is a weak check.

## Log

### Round 2 result (eval7b.mjs = eval7.mjs + `ctx.sharedWords` only; it reproduces the round-1 table exactly; both hashes in FROZEN-SHA256.txt)
| | HIT_single | HIT_repeat | NOISE_U | OTHER | HOLD |
|---|---|---|---|---|---|
| V7 (rare cutoff 10%) | 10 | 17 | 4.50 | 5.00 | 0.922 |
| V8 (V4 + rel 0.5) | 12 | 18 | 3.25 | 4.50 | 0.922 |
| V9 (>=2 shared words or 1 word in <5%) | 11 | 18 | 2.00 | 5.20 | 0.938 |
Round-2 rule (noise <= 3.0, HIT >= V0, HOLD >= V0 - 0.02): V9 kept; V7 and V8 discarded (V8: noise 3.25 and HOLD 0.922 < 0.933).
Reading: V9 cuts the quotes shown on unrelated prompts from 6.0 to 2.0 and keeps the target on the same 11 of 20 tasks (18 of 20 with repeats). It was found in a second round on 20 tasks and 8 unrelated prompts, so some overfitting is possible; the holdout check is weak.
Implementation: shipped as the opt-in setting `recallGate` (default off) in `src/similar.mjs`; `check-gate-equivalence.mjs` shows the shipped code gives the same numbers as V9 in the evaluator (NOISE_U 2.00, HIT 11 and 18). Unit tests: `test/recall-gate.test.mjs`.
Side effect found while writing the tests: in a store of 20 records or fewer no word can be "rare" (1/N is not below 5%), so a prompt must share two whole words with a stored request. That is stricter for new users with tiny stores. It has not been measured.

### Change to the confirmation plan (decided after seeing the per-task picks, before any model run)
`per-task-hits.mjs`: on the 11 kept tasks V9 changes the quotes shown for only 2 tasks (c114: 6 -> 3 quotes, target kept; c033: 6 -> 4, target absent in both). For the other 9 tasks the prompt context is identical, so a 66-run comparison would mostly compare identical conditions. Instead: tasks c114 and c033, 6 fresh runs each, arms V0 and V9 (24 runs). This can show only "no obvious harm" for those two; it cannot show a benefit. The 14-task preference-free harm check is not rerun: V9 only removes quotes there, and wide recall already showed no harm (experiment 6). Not measured: quality effects on unrelated prompts and token savings in real sessions (offline only: quotes shown on unrelated prompts 6.0 -> 2.0).

### Confirmation run: invalid, not counted
The 24 runs of the targeted check completed in about 30 seconds with 0 tokens and USD 0: the Claude CLI in the isolated config had lost its login ("Not logged in - Please run /login", `terminal_reason: api_error`), and the runner scored those empty answers as failures. They are discarded and not data. The check has not been run; it needs a fresh login of the isolated CLI by the account owner. Until then `recallGate` has offline evidence only and stays opt-in (default off).
