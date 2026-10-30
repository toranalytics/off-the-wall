# OTW experiment 17: can a judge model recognise that a correction repeats an earlier one? Plan fixed before the model run (2026-10-30)

Why. Experiment 15 (offline) showed that completing a repeated correction (showing a second wording of the same habit) is not possible with text similarity alone: family purity 0.86, only 44% of the 90 repeats linked to their original. Capture already sends each new reply to a judge model; the same call could also be shown a few earlier corrections and say whether the new one repeats one of them.

Gate (offline, run before this plan was frozen, gate17.mjs): if the judge is shown the 5 most similar earlier corrections (TF-IDF on quote and on the request it was said about, summed), at least one member of the right family is among them for 73 of 90 repeats (0.81). That is the ceiling for any judge that sees 5 candidates; quote-only candidates give 0.80, request-only 0.38.

Design. 180 items from the frozen 240-record store (exp5/store3.json): the 90 repeat records (expected: repeats the family of one candidate) and 90 control records (the first 90, by id, of the 120 non-preference originals; expected: repeats none). For each item the judge (claude -p, haiku, no tools, plugin recall and capture switched off through a temp OTW_HOME) sees up to 5 candidates, numbered, and the new correction, and answers JSON {"same_as": number or null}. Prompt text is in run-exp17.mjs and is frozen with it (SHA-256 below). One call per item, one pass, no retries.

Measures: links made; precision = links to a member of the true family / links made; recall = repeats linked to a member of their own family / 90; false links on the 90 controls.

Pass criteria to go on (all must hold): precision >= 0.95, recall >= 0.65 (ceiling 0.81), false links on controls <= 3 of 90. If met: next step would be to apply the stored link in recall (family completion F2 with judge links, offline then model), which also costs one extra judge input at capture time. If not met: record it, do not build.
Cost and time: 180 haiku calls, about USD 0.2-0.4 and 15-20 minutes in the user's terminal. Limits: synthetic repeats written by a model; paraphrases are clean; the judge sees candidates chosen by the same similarity measure.
Known limit of the truth labels: two different preference ids can describe nearly the same habit (for example two "English comments" records under different ids). A judge link between them would be counted as wrong although it is arguably right, so precision is slightly understated.
