# 0.2.0 safety candidate: verification and limits

Status: **unreleased safety candidate, source submitted for review**. The local checks below were performed on 2026-10-25 KST against public baseline
`060488b74c5f0a4883ecf1ee07b094a01cf00f0b`. At that local-verification checkpoint there had been no repository push, release, package publication,
account switch, external reply, or change to installed local GJC/OTW modules. Source publication for
review does not turn these synthetic results into live-product validation. Current CI status is
reported by GitHub Actions; the local checkpoint below is not a claim about later CI runs.

## Before/after evidence

The initial 10 synthetic safety checks had 9 failures on the original public source, then all passed
after the fix. The final 12-check safety file was also rerun against a pristine baseline copy:
11 failed, 1 passed. All 12 pass in this candidate. This is a regression demonstration, not a
measured occurrence rate in real user traffic.

## Local checks at the 2026-10-25 checkpoint

- **96/96 tests pass** on macOS on each of Node **18.20.8, 20.20.2, 22.23.4 and 26.5.0**.
  These are the same cases repeated for compatibility, not 384 independent behavioral cases.
- `npm test` discovers all six test files, rather than only the original core test.
- Both configured POSIX hook commands were executed through plugin-root symlinks containing spaces.
- Hook stdin/stdout, detached worker, CLI argument/output-file handling, persistence and same-cwd
  recall were checked with fake `claude`/`codex` executables. Their test PATH excludes real user
  CLIs; child calls carry `OTW_CHILD=1`. No live model/provider call was made.
- Regression coverage includes source/cwd transitions, automation context latches, compaction,
  rejected assistant continuations, nested provenance, unknown/malformed/oversized history,
  missing scope, unknown origin, and legacy pending answers. Automated live sessions remain
  excluded across resume/compact lifecycle events.
- Seeding preserves legacy data, can append a scoped copy when explicit source cwd exists,
  deduplicates reseeding, and leaves unknown-cwd results report-only. Reads tolerate invalid
  stored shapes without rewriting or deleting source data.
- Bundled synthetic history still yields 20 candidate exchanges; missing cwd is not guessed.
- Capture disabled: new pending prompt/answer excerpts are cleared. Default error logging omits
  raw input. `OTW_DEBUG` can retain excerpts and is documented.
- Independent read-only review identified five concrete boundary groups. The fixes and regression
  assertions were rechecked; no concrete remaining issue was found within those five groups.
- Four-language README wording and internal anchors were checked. SVG figures explicitly label
  archived/synthetic classifications, historical combined treatments, and evidence limits.
- Deterministic banner SVGs and PNGs remove guaranteed-savings/repeated-correction claims. PNGs
  use a portable WASM renderer and an explicitly provided public DejaVu font in a development
  folder, not protected system fonts or a native add-on. No image generation service was used.

## Deliberate limits

- No private conversation history or credentials were used. Development runtimes/rendering
  tools are not plugin runtime dependencies. No current live app reload was attempted.
- This candidate was not loaded into a live Claude Code or Codex session. Synthetic launcher
  checks do not verify every host payload variant, app reload behavior, or long-running behavior.
- The GitHub CI matrix targets Node 18/20/22 on three OSes but has not run for this unpushed
  candidate. No new Windows/Linux live-session or CI success is claimed. POSIX fake-provider
  detached-process tests are skipped on Windows.
- Scope is normalized cwd, not repository-root detection: subdirectories, moved paths and
  worktrees are separate. Missing/unreadable provenance fails closed, losing some valid recall.
- Unknown ordinary prose is not authenticated as human-written. The lexical 0.18 guard is an
  initial engineering setting, not calibrated precision or an effect estimate.
- There is no memory-management UI/per-record deletion command. Legacy records are retained,
  not silently migrated or deleted. History is not permission for future actions.
- Historical 39-request results used one user's selected text, model grading, and a combined
  quote-plus-objection-prediction treatment. Neither this selector nor this wording was tested
  there. No live benefit, general cost reduction or independent replication is established.

## Reproduce without private history/provider calls

```sh
npm test
node scripts/make-assets.mjs
node scripts/make-banners.mjs
# Optional PNG development rendering, using an explicit portable tool and public font:
node scripts/render-banners.mjs /path/to/@resvg/resvg-wasm /path/to/DejaVuSans.ttf
```

Do not substitute `otw report` on real history without reviewing provider processing and usage
implications. A tagged stable release, package publication, or claim of live benefit requires a separate decision.

## Publication follow-up: 2026-10-26

PR #4 publishes the candidate source for review. The first cross-platform CI run exposed a Windows-only
fixture-path bug: URL.pathname is not a Windows filesystem path. The fixture now uses Node
`fileURLToPath`; no assertion or behavioral guard was weakened. Current CI results are tracked on
PR #4. This CI work does not validate live-host sessions or user effects.
