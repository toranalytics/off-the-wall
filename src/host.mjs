// One small-model call through the CLI the person already uses, so it runs on their own Claude or ChatGPT plan with
// no API key. OTW_CHILD=1 makes the child's own Off the Wall hooks do nothing.
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function run(cmd, args, input, timeoutMs) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { env: { ...process.env, OTW_CHILD: '1' }, stdio: ['pipe', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    const t = setTimeout(() => (p.kill('SIGTERM'), reject(new Error(`${cmd} timed out after ${timeoutMs} ms`))), timeoutMs)
    p.stdout.on('data', d => (out += d))
    p.stderr.on('data', d => (err += d))
    p.on('error', e => (clearTimeout(t), reject(e)))
    p.on('close', code => (clearTimeout(t), code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}: ${err.slice(-300)}`))))
    p.stdin.end(input ?? '')
  })
}

export async function complete(host, model, prompt, timeoutMs = 120_000, effort = 'low') {
  if (host === 'codex') {
    const dir = mkdtempSync(join(tmpdir(), 'otw-'))
    const outFile = join(dir, 'last.txt')
    try {
      await run('codex', ['exec', '--ephemeral', '--skip-git-repo-check', '-s', 'read-only', '-m', model, '-c', `model_reasoning_effort="${effort}"`, '-o', outFile, '-'], prompt, timeoutMs)
      return readFileSync(outFile, 'utf8')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }
  return run('claude', ['-p', '--model', model, '--tools', '', '--no-session-persistence', '--output-format', 'text', ...(effort && effort !== 'low' ? ['--effort', effort] : [])], prompt, timeoutMs)
}
