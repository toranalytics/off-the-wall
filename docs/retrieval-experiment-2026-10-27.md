# Experiment 2 (2026-10-27): does retrieval from a noisy history help? Result: no evidence, and little room to test

Plan and log, written before the runs: `data/exp2/plan-and-log.md`. Data and scripts: `data/exp2/`. Synthetic only; Claude Code 2.1.311, haiku, headless.

## Why this experiment
Experiment 1 (`effect-experiment-2026-10-27.md`) showed only that a quoted sentence placed in context is followed. OTW's own claim is retrieval: from a user's noisy history in the same working directory, quote back the corrections relevant to the new request. To avoid tailoring, the store (150 corrections: 120 in 8 mistake categories, 30 unrelated) was written by one model that never saw the tasks, and the 16 tasks with automatic scorers by a different model that never saw the store. They match only by category. Both were hashed before any run.

## Step A: retrieval quality, offline (no model calls)
OTW's own ranker on the real store and tasks: a block was produced for 13/16 tasks; at least one same-category correction was among the picks for 8/16 tasks (about 3.2 expected by chance with the same number of picks; the live hook returns up to 6 quotes); 16 of 37 picks were same-category (base rate 10%), 4 were noise. (An earlier version of this note used a cap of 3 by mistake: 10/28 same-category picks, chance 2.6; the 8/16 hit count was the same.) Better than chance, but half the tasks get no relevant correction and 3 get no block.

## Step B: pilot (recall off, 3 reps x 16 tasks)
14 of 16 tasks passed 3/3 with no recall at all: the model already avoids these mistakes. Only measure-invoices (1/3) and verify-slug (1/3) met the pre-stated rule (default fails in at least half). For both, OTW's picks in Step A contained no same-category correction.

## Step C: main, exploratory (2 kept tasks x 5 arms x 5 reps = 50 runs, USD 0.29)
| task | none | OTW | random (same format) | all rules as CLAUDE.md | distilled rules |
|---|---|---|---|---|---|
| verify-slug | 3/5 | 0/5 | 3/5 | 4/5 | 2/5 |
| measure-invoices | 5/5 | 5/5 | 3/5 | 4/5 | 1/5 |

All differences are within noise at n=5 per cell (for example 3/5 vs 0/5 has Fisher p of about 0.17). The planned sign test across tasks is impossible with 2 tasks and no pooled significance is claimed.

## What it does and does not show
- No evidence that OTW's ranking beats random corrections, no recall, or a plain rules file on these tasks.
- On verify-slug, OTW's picks were of the wrong categories (complete, tests) in all 5 runs and the arm passed 0/5 versus 3/5 without recall. This is within noise. It was tested directly afterwards (see below) and not reproduced.
- The "none" arm passed 3/5 and 5/5 in the main stage after 1/3 and 1/3 in the pilot: selection on a noisy pilot regresses to the mean, so the kept tasks were mostly not hard.
- The main limit is that haiku 5.5 rarely makes these mistakes by default on small tasks (14 of 16 at ceiling). The premise of OTW, repeated mistakes the user keeps correcting, did not hold for this model on these tasks. That says nothing about longer, messier real sessions or weaker models.
- Synthetic store and tasks, one model, headless, one machine, 5 reps per cell.

## What follows for the product (not for marketing)
1. Retrieval needs improving: half the tasks got no relevant correction. Candidate: match on the correction text as well as the past request, and show nothing when the match is weak.
2. The block's generic "predict an objection" instruction should be tested alone.
3. Any real test needs tasks the default model fails, or a real history, or a weaker model.

## Follow-up: can the selector be improved? (experiment 3, `data/exp3/`)
Three variants were fixed in advance: V0 current (score the new prompt against each past request), V1 (past request + correction text concatenated), V2 (max of the two separate scores). Evaluated on the dev set above and on a holdout store (150) and 64 prompts written independently of the store, tasks and code. Adoption rule fixed in advance: hit rate up by at least 5 points on both sets without losing precision.
| set | variant | hit rate | precision | any block |
|---|---|---|---|---|
| dev (16) | V0 / V1 / V2 | 0.50 / 0.06 / 0.56 | 0.43 / 0.17 / 0.34 | 0.81 / 0.25 / 0.88 |
| holdout (64) | V0 / V1 / V2 | 0.89 / 0.52 / 0.88 | 0.40 / 0.39 / 0.38 | 0.98 / 0.67 / 0.98 |
No variant qualifies, so the selector is unchanged: no improvement was found. The holdout hit rate is much higher than the dev one because its prompts and store were written in one pass by one model and share domains; the dev figure is the conservative one. Hit rate means a same-category correction is among the picks, a proxy for relevance, not for whether it would prevent the mistake.

## Follow-up: does the block's "predict an objection" sentence matter? (experiment 3b, `data/exp2/ablate.csv`)
verify-slug only, 10 runs per arm, fixed in advance: no recall 6/10; the current block (quotes + predict sentence) 5/10; quotes without the predict sentence 6/10; the predict sentence without quotes 3/10. Fisher p-values are 1.00, 1.00 and 0.37 against no recall, and 1.00 between the first two block variants. Nothing is detectable at n=10, the earlier 0/5 was not reproduced, and no product change follows. The test switch existed only in an isolated test copy of the plugin.
