# Experiment 14 (2026-10-29): does the recall effect hold with the largest Claude model (Opus)?

Status: plan, written before any model run. Model runs are done by the account owner in a terminal.

## Why
Experiments 5b/10 (haiku) and 12 (Sonnet) found that quoting the matching correction raises how often synthetic personal habits are followed. Opus is the model most likely to follow a habit without help, so it is the case where the effect could shrink or vanish. The README and articles still say Opus is not measured.

## Design
Identical to experiment 12 except the model: the 11 preference tasks, the fixed scorer of experiment 5b, the 240-record repeat store, arms none (recall off) and quote (current default, wide recall), 3 runs per task and arm = 66 runs, Claude Code 2.1.311 headless, synthetic tasks, automatic scoring. Model `opus`; per-run budget cap raised to USD 1.5 (the runner stops a run that would exceed it, which is then scored as a fail and counted in the log). The four tasks that failed in every earlier arm (c004, c015, c057, c104) are kept so the result stays comparable.

## Reading rule (fixed now, same as experiment 12)
- Primary: pooled passes, quote versus none, and the per-task sign test (unit = task, ties excluded).
- If none already passes at least 24 of 33 (ceiling): "Opus follows these habits without help; no room to show the effect here".
- Else if quote passes more runs than none and the sign test gives p < 0.05: "the effect also appears with Opus on these synthetic tasks".
- Otherwise: "no effect shown with Opus" with the sample size.
Runs that end at the turn limit or the budget cap count as fails and are listed. If more than 6 of 66 runs end that way, the result is reported as inconclusive for those arms rather than as an effect.

## Limits written in advance
One run per cell triple, synthetic tasks and store written by models, headless; Opus only, nothing about the Codex models.

## Log
- Self-test passed before any model run (`node run-exp14.mjs --selftest`).
- Run once, in one terminal: `bash docs/data/exp14/run-exp14.sh` (66 runs, resumable). Output: `run.csv`, `run-summary.txt`. Cost estimate USD 12-25 from the Sonnet run (USD 3.80); the real figure is not known until it runs.
