# Experiments

Every experiment run on Off the Wall, including the ones that did not work and the ones that were stopped. All of them use made-up (synthetic) habits and corrections, small models, headless runs and three runs per cell, so none of them shows an effect on real users or on every model. From experiment 4 on, plans and pass criteria were fixed before each run (SHA-256 of the evaluators is kept next to them). Raw data, runners and plans are in `docs/data/`.

| # | What was tested | Result | Verdict | Where |
|---|---|---|---|---|
| 1 | Recall on/off, 100 runs | Recall on 50/50 against off 40/50; the whole difference came from one task (minimal). Most tasks passed either way. An independent review called the evidence only partly clear. | weak evidence | `docs/effect-experiment-2026-10-27.md, docs/data/effect-experiment-2026-10-27.csv` |
| 2 | Noisy correction stores (150 records), exploratory | About 50 runs; the difference was at the noise level. | no clear effect | `docs/data/exp2` |
| 3b | Ablation of the 'predict the objection' line | No significant difference. | no effect | `docs/data/exp3` |
| 4 | Personal preferences the model cannot know (11 tasks, 165 runs) | Passes of 33: none 2, default OTW 8, 150 rules in CLAUDE.md 16, one-line rules 8. The pre-set main test was not significant (p = 0.25). An exploratory subgroup (target correction retrieved) showed 7/12 against 1/12. | main test not met; exploratory signal | `docs/data/exp4` |
| 4b | Remove the similarity floor (wide recall) | 16/33 against 8/33 for the default (sign test p = 0.063). | better, borderline | `docs/data/exp4` |
| 5 | Repeated corrections in the store (240 records, 99 runs) | Passes of 33: none 1, default 9, wide recall 17 (sign test p = 0.008). | effect on synthetic habits | `docs/data/exp5` |
| 5b | Rerun after a grader fix | Passes of 33: none 2, default 14, wide recall 25 (10 better, 0 worse, 1 tied, p = 0.002). The grader was fixed after seeing results, so this is not an independent replication. | effect, not independent | `docs/data/exp5b` |
| 6 | Harm check on tasks that need no habit (14 tasks, 84 runs) | No recall 40/42, wide recall 41/42; output tokens about +9%. | no harm seen | `docs/data/exp6` |
| 7 | Fewer quotes on unrelated requests (word conditions) | On 150 records the unrelated quotes went from 6.0 to 2.0, on 240 records from 6.0 to 5.5, so it did not generalize. A small model check (2 tasks) showed no loss. | rejected | `docs/data/exp7` |
| 8 | Fewer quotes on short inputs (6 variants) | None passed the bar; the existing guard stays. | rejected | `docs/data/exp8` |
| 9 | Local embedding model for relevance | One setting cut noise a lot but lost useful quotes on held-out cases; three more settings failed the same bar. | rejected | `docs/data/exp9` |
| 10 | Show the original request next to each quote | Quote only 20/33, quote plus request 19/33; misapplication check 12/12 in all arms. | no gain | `docs/data/exp10` |
| 11 | Merge repeats of the same correction (wiki-style memory) | 20/40 against 18/40, +11% (bar was +25%). | rejected | `docs/data/exp11` |
| 12 | Same habits on Sonnet (66 runs) | No recall 2/33, quotes 20/33; better on 7 tasks, worse on 0 (sign test p = 0.016). | effect on synthetic habits | `docs/data/exp12` |
| 13 | Assigning work between Codex and Claude | Stopped by decision before any code or run. | not run | - |
| 14 | Same habits on Opus | Planned and prepared, not run by decision. | not run | `docs/data/exp14` |
| 15 | Family completion: show a second wording of a repeated correction (offline) | Text similarity found only 44% of the repeats (purity 0.86), and the policy lost one target hit. Criteria not met. | rejected | `docs/data/exp15` |
| 16 | Wording around the quotes (3 wordings, haiku, 99 runs) | Passes of 33: current 21, standing-preferences 22, check-before-answering 20. No measurable difference. | no effect | `docs/data/exp16` |
| 17 | Judge model marks a repeated correction (180 calls) | Recall 0.81 (the ceiling), but precision 0.48 and 73 of 90 controls linked. Criteria not met. | rejected | `docs/data/exp17` |

Not an experiment: `docs/data/demo-before-after/` is a side-by-side illustration (3 tasks, one run each, first run shown) of the same request without and with the plugin. The measured numbers are in rows 5b and 12.

Generated from a central list; the numbers above are the recorded ones. If a README or article says something different, this file and the raw data win.
