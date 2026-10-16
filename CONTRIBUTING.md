# Contributing

Thanks for helping. This guide is short on purpose.

## Setup

No dependencies. Node 18 or newer.

```sh
npm test
```

To run the plugin from your checkout:

```sh
claude --plugin-dir .                       # Claude Code
codex plugin marketplace add "$PWD"         # Codex, then: codex plugin add off-the-wall@off-the-wall
```

`OTW_HOME=/tmp/ow` keeps your test runs away from your real `~/.otw`, and `OTW_DEBUG=1` logs every
hook event to its `log.jsonl`.

## What a change needs

- A test for the behaviour. For a new check, also run it once against broken input and show that it catches it.
- Claims in the README come with how they were measured. If a change moves a number or an output shown in an
  image, redraw the images with `node scripts/make-assets.mjs`.
- No personal data in code, tests or examples. The example history in `examples/` is made up; keep it that way.
- One hook program serves both hosts (`src/hook.mjs claude|codex`). Keep host differences in `src/policy.mjs`,
  `src/host.mjs` and `src/transcripts.mjs`.

## Changelog

Add a line under "Unreleased" in [CHANGELOG.md](CHANGELOG.md).
