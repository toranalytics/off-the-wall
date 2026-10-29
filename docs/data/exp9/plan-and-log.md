# Experiment 9 (2026-10-29): does a small local embedding model pick relevant corrections better than word overlap?

Status: plan written before any model run. The evaluation code below was only run end to end with a fake hashed embedder (to test the pipeline); no real embedding result exists yet. It has to be run in a terminal where the native ONNX runtime can load: in the agent sandbox macOS refused to load `onnxruntime-node` and `sharp` (code-signature policy), so the experiment could not be run there.

## Why
Experiments 7 and 8 showed that word-overlap tricks cannot cut the quotes attached to unrelated prompts without losing target corrections. A model that scores meaning might. Off the Wall has no dependencies, so an embedding model could at best become an optional extra, never a default.

## Setup
`@huggingface/transformers`, model `Xenova/all-MiniLM-L6-v2` (q8), mean pooling, normalized, embeddings of each stored request's text (`about`, first 300 characters) and of the prompt. Same data and evaluator logic as experiment 7, so numbers are comparable: 150-record single store and 240-record repeat store (experiment 5), 20 preference-task prompts (experiment 4), 8 unrelated prompts, and the 64-prompt holdout (experiment 3).

## Variants (fixed now, thresholds are not tuned afterwards; each tried once)
- E0: current main (word-overlap TF-IDF, wide recall), for reference.
- E1: embedding cosine, top 6 with cosine >= 0.35.
- E2: embedding cosine, top 6 with cosine >= 0.45.
- E3: embedding cosine, top 6 with cosine >= 0.55.
Quotes are deduplicated as in `pickCorrections`.

## Metrics
HIT_single and HIT_repeat (of 20 tasks: target family among the picks), NOISE_single and NOISE_repeat (mean quotes on the 8 unrelated prompts), HOLD (share of the 64 holdout prompts with a pick in the prompt's category).

## Keep rule (fixed now)
A variant is a candidate only if HIT_single >= 11, HIT_repeat >= 17, HOLD >= 0.933, and NOISE <= 3.0 on BOTH stores (the rule of experiments 7 and 8). If none passes, word overlap stays and that is the result. A candidate would still need a model-run check and could only become an opt-in setting, because the embedding model needs a dependency and a download.

## Limits written in advance
Synthetic store and prompts, 20 tasks, one embedding model, thresholds picked by me before looking (an arbitrary grid of three); a hit means the target is shown, not that a model follows it.

## Log
(not run yet)
