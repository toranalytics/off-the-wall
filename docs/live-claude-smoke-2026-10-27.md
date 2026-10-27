# Live Claude Code smoke record (2026-10-27, macOS)

Scope: one headless (`claude -p`) run on one machine. Synthetic prompts only. Not an effectiveness, cost or reliability result.

- Host: Claude Code 2.1.311, installed in a temporary folder with its own `CLAUDE_CONFIG_DIR`; separate `OTW_HOME`.
- Plugin: off-the-wall 0.2.1 installed from the public marketplace (`claude plugin marketplace add toranalytics/off-the-wall`, `claude plugin install off-the-wall@off-the-wall`), status enabled.
- Model: haiku, no tools.

## What was run
1. Turn 1: a synthetic request ("write a one-line shell command that counts the lines in every .txt file in this folder").
2. Turn 2 (`--continue`): a synthetic correction ("You never ran it. Run the command now and show me the real output, not a guess.").
3. After 45 s, turn 3 in a new session in the same folder, with an unrelated synthetic request.

## What was observed
- Capture: after turn 2, `corrections.jsonl` held 1 record, origin `interactive-user`, with a workspace key. The background judge ran once (1 log entry).
- Recall: in the turn-3 session transcript, a `UserPromptSubmit` hook context starting with `[off-the-wall] Prior corrections selected from this workspace (verbatim...` contained that turn-2 correction (543 characters). A `SessionStart` context with the subagent-routing text (1,228 characters) was also present.
- Routing text count was the same in the continued session (turns 1-2) as in the single-turn session; no duplicate injection was seen with `--continue` in this run.

## Not verified
- Turn 3's model response did not return within 4 minutes (the output file stayed empty), so whether the model followed the recalled correction is unknown. The cause of the stall was not investigated.
- `otw report` and `otw status` were not run on this host. The interactive terminal UI, `/hooks`, compaction and resume were not tested.
- Only 0.2.1 was tested, not 0.2.2.
