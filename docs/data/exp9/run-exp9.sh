#!/bin/bash
# Run in your own terminal (needs network once for npm and the ~23 MB model). Installs only into docs/data/exp9/.work (git-ignored).
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$HERE/.work" && cd "$HERE/.work"
[ -f package.json ] || npm init -y >/dev/null
npm install --no-audit --no-fund @huggingface/transformers
cd "$HERE"
node eval9.mjs 2>&1 | tee "$HERE/exp9-output.txt"
