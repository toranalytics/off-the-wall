# Experiment 16 result (user terminal, 2026-10-30). Plan and runner are unchanged (SHA-256 in FROZEN-SHA256.txt).

Output: run.csv (99 runs, every run produced a result, USD 0.47), run-summary.txt. Model haiku, 11 preference tasks, 3 reps.

- Passes of 33: v0 (current wording) 21, v1 (standing preferences) 22, v2 (check before answering) 20.
- v1 vs v0: +1 pass; better on 2 tasks, worse on 2, tied on 7; sign test p = 1.0. v2 vs v0: -1 pass; better on 1, worse on 3, tied on 7; p = 0.625. Criterion (+5 passes, better on at least 3 tasks, worse on at most 1): not met for either. Result: the wording makes no measurable difference. Nothing is changed and the Sonnet and harm-check steps are not run.
- Output tokens per run: v0 1,924, v1 2,224, v2 2,069.

Where the passes are (all 9 runs per task, wording pooled; target-family quotes shown from run.csv):
- Always or almost always followed, under every wording: c033, c082, c114, c006, c136 (9 of 9), c124 (8 of 9).
- Rarely or never followed: c104 (0 of 9; no target-family quote was shown at all, a retrieval miss), c015 (1 of 9) and c004 (1 of 9) (one target-family quote shown, still not followed), c057 (4 of 9), c137 (4 of 9; 0 of 3 under v0, 2 of 3 under v1 and v2, the only task where wording may matter, three runs per cell).
So the remaining gap on these tasks is not the wording around the quotes. For c104 the quote never reaches the model; for c004 and c015 the model seems to give the explicit current request priority over the old habit (inferred from the pass counts, the raw outputs were not read; the block says the current request takes precedence, which is the intended behavior and the safety rule stays).
