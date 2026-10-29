# Experiment 8 (2026-10-29): fewer quotes on short, vague prompts

Status: plan, written before any variant is evaluated. Offline only, no model calls.

## Why
Experiment 7 follow-up (`exp7/short-input-guard.mjs`): prompts under 20 characters keep the 0.18 floor, which keeps acknowledgements quiet ("ok", "thanks": 0 quotes) but still attaches up to 6 quotes to vague short prompts ("why?", "fix it": 6). Goal: fewer quotes on vague short prompts without losing short prompts that really point at a stored correction.

## Method (same as experiment 7, borrowed from karpathy/autoresearch)
One frozen evaluator (`eval8.mjs`, SHA-256 in `FROZEN-SHA256.txt` written before any variant run), one editable variant file (`variants8.mjs`), a fixed variant list tried once, baseline V0 first, keep/discard by a rule written now, results logged here, simpler code wins at equal results. V0 must reproduce the real `pickCorrections` on every prompt or nothing is evaluated.

## Data (240-record repeat store of experiment 5; prompts written by the experimenter before running, after looking at the store)
- Specific short prompts (all under 20 characters), each with a target preference family (id or id-rN): `fix upload.js:88` c001; `coverage for auth` c002; `move scripts files` c003; `regex explanation` c004; `fix sort comparator` c007; `fix monthly sql` c008; `convert legacy.js` c009; `quick status page` c016; `style the card` c021; `add card styles` c021.
- Vague short prompts (any quote is noise): ok, yes, continue, yes do it, go ahead, thanks, looks good, why?, try again, do it, fix it.
- Not scored (could legitimately match): run the tests, commit it, now push it.
Limits written in advance: prompts are mine, 10 specific and 11 vague, one model-written store; the specific prompts were written knowing the store, so HIT is optimistic. Hit means the target family is shown, not that a model follows it.

## Metrics
HIT (of 10 specific prompts) and NOISE (mean quotes shown on the 11 vague prompts).

## Variants (apply only to prompts under 20 trimmed characters; longer prompts are unchanged; each tried once)
- V0: current main (floor 0.18).
- S1: floor 0.30.
- S2: floor 0.40.
- S3: 0.18 floor plus: share at least one whole word (3+ characters) with the stored request that appears in fewer than 30% of the stored requests.
- S4: 0.18 floor, at most 3 quotes.
- S5: floor 0.25 plus the S3 whole-word rule.

## Keep rule (fixed now)
Keep a variant only if HIT >= V0's HIT and NOISE <= 0.5 x V0's NOISE. Among kept, prefer the simplest. If none is kept, the guard stays as it is and that is the result. A kept variant needs a model-run check on short prompts before it can become a default; without that it can only be opt-in.

## Log
- Self-check passed (V0 reproduces `pickCorrections` on all prompts). Each variant evaluated once.

### Result
| | HIT (of 10) | NOISE (mean quotes, 11 vague prompts) | unscored mean (3 prompts) |
|---|---|---|---|
| V0 current | 10 | 1.82 | 4.67 |
| S1 floor 0.30 | 7 | 0.36 | 1.33 |
| S2 floor 0.40 | 6 | 0.00 | 0.33 |
| S3 whole-word anchor | 10 | 1.36 | 4.67 |
| S4 cap 3 | 10 | 1.27 | 3.00 |
| S5 0.25 + anchor | 9 | 1.18 | 2.67 |
Keep rule (HIT >= 10 and NOISE <= 0.91): no variant passes. The variants that remove most noise (S1, S2) lose 3 to 4 of the 10 specific short prompts; the ones that keep all hits (S3, S4) only trim noise by 25 to 30 percent.

### Conclusion
The short-prompt guard stays as it is. Its cost is already small on this set (mean 1.82 quotes on vague short prompts; acknowledgements get none), and every attempt to cut the rest also cut quotes that pointed at a real stored correction. Short commands that contain real words ("run the tests", "commit it", "now push it": mean 4.67 quotes) are plausibly about stored corrections, so they were not scored and not changed. Limits: 21 prompts written by the experimenter with the store in view, one model-written store, offline only, so this says nothing about how a model behaves with those quotes. No code change.
