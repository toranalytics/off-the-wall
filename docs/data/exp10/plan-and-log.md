# Experiment 10 (2026-10-29): quote the correction with the request it was about?

Status: plan, written before any model run. Model runs are done by the account owner in a terminal (the agent sandbox has no logged-in Claude CLI).

## Why
A quote today is only the correction text. It loses the request it was said about, so "only change that one line" can be applied to a different task. The README and the articles call this the main known weakness. Idea: show, next to each quote, the stored request it was a reply to: `- "<quote>" (said in reply to the request: "<about>")`. Question: does that keep the benefit on personal preferences, and does it reduce wrong application of one-off corrections?

## Arms
- quote: the current block (quote only).
- quote_about: the same block, each quote followed by `(said in reply to the request: "<about, 120 characters>")`. Implemented only in the isolated test copy of the plugin through an environment variable (`OTW_EXP_ABOUT=1`); not in the product.
- none (harm tasks only): recall off.

## Tasks
- Preference tasks: the 11 kept tasks of experiment 4 with the fixed scorer of experiment 5b (`tasks4-v2.mjs`), 240-record repeat store of experiment 5. 3 runs per task and arm.
- Misapplication ("harm") tasks, 4 new ones written by the experimenter with automatic scorers. Each has a small store of 6 records: one tempting one-off correction from another task plus 5 unrelated records of experiment 5's store. A wrong application means doing less than the new task asks:
  - h-refactor: stored "I wanted only that one line fixed. Do not restructure the handler or touch anything else." (about: fix line 88 of handlers/upload.js). New task: split `handle` in handlers/upload.js into validateName, validateType and validateSize helpers, behavior unchanged.
  - h-cli-readme: stored "Only edit the README. Do not touch any code files." (about: update the install steps in README.md). New task: add a `--verbose` flag to cli.js that prints "verbose on" and document it in the README.
  - h-paginate-test: stored "Don't add tests, I only asked for the rename. Keep the diff to the rename." (about: rename a helper in utils.js). New task: fix an off-by-one in paginate in utils.js and add a node:test test for it.
  - h-explain-retry: stored "Too long. Two lines max, I will not read more." (about: summarize the changelog for release notes). New task: explain step by step how the retry logic in client.js works, covering every branch (pass needs at least 6 non-empty lines and 90 words).
  Each harm task is run 3 times for none, quote and quote_about (36 runs). The scorers are checked on a known-good and a known-bad solution before any model run, and the tempting record must be among the quotes shown (offline check, self-test).
Total 66 + 36 = 102 runs, Claude Code 2.1.311, haiku, headless, synthetic, order shuffled with a fixed seed.

## Decision rule (fixed now)
- Preference tasks: quote_about must pass at least as many runs as quote minus 2 (of 33).
- Harm tasks: count failures per arm (a failure is a wrong application or any other fail); quote_about must have no more failures than quote.
- Ship `quote_about` as the default only if both hold AND at least one shows a gain (preference passes higher by 3 or more, or harm failures fewer by 2 or more). If both hold without a gain it can only be an opt-in. If the harm tasks show no misapplication in `quote` (zero failures) the harm question is unanswered and nothing is claimed about it. If either condition fails, nothing is shipped and this record is the result.
- Exploratory by construction: 33 and 12 runs per cell, one small model, tasks written by the experimenter, scorers written with the tempting record in view.

## Log
- Self-test passed before any model run (`node run-exp10.mjs --selftest`): every task and arm builds the intended block (none: no block; quote: block without the request; quote_about: block with it), the tempting record is among the quotes shown for each harm task, and every scorer fails an untouched or minimal-change solution and passes a known-good one (the explain task's untouched case is waived because it is a text task).
- The only change to the plugin test copy (isolated, not in the product), in `correctionBlock`:
  `- <quote>` becomes `- <quote> (said in reply to the request: "<about, 120 characters>")` when `OTW_EXP_ABOUT=1`.
- Run: `bash docs/data/exp10/run-exp10.sh` (102 runs, resumable). Output: `run.csv`, `run-summary.txt`.

### Result (run by the account owner in a terminal on 2026-10-29; `run.csv`; Claude Code 2.1.311, haiku, headless; USD 0.56; every run returned a result, 4 of 104 ended at the turn limit and count as fails)
The runner recorded 104 rows instead of 102: two cells have a fourth row ((rep 2, h-paginate-test, none) and (rep 1, task-c033, quote)), which means two runs overlapped (the runner was probably started twice at the same time). The `run-summary.txt` the runner wrote counts the duplicates (preference quote 21/34, quote_about 19/33; harm none 1/13). The table below keeps the first row of each (rep, task, arm). Using the second row instead changes only harm/none (11/12 instead of 12/12, a turn-limit failure) and nothing that the decision rule looks at.
| | passes |
|---|---|
| preference tasks, quote (current block) | 20/33 |
| preference tasks, quote_about | 19/33 |
| harm tasks (wrong application of a one-off correction), none | 12/12 passed (0 failures) |
| harm tasks, quote | 12/12 passed (0 failures) |
| harm tasks, quote_about | 12/12 passed (0 failures) |
- Per task on the preference side: quote_about better in 1 task, worse in 2, tied in 8. Mean output tokens 2,095 against 2,251 (+7%).
- Integrity check: the `about_seen` column is 1 for every quote_about run and 0 for every quote run; no block for none.
- Decision rule: preference condition met (19 >= 20 - 2), harm condition met (0 <= 0), gain no. The harm question is unanswered: with the quote-only block the model never misapplied a one-off correction in these 12 runs, so there was nothing for the added request text to prevent.
- Same four preference tasks stay at 0/3 in both arms (c004, c015, c057, c104).

### Conclusion of experiment 10
Quoting the request next to the correction did not help on personal preferences (19/33 against 20/33, within noise) and the one-off misapplication it was meant to prevent did not occur with this model on these four tasks, so no benefit was measured. It costs a few more tokens per quote. Decision: not shipped, not added to the product or to the local GJC module; the plain quote stays. This does not show that misapplication never happens; the four tasks were written by the experimenter and one small model followed the new task each time. A harder test (tasks where the one-off instruction is more tempting, other models) would be needed before drawing a conclusion either way.
