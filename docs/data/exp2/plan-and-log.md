# OTW experiment 2: does retrieval from a noisy history help? Plan fixed before any run (2026-10-27)

Why: experiment 1 showed only that a quoted sentence in context is followed. OTW's distinctive claim is different: from a user's own noisy history of corrections in the same working directory, it quotes back the ones relevant to the new request, and that prevents the repeated mistake. Experiment 2 tests that claim.

Independence (so the experimenter does not tailor store and tasks to each other):
- Store: 150 synthetic corrections (120 in 8 mistake categories, 30 unrelated noise) written by Claude Opus 5.5, which saw only the category list, never the tasks.
- Tasks and scorers: 16 node-only tasks (2 per category), written by GPT-6 Astra, which saw only the category list, never the store. Deterministic scorers with a self-test (good outcome passes, bad outcome fails, untouched fixture fails).
- Store and tasks are matched only by category, never by wording. Both are frozen before any model run; I (the experimenter) edit neither except for bugs that make a scorer wrong, each logged.

Step A, offline, no model calls: retrieval quality. For each task prompt, run OTW's own selection against the full store (one shared working directory) and record whether the selected quotes include at least one correction of the task's category, against the chance rate for the same number of picks. Also record how many picks were noise.
Step B, pilot: arm "none" only, 3 reps per task. Keep tasks where the default fails in at least half of the reps (the others cannot show benefit).
Step C, main, on kept tasks, 5 reps per arm per task, order shuffled with a fixed seed:
 (a) none: recall off.
 (b) OTW: the real plugin, real store, its own ranking.
 (c) random: same plugin block format, k random corrections from the store (k = number OTW selected for that task).
 (d) rules file: all 120 category + noise `rule` lines in CLAUDE.md in the workspace, recall off.
 (e) distilled: the plugin with the same store but each record's quote replaced by its rule line (tests quote vs rule, the original OTW claim).
Primary: (b) minus (c) pass rate, per task, summarised by a sign test across tasks (unit = task). Secondary: (b) vs (a), (b) vs (d), (b) vs (e). A manipulation check logs the injected quotes for every run.
Stopping rules: per-run budget cap USD 0.15; any run with no result counts as fail and is reported; no run is dropped.
Pre-stated reading: if (b) is not better than (c), OTW's current ranking adds nothing beyond injecting any past corrections, and that is what will be written. If retrieval in Step A is at chance, Step C is still run and reported but the retrieval claim is withdrawn.
Limits: synthetic history and tasks, one small model, headless, one machine, 5 reps per cell.

## Log (before any model run)
- Correction to the plan text: arm (d) puts ALL 150 `rule` lines of the store in CLAUDE.md (not 120). Arm (c) uses the plugin's own block format with k random records whose past-request text is set to the task prompt so the plugin selects them (k = number of quotes OTW selected for that task; for tasks where OTW selects none, (c) shows none). Pilot reps are 1-3 and are used only to pick tasks; main reps are 4-8 and are fresh for every arm, including "none", to avoid selection bias.
- Frozen inputs (sha256): tasks.mjs 806ea205...ad7908, store/store.json e4507e91...c0272 (see tmp/otw-exp2/FROZEN-SHA256.txt). Scripts: run-exp2.mjs (self-test 106 checks passed), retrieval-eval.mjs.
- Step A result (offline, OTW's own ranker, real store and tasks): a block was produced for 13/16 tasks; 8/16 tasks had at least one same-category correction among the picks versus about 2.6 expected by chance with the same number of picks; 10 of 28 picks were same-category (base rate 10%), 4 were noise. So retrieval is better than chance but misses the relevant category in half the tasks and returns nothing for 3 tasks.

## Log: pilot result (recorded before the main stage)
- Pilot (arm none, 3 reps x 16 tasks = 48 runs, USD 0.26): 14 of 16 tasks passed 3/3 without any recall. Kept by the pre-stated rule (default fails in at least half of reps): measure-invoices (1/3) and verify-slug (1/3). Both kept tasks are ones where Step A found no same-category correction among OTW's picks.
- Consequence: the planned primary analysis (sign test across tasks) is impossible with 2 tasks. Deviation, stated before the main stage: the main stage still runs on the 2 kept tasks (5 arms x 5 reps = 50 runs) and is reported as EXPLORATORY, with per-task counts and the pooled counts per arm; no pooled significance claim. The finding that 14/16 tasks have no room for recall to help (the default model already avoids these mistakes) is itself a result and will be reported as such.
