# Side-by-side demo (illustration, not a measurement)

Three preference tasks from experiment 12 (c006 conventional commit, c136 no emojis, c124 no @mentions), the same request run twice with Claude Sonnet and the real plugin hooks: once with recall off, once on.

- One saved correction per task. The habit text comes from `exp4/prefs.json`; the "what I once asked" line is invented in `run-demo.mjs`.
- One run per condition. The first run is shown. Nothing was re-rolled or selected.
- `out/*.json` holds the raw answers, whether the plugin block was present in the session, the automatic habit check, cost and time.
- The image `assets/before-after-*.png` shows verbatim excerpts of those answers. It illustrates what the measured difference looks like in practice. The measured numbers are in `docs/preference-experiment-2026-10-28.md`.
- Run it again with `bash run-demo.sh` (needs the isolated Claude CLI login). Results will differ from run to run.
