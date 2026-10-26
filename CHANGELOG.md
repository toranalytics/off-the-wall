# Changelog

## 0.2.0 - Unreleased

- **Safety behavior change:** recall requires an explicit normalized working-directory key and a known input-origin tag. Legacy records remain on disk but are not automatically recalled. No silent migration or deletion. Subdirectories, moves and worktrees are separate scopes.
- Remove latest-correction padding. Return up to six distinct above-threshold lexical matches in the current working directory; singleton/exact matches work. The guard is not a calibrated accuracy or user-effect estimate.
- Reject explicit machine/meta origins and known automation envelopes; preserve ordinary Markdown, paths and long English. Unknown prose is not proof of human origin. Ignore automated answers and unscoped legacy pending sessions for capture.
- Disabling capture clears new pending prompt/answer excerpts, without erasing existing corrections or host histories. New worker jobs must carry scoped input provenance.
- History parsers carry explicit cwd provenance. Reseeding can append a scoped copy of an old unscoped correction; unknown-cwd results remain report-only. Status distinguishes scoped/origin-tagged records from quarantined records.
- Mark reports and share-link counts as model-labelled candidates. Clarify provider processing, recalled context, debug logs and deletion limits, and narrow historical replay/cost claims in all four READMEs.
- No new memory-management UI, guaranteed model routing/cost savings, live efficacy evidence, or public deployment is included in this unreleased candidate.

## 0.1.1 - 2026-10-20

- Renamed to Off the Wall: plugin `off-the-wall`, CLI `bin/otw.mjs`, data in `~/.otw` (`OTW_HOME`). 0.1.0 kept its
  data in `~/.ownwords`; to keep your corrections, move it once: `mv ~/.ownwords ~/.otw`.
- Plugin manifests carry homepage, repository, license and keywords; the Codex manifest fills its publishable fields.
- `otw report` ends with a link to a prefilled Show and tell discussion carrying your top three kinds and their
  counts (no quoted words), so results can be compared across users.

## 0.1.0 - 2026-10-16

- Quotes up to 6 of your past corrections (most similar first, then latest) before each answer, on Claude Code and Codex.
- Judges each new message against the previous answer in a detached process and saves corrections.
- `otw report`: what you corrected most in your local history, with `--seed` to start recall from it.
- Subagent routing: the orchestrator names a model per subagent; an unnamed call is sent back once per turn.
- Codex models detected per account from Codex's own model list.
