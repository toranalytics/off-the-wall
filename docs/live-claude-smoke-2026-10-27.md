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
- Turn 3 was not a stall: the model produced about 128k output tokens of malformed tool-call text over 6 minutes (cost $0.17, versus about $0.002 for turns 1 and 2). That run had tools disabled (`--tools ""`) while the recalled correction said to run the command. The cause is not established; see the follow-up below.
- `otw report` and `otw status` were not run on this host. The interactive terminal UI, `/hooks`, compaction and resume were not tested.
- Only 0.2.1 was tested, not 0.2.2.

## Follow-up A/B (same day, same machine)
Same request as turn 3, a fresh session each time, the stored correction present, a hard cap of USD 0.05 per run, haiku. "recall on" is the default; "recall off" sets `{"recall":false,"routing":false}` in OTW_HOME. Two runs per cell.

| tools | recall | out tokens | cost (USD) | response in short |
|---|---|---|---|---|
| none | on | 267 | 0.0003 | emitted a pseudo tool-call (`<invoke_tool name="Bash">...`) instead of a plain answer |
| none | on | 1,902 | 0.0010 | said it could not run the command on real files |
| none | off | 539 | 0.0004 | gave `wc -w *.txt` with an explanation |
| none | off | 477 | 0.0003 | gave a `find ... -exec wc -w` one-liner with an explanation |
| Bash(wc,find), dontAsk | on | 736 | 0.0014 | could not run (Bash denied), gave the command |
| Bash(wc,find), dontAsk | on | 713 | 0.0013 | gave `wc -w *.txt` and said it ran it |
| Bash(wc,find), dontAsk | off | 540 | 0.0012 | gave `wc -w *.txt` and said it ran it |
| Bash(wc,find), dontAsk | off | 768 | 0.0014 | could not run (Bash denied), gave the command |

- The 128k-token runaway did not recur in these 8 runs (maximum 1,902 tokens). One-off cause unknown.
- With tools disabled, both recall-on responses were about running a command, while both recall-off responses simply answered; with a Bash tool allowed there was no visible difference. Two runs per cell is far too few to call this an effect; it is a hint to check, not a result.
- No change to the plugin was made on the basis of this. Whether a recalled "run it" correction should be offered for a request that does not need execution is an open design question.
