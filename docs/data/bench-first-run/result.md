# `otw bench` first real run (2026-10-30)

Run by the author in their own terminal: `otw bench --yes` with Claude Code 2.1.311, model haiku, 3 reps, 66 runs, the isolated test profile (not a normal install).
The terminal summary line was `Habit followed: 3/33 (9%) with recall off, 20/33 (61%) with Off the Wall`, cost reported by the CLI USD 0.33. An independent re-score of the 66 session transcripts with the same scorers (`rescore.mjs`) gave the identical per-task table below.

| task | recall off | recall on |
|---|---|---|
| c004 | 0/3 | 1/3 |
| c006 | 0/3 | 3/3 |
| c015 | 0/3 | 2/3 |
| c033 | 0/3 | 1/3 |
| c057 | 0/3 | 0/3 |
| c082 | 0/3 | 3/3 |
| c104 | 0/3 | 0/3 |
| c114 | 0/3 | 3/3 |
| c124 | 0/3 | 1/3 |
| c136 | 3/3 | 3/3 |
| c137 | 0/3 | 3/3 |
| **total** | **3/33** | **20/33** |

Notes: one run per cell group and one model, so this is a sanity check that the command works end to end, not a new experiment. The plugin block was present in all recall-on runs and absent in all recall-off runs. c136 passes without recall, probably because of a rule in the author's own global settings (not verified). The command left its temporary directories behind in this run; the next commit deletes them after each run (`--keep` keeps them).
