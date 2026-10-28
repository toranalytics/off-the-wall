# OTW experiment 3: can the selector find the right past correction more often? Plan fixed before evaluation (2026-10-27)

Background: experiment 2 step A found OTW's ranker returned at least one same-category correction for 8/16 tasks (about 3.2 expected by chance with the live pick limit of 6), 43% of picks were same-category, and 3 tasks got no block. The ranker scores the new prompt against each stored record's past request (`about`) only, never the correction text (`quote`).

Variants (all three specified now, nothing else will be tried):
- V0 baseline: score against `about` (current behaviour).
- V1: score against `about` + " " + `quote` concatenated.
- V2: score against `about` and against `quote` separately; use the higher cosine.
All other settings unchanged: same TF-IDF word + bigram features, same threshold 0.18, same cap of 6, same dedupe.

Data: Dev = the frozen exp2 store (150) and its 16 task prompts. Holdout = a second store (150) and 64 prompts (8 per category) written by a model that saw neither the first store, nor the tasks, nor the code, nor the variants. Matching is by category only.
Metrics per set: hitRate = share of prompts whose picks contain at least one same-category correction; precision = same-category picks / all picks; noiseShare = picks from the noise category / all picks; coverage = share of prompts that got any block.
Adoption rule (fixed): adopt a variant only if, on BOTH dev and holdout, hitRate improves by at least 5 percentage points over V0, AND precision falls by no more than 3 points, AND noiseShare does not rise by more than 3 points. If several qualify, take the largest holdout hitRate gain. If none qualifies, the baseline stays and "no improvement found" is reported. No threshold or feature tuning on either set.
Afterwards (only if a variant is adopted): rerun the exp2 retrieval step A for the product change and, separately, the model-run comparison is NOT repeated until tasks exist where the default model fails.
Limits: lexical similarity on synthetic text; category-level relevance is a proxy for "would this correction have prevented this mistake"; one author model per set.

## Log: result of the selector comparison (run after the plan above)
Holdout files frozen by hash before evaluation (tmp/otw-exp3/FROZEN-SHA256.txt). The V0 reimplementation matched the plugin's own picker on 16/16 dev prompts. Results (hitRate / precision / noiseShare / coverage):
- dev (16 prompts): V0 0.50 / 0.43 / 0.11 / 0.81; V1 0.06 / 0.17 / 0.00 / 0.25; V2 0.56 / 0.34 / 0.11 / 0.88.
- holdout (64 prompts): V0 0.89 / 0.40 / 0.12 / 0.98; V1 0.52 / 0.39 / 0.11 / 0.67; V2 0.88 / 0.38 / 0.14 / 0.98.
Adoption rule: neither V1 nor V2 qualifies (V1 loses badly, V2 does not improve on the holdout and lowers precision). Baseline stays. "No improvement found" for these three variants.
Notes: (1) the live hook caps picks at 6; exp2 step A used 3 (the hit count is unchanged at 8/16, chance 3.2, same-category picks 16/37 = 43%). (2) Holdout hit rates are far higher than dev because the holdout prompts and store were written in one pass by one model and share domains; the dev prompts, by a different author, share little wording with the store. The dev figure is the more conservative one.

## Experiment 3b: does the block's generic "predict an objection" sentence matter? Plan fixed before running (same day)
Task: verify-slug only (the only kept task with room, default 3/5 in main stage). Arms, 10 reps each, order shuffled by a fixed seed: none (recall off); otw (real plugin block: quotes + boundary + predict sentence); otw_noask (same quotes, boundary kept, predict sentence removed); ask_only (boundary + predict sentence, no quotes). The switch exists only in the isolated test config's copy of the plugin (env OTW_EXP_ASK), not in the product. OTW's picks for this task are of the wrong categories (complete, tests), so this tests wrong-category quotes plus instruction versus the pieces.
Reading, fixed now: comparisons by Fisher exact test (otw vs none, otw_noask vs none, ask_only vs none, otw vs otw_noask), alpha 0.05, 10 vs 10, so only large differences can be detected. A null result means "not detectable at n=10", not "no effect". No product change follows from this experiment alone.

## Log: experiment 3b result (run 2026-10-28, 40 runs, USD 0.24, no run without a result)
verify-slug, 10 reps per arm: none 6/10, otw (quotes + predict sentence) 5/10, otw_noask (quotes, no predict sentence) 6/10, ask_only (predict sentence, no quotes) 3/10. Fisher p: otw vs none 1.00, otw_noask vs none 1.00, ask_only vs none 0.37, otw vs otw_noask 1.00. Block present in all 30 treated runs, 0 in none. Nothing is detectable at n=10; the earlier 0/5 for the otw arm in the main stage was not reproduced (5/10 now), so the hypothesis that wrong-category quotes plus the predict sentence hurt is not supported by this data. ask_only was lowest (3/10) but the difference is within noise. No product change follows.
