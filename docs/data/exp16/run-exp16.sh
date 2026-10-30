#!/bin/bash
# Run in your own terminal. 99 headless Claude Code runs (haiku, 11 preference tasks x 3 wordings x 3 reps), about 25 minutes, roughly USD 0.5-1.
# Resumable: run it again to continue. Stops at once if the isolated Claude CLI is not logged in.
cd "$(dirname "$0")"
export CLAUDE_CONFIG_DIR=/Users/SJB/.aside/u/0/sessions/2026-10-22_0s8heOAE5qcpaKfV/tmp/claude-cli/config
CLI=/Users/SJB/.aside/u/0/sessions/2026-10-22_0s8heOAE5qcpaKfV/tmp/claude-cli/node_modules/.bin/claude
R=$("$CLI" -p "say hi in 3 words" --model haiku --output-format json 2>/dev/null)
case "$R" in *'"is_error":false'*) echo "login ok";; *) echo "STOP: not logged in in this terminal: $(echo "$R" | cut -c1-160)"; exit 1;; esac
node run-exp16.mjs --selftest | tail -1 || exit 1
node run-exp16.mjs --stage run
