# Experiment 12 (2026-10-29): does the recall effect hold with a larger model (Sonnet)?

Status: plan, written before any model run. Model runs are done by the account owner in a terminal.

## Why
Every model test so far used one small model (Claude Code with haiku). A larger model may already follow personal habits better without help, or may follow the quoted corrections more reliably. The articles and the README list "other models" as not measured; this is the cheapest way to start measuring it.

## Design
Same 11 preference tasks, same scorer (experiment 5b fixed scorer), same 240-record repeat store and the same current block as experiment 10's `quote` arm; arms: none (recall off) and quote (current default, wide recall). 3 runs per task and arm = 66 runs. Model: `sonnet` (Claude Code 2.1.311, headless, synthetic tasks, automatic scoring). The runner is `run-exp12.mjs` (copy of the experiment 10 runner with the model, arms and budget changed: `--max-budget-usd 0.6` per run because Sonnet costs more per token).

## Decision and reading rule (fixed now)
- Primary: pooled passes quote versus none, and the per-task sign test (unit = task, ties excluded).
- If quote passes more runs than none and the sign test is p < 0.05: write "the effect also appears with Sonnet on these synthetic tasks".
- If none already passes at least 24 of 33 (a ceiling), nothing can be shown: write "Sonnet follows these habits without help; no room for the effect here".
- Otherwise (no clear difference below the ceiling): write "no effect shown with Sonnet" and state the sample size.
Whatever the outcome, the README and articles get the sentence updated; no code change follows from this experiment.

## Limits written in advance
One larger model, 3 runs per cell, synthetic tasks and store written by models, headless; a result for Sonnet says nothing about Opus or Codex models.

## Log
- Self-test passed before any model run (`node run-exp12.mjs --selftest`: every task builds the intended block in the quote arm and none in the none arm; every scorer passes a known-good and fails a known-bad solution).
- Run: `bash docs/data/exp12/run-exp12.sh` (66 runs, resumable). Output: `run.csv`, `run-summary.txt`. Note: run it once, in one terminal; experiment 10 recorded two duplicate rows because two runs overlapped.

### Result (run by the account owner in a terminal on 2026-10-29; `run.csv`, `run-summary.txt`; Claude Code 2.1.311, sonnet, headless; USD 3.80; all 66 runs returned a result; no duplicate rows; the quote arm showed the block in all 33 runs and the none arm in none)
| task | none | quote |
|---|---|---|
| c006 | 0/3 | 3/3 |
| c114 | 0/3 | 3/3 |
| c033 | 0/3 | 2/3 |
| c137 | 0/3 | 3/3 |
| c124 | 0/3 | 3/3 |
| c136 | 0/3 | 3/3 |
| c082 | 2/3 | 3/3 |
| c004, c015, c057, c104 | 0/3 | 0/3 |
| all | 2/33 | 20/33 |
- Per task: quote better in 7 tasks, worse in none, tied in 4; sign test p = 0.016.
- Ceiling rule: none passed 2 of 33, far below 24, so there was room to show an effect.
- Cost and effort (mean per run, not tested for significance): none USD 0.063, 1,035 output tokens, 5.0 turns, 13 s; quote USD 0.053, 819 output tokens, 3.9 turns, 10 s. With the quote the runs were somewhat shorter and cheaper, which is consistent with the model not having to guess the habit, but this experiment did not test that explanation.
- The four tasks at 0/3 in both arms are the same as with haiku (c004, c015, c057, c104).

### Conclusion of experiment 12
By the rule fixed before the run: the effect also appears with Sonnet on these synthetic tasks (2/33 without recall, 20/33 with the current default; 7 tasks better, 0 worse). The size is similar to the haiku runs (haiku, current default: 20/33 in experiment 10, 25/33 in experiment 5b, against 1/33 and 2/33 without recall). Not shown: any other model (Opus, the Codex models), real users' histories, interactive use, long-term effects. Limits as before: synthetic habits and store written by models, 3 runs per cell, headless.
