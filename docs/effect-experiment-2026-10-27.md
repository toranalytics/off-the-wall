# Recall on/off experiment (2026-10-27): what it shows and what it does not

Plan was fixed before any real run. Data: `data/effect-experiment-2026-10-27.csv`; script: `data/effect-experiment-run-exp.mjs` (its self-test checks that each scorer fails a bad outcome and that the recall block appears only when recall is on).

## Setup
Claude Code 2.1.311, haiku, headless, plugin 0.2.1, synthetic tasks, automatic scoring (no model grading). 5 tasks x recall on/off x 10 repetitions = 100 runs, order shuffled with a fixed seed. Capture and routing off in both arms; only `recall` differs. Each workspace's store held one matching correction (with a past request written to resemble the task) and two corrections from other tasks.

## Result
| task | what a pass means | recall on | recall off |
|---|---|---|---|
| verify | tests run after the edit and pass | 10/10 | 10/10 |
| complete | all 6 requested files created | 10/10 | 10/10 |
| decide | delegated choice made without asking | 10/10 | 10/10 |
| measure | line counts equal to the real counts | 10/10 | 10/10 |
| minimal | only the file in use was changed | 10/10 | 0/10 |
| all | | 50/50 | 40/50 (Fisher p = 0.001) |

Manipulation check: the recall block was present in 50/50 on-runs and 0/50 off-runs. All 100 runs ended with `success`; total cost USD 0.36.

## How to read it
- The whole difference comes from one task. Without the correction, all 10 off-runs also edited `config.example.json` and `README.md` (they kept the example and docs consistent); with the correction quoted back, all 10 on-runs left them alone. So the recalled sentence changed behaviour in the way the user had asked before. Whether "touch only the used file" is the better outcome is the user's preference, which is the point of the plugin, not an objective quality measure.
- In the other four tasks the model passed every time with or without recall: a ceiling. This experiment cannot say anything about recall there.
- The 10 repetitions of a task use the same prompt, so the effective sample is 5 tasks, not 100 independent cases. The p-value overstates how general the result is.
- The matching correction and its past request were written by the experimenter to resemble each task: this is a best-case relevance test. It does not test whether the plugin finds the right correction in a real, noisy history.
- One small model, one machine, headless only, synthetic tasks. Nothing here is evidence about real-world correction rates, cost savings or task success.

## Next
Harder tasks where the model fails by default, corrections that are not matched by design (a real or noisy history), more than one model, and an interactive session. Until then the claim is limited to: on one task where the model's default differed from the stored preference, a quoted past correction changed the behaviour in 10/10 runs versus 0/10.
