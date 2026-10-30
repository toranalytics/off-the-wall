# Experiment 15 result (offline, 2026-10-30). The plan file and the evaluator are unchanged (SHA-256 in FROZEN-SHA256.txt).

Output: eval15-output.txt.

- Family detection from quote text at TAU = 0.30: 57 linked pairs, purity 0.860 (criterion 0.90), only 40 of 90 repeat records linked to their own original, recall 0.444 (criterion 0.80). The repeats in this store are paraphrases written by a model, so word and character-pair similarity of the quotes does not find most of them.
- Wide recall (W) on the 11 kept tasks: target family shown for 10, shown at least twice for 3, 6.00 quotes per prompt, 4.64 of them not from the target family.
- Family completion (F2): target family shown for 9 (it lost c137), at least twice for 6, 6.00 quotes per prompt, 4.36 not from the target family.
- Criteria: purity FAIL, repeat recall FAIL, two-quote count +3 PASS, family hit not lower FAIL, quotes per prompt PASS. Result: criteria not met.

Decision: the feature is not built, no model run. What it shows: showing a repeated correction twice is possible (+3 tasks) but only if repeats can be recognised, and a text-similarity detector cannot recognise paraphrased repeats; a model-based or capture-time link (for example the judge marking "this repeats an earlier correction") would be needed, which is a different and more expensive design. Another reading of the numbers: even with repeats in the store, 4.6 of 6 shown quotes are not about the task, so the noise on related prompts is large, and that, not retrieval misses, is what remains to be worked on.

Not tested (stated in the plan): pinning the most repeated corrections, because this store repeats every preference exactly three times and cannot rank families by frequency.
