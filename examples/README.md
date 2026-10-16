# Example history

`claude-history/demo-project/demo-session.jsonl` is a made-up Claude Code session: 20 replies, 9 of which correct
how the agent worked. Try the report on it:

```sh
node bin/otw.mjs report --host claude --claude-dir examples/claude-history --days 0
```
