# Experiment 11 (2026-10-29): when a correction has been repeated many times, do the repeats crowd out other corrections?

Status: plan, written before any variant is evaluated. Offline, no model calls.

## Source of the idea (Karpathy's LLM Wiki gist, read 2026-10-28/29)
The gist's central point: do not re-derive knowledge from raw pieces on every query; keep a maintained, consolidated layer ("ingest" merges new material into existing entries, "lint" looks for duplicates, contradictions and stale entries) and read an index first. Applied to Off the Wall: users repeat the same correction many times, and every repeat is a separate record. Today up to 6 quotes are shown, ranked by similarity, with exact-text deduplication only. If one preference has been said five times in slightly different words, several of the 6 slots can show the same preference and leave less room for other corrections that also apply. Consolidating a preference's repeats into one entry ("family") would free those slots. This is the one idea from the gist that maps onto a measurable property of the selector.
Earlier evidence that this could matter: with 3 repeats per preference (experiment 5) target retrieval rose from 11 to 17 of 20 tasks, so repeats help matching, but the same repeats can occupy several slots. Not measured so far: how many slots they take, and whether a request that needs two preferences at once gets both.

## Hypothesis
Collapsing near-duplicate corrections into one entry per family, while still matching on every member's request text, raises the share of two-preference prompts for which both preferences are shown, without losing single-preference hits.

## Data (all synthetic and already in the repo)
- 240-record repeat store (experiment 5): 30 preferences, 90 repeats (3 per preference, written by a model), plus single corrections of other kinds.
- 20 preference-task prompts (experiment 4) with their target preference ids; a record belongs to a preference family if its id equals the preference id or starts with `<id>-r`.
- Two-preference prompts: 40 pairs of the 20 tasks chosen with a fixed seed ("order-exp11"); prompt = first task prompt + " Also: " + second task prompt; targets = both preference families.
- Unrelated prompts (8) and the 64-prompt holdout (experiment 3 store without repeats), as in experiment 7.

## Metrics
JOINT (of 40 pair prompts: both target families among the quotes shown), ANY (at least one target family shown), SLOTS (mean number of quotes shown per single-task prompt that belong to the target family: crowding), HIT_single and HIT_repeat (20 tasks), NOISE (mean quotes on the 8 unrelated prompts, repeat store), HOLD (holdout).

## Variants (fixed now, thresholds not tuned afterwards, each tried once)
- C0: current main (wide recall, 20-character guard).
- C1: collapse by quote similarity 0.50: greedy clusters of records whose quote text has TF-IDF cosine >= 0.50 to the cluster's newest member; a cluster is scored by the best score of any member's request text; one quote (the newest member) is shown per cluster; up to 6 clusters.
- C2: same with 0.35.
- C3: same with 0.70.
Cluster quality is reported as information (share of clusters containing records of a single preference id family), not as a pass condition.

## Keep rule (fixed now)
Keep a variant only if JOINT is at least 25 percent higher than C0's (relative), HIT_single >= C0's, HIT_repeat >= C0's, NOISE <= C0's, and HOLD >= C0's - 0.02. A kept variant would still need a model-run check on two-preference tasks before any default change. If none is kept, the selector stays and that is the result.

## Limits written in advance
Synthetic repeats written by a model, pairs built by concatenating tasks, 20 tasks, offline only. JOINT measures presence in the shown quotes, not that a model follows both. Real users' repeats may be more or less similar to each other.

## Log
- Self-check passed (C0 reproduces `pickCorrections` on tasks, pairs and unrelated prompts). Each variant evaluated once. `eval11.mjs` hash in `FROZEN-SHA256.txt` was written before the first variant run.

### Result
| | JOINT (of 40 pairs) | ANY | SLOTS | HIT_single | HIT_repeat | NOISE | HOLD |
|---|---|---|---|---|---|---|---|
| C0 current | 18 | 36 | 1.35 | 11 | 17 | 6.00 | 0.953 |
| C1 collapse 0.50 | 18 | 36 | 1.30 | 11 | 17 | 6.00 | 0.953 |
| C2 collapse 0.35 | 20 | 36 | 1.20 | 11 | 17 | 6.00 | 0.953 |
| C3 collapse 0.70 | 18 | 36 | 1.35 | 11 | 17 | 6.00 | 0.953 |
Cluster information (quote-text similarity over the 240 records): 0.70 forms no multi-member cluster, 0.50 forms 9 (all of one preference), 0.35 forms 20 (17 of one preference).
Keep rule (JOINT >= 22.5 and nothing else worse): no variant passes; the best, C2, reaches 20 (+11 percent).

### Conclusion of experiment 11
The hypothesis is not supported on this data. Repeats do not crowd the 6 slots much: a target preference takes 1.35 of them on average. Collapsing them frees at most 0.15 slots (C2: 1.20), and on the two-preference prompts it raised JOINT from 18 to 20 of 40 at best, below the +25 percent that was required. Two things limit the idea here: the model-written repeats are worded differently from each other, so quote-text similarity groups only a minority of them; and for the pair prompts the binding limit is retrieval of each preference (ANY 36 of 40 but JOINT 18 of 40), not slot crowding. Selector unchanged. Not tested: real users' repeats (which may be nearly identical and then crowd more), contradiction or staleness handling from the same gist, an index-first read. Limits: synthetic repeats, concatenated pair prompts, 20 tasks, offline only.
