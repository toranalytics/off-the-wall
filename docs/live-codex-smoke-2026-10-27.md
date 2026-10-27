# Off the Wall live Codex smoke record

Date: 2026-10-27 (KST). Scope: Codex only. Claude Code was NOT tested (its CLI was logged out on this machine).

## Environment
- macOS 26.6.2, Node v24.18.0, codex-cli 0.162.1 (ChatGPT login)
- Plugin: off-the-wall 0.2.0 from github.com/toranalytics/off-the-wall, marketplace commit 6a6019e (public main)
- Isolated CODEX_HOME and OTW_HOME in a temp folder, so no real config or history was touched. Synthetic prompts and files only.
- The sandbox printed websocket certificate errors and Codex fell back to HTTPS. This is an environment issue, unrelated to the plugin.

## Steps and results
1. Install: `codex plugin marketplace add toranalytics/off-the-wall`, then `codex plugin add off-the-wall@off-the-wall`. Both succeeded; installed root `.../plugins/cache/off-the-wall/off-the-wall/0.2.0`.
2. Before trusting the hooks, a real prompt ran (`codex exec`) and the model answered, but OTW_HOME stayed empty: the hooks did not run.
3. Interactive `codex` showed "Hooks need review: 5 hooks are new or changed" with "Trust all and continue". After choosing it, `config.toml` gained `[hooks.state."off-the-wall@off-the-wall:hooks/codex.json:<event>:0:0"]` entries with a `trusted_hash` for pre_tool_use, post_compact, session_start, user_prompt_submit and stop.
4. Turn A (`codex exec`): "Write a one-line shell command that counts the lines in every .txt file in this folder. Only give the command, do not run it." Answer: `wc -l ./*.txt`. Output showed "hook: Stop Completed". A session file was created under OTW_HOME/sessions.
5. Turn B (`codex exec resume --last`, correction): "You didn't actually run it. Run the command now and show me the real output." Output showed "hook: UserPromptSubmit Completed". About 12 seconds later the detached judge wrote one record to corrections.jsonl: host codex, src live, origin interactive-user, a project key, and the rule "Run requested commands and verify their actual output before reporting results." (the test sandbox blocked the command, which does not matter here).
6. `otw status`: corrections 1 (live 1, from history 0); scoped/origin-tagged 1; quarantined 0; recall on, capture on, routing on.
7. Turn C (`codex exec resume --last`, related request in the same folder): "Write a command that counts the words in every .txt file here, actually run it, and show me the real output." The stored rollout contains a developer message beginning `[off-the-wall] Prior corrections selected from this workspace (verbatim; relevance is not guaranteed):` followed by the quoted correction and the line that history is not permission to act.
8. `otw report` on the bundled example history, judged by Codex (gpt-6.1-sol): 20 candidate replies, 9 labelled as possible corrections; top kind "stopped or asked when it should have continued" (3x). Same shape as the README figure.

## Findings
- Hooks do not run until the user trusts them in Codex's hooks review. The README already says so; this confirms it.
- `otw report` ignores `codex exec` sessions on purpose (non-interactive sessions count as non-human), so it reported "No turn ends found" on the smoke sessions. Interactive history is needed for a personal report.
- With OTW_DEBUG=1, log.jsonl keeps short excerpts of the judged answer and reply. They are off by default.

## Not verified
- Claude Code (any version), Windows, Linux, long-running interactive sessions, subagent model guidance on Codex, and whether recall changes real behaviour or reduces corrections.
