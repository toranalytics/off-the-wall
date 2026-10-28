# Experiment 4 (2026-10-28): personal preferences the model cannot know

Plan and log, written before the runs: `data/exp4/plan-and-log.md`. Data and scripts: `data/exp4/`. Claude Code 2.1.311, haiku, headless, plugin 0.2.1, synthetic store and tasks, automatic scoring.

## Why this test
Experiments 1-3 used mistakes the default model mostly avoids (running tests, finishing the list), so there was no room to show benefit. The corrections OTW is for are personal ones no model can know: commit format, date format, tooling, tone. The frozen experiment-2 store already holds 30 such preferences among 150 corrections. Twenty of them were turned into tasks with deterministic scorers by a model that saw only the preference texts (not the store's past-request sentences the ranker matches on, nor the code). Scorers were self-tested (compliant passes, non-compliant fails, untouched fails).

## Setup
Pilot: recall off, 3 reps x 20 tasks. Kept: tasks the default model violated in at least half the reps (11 of 20). Main: 11 tasks x 5 arms x 3 fresh reps = 165 runs. Arms: none; otw (real plugin and ranking); random (same block format, random records); rules (all 150 rule lines in CLAUDE.md); distilled (plugin block with the rule line instead of the quote).

## Result (passes / runs)
| | none | OTW | random | rules file | distilled |
|---|---|---|---|---|---|
| all 11 tasks | 2/33 | 8/33 | 2/33 | 16/33 | 8/33 |
| 4 tasks where OTW retrieved the target correction | 1/12 | 7/12 | n/a | 3/12 | |
| 7 tasks where it did not | 1/21 | 1/21 | n/a | 13/21 | |

- Pre-registered primary test (sign test across tasks): OTW vs random 3 better, 0 worse, 8 tied, p = 0.25; the same against no recall. Not significant at this size (11 tasks, 3 reps).
- Exploratory: the subgroup "OTW's picks contain the exact target correction" was defined offline before any model run. In those 4 tasks OTW passed 7/12 against 1/12 without recall (Fisher p = 0.027; runs are not independent, so treat as indicative). Where the target was not retrieved OTW did nothing (1/21 vs 1/21).
- The static rules file was best overall (16/33) because at 150 records it always contains the right rule; in the 4 retrieved tasks the quoted correction beat it (7/12 vs 3/12). A rules file does not scale to a long history, and OTW is meant for that case; this test does not cover it.
- Retrieval is the bottleneck: the exact target was among OTW's picks for 8 of 20 tasks (0.4 expected by chance). Ignoring the 0.18 similarity threshold the target is in the top 6 for 11 of 20.

## What it does and does not show
- First indication of an effect of the intended kind: when OTW finds the right past correction, the model follows it far more often than the default (7/12 vs 1/12). Not shown: that OTW finds it often enough to matter, or that this holds for a real user's history, other models, or interactive use.
- Limits: synthetic preferences written by a model, 3 reps per cell, 11 tasks, one small model, one machine, headless; the task author had to see the preference text it tests.

## Follow-up: dropping the similarity floor (experiment 4b, `data/exp4/lever.csv`)
Idea from the retrieval finding: remove the 0.18 floor so the top 6 by rank are always shown. Same 11 tasks, 3 fresh runs each, 66 runs; the override exists only in an isolated test copy of the plugin.
| | passes / runs |
|---|---|
| current floor (0.18) | 8/33 (same as the earlier 8/33) |
| no floor, top 6 always | 16/33 |
- Per task: 5 better, 0 worse, 6 tied; two-sided sign test p = 0.063 (just above the 0.05 used in the plan); pooled Fisher p = 0.072 (runs are not independent).
- The prediction fixed before the run held: the target is newly retrieved for three tasks (c004, c082, c114), and there the no-floor variant passed 8/9 against 2/9 (p = 0.015). In the other 8 tasks 8/24 against 6/24 (p = 0.75), no difference.
- Cost: 6.0 quotes per prompt against 2.5 (198 vs 81 over 33 runs). With no floor every prompt, including unrelated non-coding ones, receives 6 quotes; the current floor already lets 1-2 through for unrelated prompts (8 of 8 in a small check). Distraction on unrelated tasks was not measured beyond the earlier n = 10 ablation, which found nothing detectable.
- Decision: the default stays; the change is offered as the opt-in setting `recallWide` (0.2.3 candidate). It is not evidence of benefit on a real history.

## Follow-up: when the same correction has been repeated (experiment 5, `data/exp5/`)
OTW's premise is that a developer repeats the same correction in different situations. The store was extended with 90 repeats (3 per preference, written by a model that saw only the preference texts), 240 records in total, frozen by hash.
Offline, target preference among the quotes shown (20 tasks): default floor 8 -> 13 with repeats; no floor (recallWide) 11 -> 17. On the 11 kept tasks: 4 -> 7 and 7 -> 10.
Model runs, 11 kept tasks x 3 reps (99 runs, USD 0.43):
| | passes |
|---|---|
| no recall | 1/33 |
| OTW default | 9/33 |
| OTW no floor (recallWide) | 17/33 |
- Sign tests across tasks: no floor vs none 8 better, 0 worse, p = 0.008; default vs none 5/0/6, p = 0.063; no floor vs default 3/0/8, p = 0.25.
- The no-floor advantage replicated: 16/33 vs 8/33 in 4b, 17/33 vs 9/33 here (pooled 33/66 vs 17/66, Fisher p = 0.007; runs not independent, indicative).
- Better offline retrieval did not translate into more default-floor passes (9/33 vs 8/33 before). Retrieval is not the only lever: two tasks (c004, c006) failed in every arm even with the target family in the block, i.e. the model sometimes does not follow a shown correction.
- Limits: repeats are written by a model; 3 reps per cell; one small model; headless.
