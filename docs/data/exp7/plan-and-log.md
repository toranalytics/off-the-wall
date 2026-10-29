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

### Confirmation run, valid (2026-10-29; `confirm.csv`, runner `run-exp7.mjs`; run by the account owner in a logged-in terminal; Claude Code 2.1.311, haiku, headless, synthetic)
The earlier attempts (24 + 24 runs with 0 tokens) were logged-out and are discarded. This run: 24 runs, every run returned a result, USD 0.12 in total. Arms: v0 = current default, v9 = `recallGate` on.
| task | arm | pass | quotes shown | mean output tokens | mean turns |
|---|---|---|---|---|---|
| c114 | v0 | 6/6 | 6 | 4,359 | 7.3 |
| c114 | v9 | 6/6 | 3 | 3,280 | 6.5 |
| c033 | v0 | 2/6 | 6 | 1,139 | 4.3 |
| c033 | v9 | 2/6 | 4 | 767 | 3.0 |
- Reading: no loss of passes with the gate on in the two tasks whose quotes it changes. c114 keeps its target correction in both arms and passes 6/6 in both; c033's target is not retrieved in either arm and it passes 2/6 in both (incidental).
- Output tokens and turns were lower with the gate on (about -25% and -33%). With 6 runs per cell on two tasks this is not tested for significance and may be run-to-run variation; it is not a claimed saving.
- Not shown: any benefit on pass rate, behaviour on a real history, a different model, or the 14 preference-free tasks (not rerun). The check can only say "no harm seen" here.
- Decision: `recallGate` stays opt-in and default off. Evidence is two offline rounds on a small synthetic set plus this two-task check; that is not enough to change the default.

## Finding after the confirmation run: V9's noise reduction does not hold on the larger repeat store (2026-10-29, offline)
`small-store.mjs` (20 seeded subsets of the 240-record repeat store per size, no model calls). Quotes shown on the 8 unrelated prompts, default vs gate (V9 as shipped), and target-in-picks over tasks whose target family is in the subset:
| store size | hit default | hit gate | unrelated default | unrelated gate |
|---|---|---|---|---|
| 10 | 0.83 | 0.70 | 6.0 | 0.06 |
| 20 | 0.81 | 0.73 | 6.0 | 0.18 |
| 40 | 0.66 | 0.61 | 6.0 | 0.66 |
| 80 | 0.63 | 0.65 | 6.0 | 1.84 |
| 150 | 0.66 | 0.68 | 6.0 | 3.56 |
| 240 | 0.85 | 0.90 | 6.0 | 5.50 |
On the full 240-record store the gate shows 6,6,6,6,4,6,4,6 quotes on the 8 unrelated prompts (mean 5.5). Cause: the two-shared-words rule counts stopwords ("what", "the", "about", "write") that appear in many stored requests, so any prompt with two of them passes; the earlier 6.0 -> 2.0 was measured only on the 150-record single store, where the effect happens to be larger. Correction: the CHANGELOG sentence and this log's round-2 reading overstate the generality; the 2.0 holds for that one store only.

### Round 3 (registered before it is run; one try)
- V10: like V9, but a shared word counts toward the "two words" rule only if it appears in fewer than 30% of the stored requests (so stopwords and other common words do not count). The single-rare-word rule (< 5%) is unchanged.
- Pass rule, fixed now: HIT_single >= 11, HIT_repeat >= 17 (V0 values), HOLD >= 0.933, and mean quotes on the 8 unrelated prompts <= 3.0 on BOTH the 150-record single store and the 240-record repeat store.
- Overfitting caveat: this is the third look at the same 20 tasks and 8 prompts after seeing the failure, so the holdout is the only protection and the result is exploratory. If V10 fails the rule, `recallGate` stays as is, documented as only effective on that store, or is removed.

### Round 3 result: V10 fails its pre-registered rule
V10: HIT_single 10 (< 11), HIT_repeat 17, HOLD 0.922 (< 0.933), quotes on unrelated prompts 2.00 on the 150-record single store (shipped gate code with V9: 2.00 single, 5.50 repeat; V10 was not run on the repeat store because it had already failed the hit and holdout conditions). Not kept.
Conclusion of experiment 7: no variant found that cuts unrelated-prompt noise on both stores without losing targets or holdout hits. V9 only helped on the 150-record single store (6.0 -> 2.0) and not on the 240-record repeat store (6.0 -> 5.5), and it lowers target hits for stores of 40 or fewer records (0.83 -> 0.70 at 10 records). Decision, applying the simplicity criterion borrowed from autoresearch ("an improvement of about 0 with more code: discard"): the opt-in `recallGate` is removed from `src/` (the setting, selector code and its tests). Wide recall stays as in 0.3.0. The experiment record, evaluator and data stay in `docs/data/exp7/`; the helper scripts that pass the gate argument (`check-gate-equivalence.mjs`, `per-task-hits.mjs`, `small-store.mjs`, `noise-repeat-store.mjs`) were run against the gate code at commit 9d12683 and no longer behave as described on current main.
What this leaves open: the noise on unrelated prompts is real (6 quotes on every 20+ character prompt with wide recall, experiment 4b/6: no pass loss, about +9% output tokens). A lexical gate does not fix it on larger stores; a different kind of relevance signal (for example an embedding or a model judging relevance) would be a separate, larger experiment and has not been done.
