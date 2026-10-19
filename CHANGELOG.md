# Changelog

## Unreleased

- `otw report` ends with a link to a prefilled Show and tell discussion carrying your top three kinds and their
  counts (no quoted words), so results can be compared across users.

## 0.1.0 - 2026-10-16

- Quotes up to 6 of your past corrections (most similar first, then latest) before each answer, on Claude Code and Codex.
- Judges each new message against the previous answer in a detached process and saves corrections.
- `otw report`: what you corrected most in your local history, with `--seed` to start recall from it.
- Subagent routing: the orchestrator names a model per subagent; an unnamed call is sent back once per turn.
- Codex models detected per account from Codex's own model list.
