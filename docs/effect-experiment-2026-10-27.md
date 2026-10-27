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
| all | | 50/50 | 40/50 |

Manipulation check: the recall block was present in 50/50 on-runs and 0/50 off-runs. All 100 runs ended with `success`; total cost USD 0.36.

## How to read it
- No pooled p-value is given as a headline: the whole difference rests on one task, so a pooled test would overstate it.
- The whole difference comes from one task. Without the correction, all 10 off-runs also edited `config.example.json` and `README.md` (they kept the example and docs consistent); with the correction quoted back, all 10 on-runs left them alone. So with the stored correction in context the model followed it. Whether "touch only the used file" is the better outcome is the user's preference, which is the point of the plugin, not an objective quality measure.
- In the other four tasks the model passed every time with or without recall: a ceiling. This experiment cannot say anything about recall there.
- The 10 repetitions of a task use the same prompt, so the effective sample is 5 tasks, not 100 independent cases. The p-value overstates how general the result is.
- The matching correction and its past request were written by the experimenter to resemble each task: this is a best-case relevance test. It does not test whether the plugin finds the right correction in a real, noisy history.
- One small model, one machine, headless only, synthetic tasks. Nothing here is evidence about real-world correction rates, cost savings or task success.

## Independent review (a Claude Opus 5.5 reviewer, read-only, same day) and corrections to the above
- Verdict: partly obvious. This mostly shows that a sentence placed in context is followed; any text injected that way would likely do the same, so it does not by itself show that OTW's retrieval adds value.
- The recall block also contains a generic instruction ("Before answering, predict in one line what this user would object to..."). No arm isolates that instruction or the quoted sentence from each other, and no arm tests a static rules file.
- The matching correction's past request was near-identical in form to the task ("Change the app's timeout to 30." vs "Change the app's port to 8080.") and the two distractors came from unrelated tasks, so retrieval was easy. The injected quotes were not logged; the self-test only checked that the matching quote was present.
- The "minimal" pass rule is the same preference the seeded correction states, the experimenter wrote both, and the prompt is ambiguous: updating a README that says the default port is arguably the better behaviour. "off = 0/10" is a consistent default (every off-run changed the other files), but "fail" is the experimenter's label. Runs with recall on also took fewer turns on this task (4-7 vs 8-14).

## What may be said
On Claude Code 2.1.311 with haiku, the OTW hook reliably injected a stored correction (50/50 on, 0/50 off), and on one synthetic task where the model's default conflicted with that correction, behaviour flipped from 0/10 to 10/10 under best-case relevance. The experimenter wrote the correction, the task and the pass rule, so this does not test retrieval from a real history and does not show a benefit over a static instruction.

## Next
The test that would speak to OTW's own claim: freeze a noisy store of real captured corrections first (about 100-300, not edited by the experimenter); have someone else write 10-20 tasks with pass rules fixed beforehand and keep tasks the no-recall arm fails at least half the time; compare (a) no recall, (b) OTW-ranked top-k, (c) k random corrections from the same store in the same block format, (d) the same store as a static rules file. Retrieval is supported only if (b) beats (c) per task; whether recall beats a plain rules file is (b) versus (d). Also log the injected quotes and run more than one model and an interactive session.
