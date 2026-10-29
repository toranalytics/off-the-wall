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
