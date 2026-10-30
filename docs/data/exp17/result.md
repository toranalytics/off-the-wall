# Experiment 17 result (user terminal, 2026-10-30). Plan, runner and gate are unchanged (SHA-256 in FROZEN-SHA256.txt).

Output: run.jsonl (every call), run-summary.txt. 180 haiku calls, every answer parsed, USD 0.504 (the plan estimated 0.2-0.4).

- Links made 152 of 180. Precision 0.480 (criterion 0.95). Recall 0.811, which is the ceiling set by the candidates (73 of 90). False links on the 90 controls 73 (criterion at most 3).
- Criteria: precision FAIL, recall PASS, false links FAIL. Result: criteria not met. The feature is not built.

What the data shows (analysis after the result, not a new test):
- On the 90 repeats the judge was right when it linked: 79 linked, 73 to the right family (92%), 6 to a wrong one.
- On the controls it linked 73 of 90 (81%), in every category (measure 12 of 13, tests 11 of 12, verify 9 of 10, minimal 10 of 13, style 10 of 11, complete 9 of 15, delegated 8 of 9, destructive 4 of 7). Examples: a control about "run docker build and show me" was linked to another record about "run the batch with /usr/bin/time", "remove ONE console.log" to a record about "keep the existing tabs". These records belong to the same broad habit ("do only what I asked", "run it before you say it works") but have different ids, so the labels count them as false.
- So the judge cannot tell "the same habit said again" from "another correction of the same broad kind", and the store itself has many records of the same broad kind. My prompt allowed "the same kind of instruction", which invites the broad reading; the labels only accept the narrow one. Both are design limits of this test, and the result is recorded as it is.

Not run: a stricter prompt ("the same specific instruction about the same thing") with a label set that also accepts broad-kind links. That would be a new experiment with its own plan.
