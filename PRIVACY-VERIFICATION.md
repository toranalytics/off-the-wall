# Local privacy candidate: 0.2.1

Verified locally on 2026-10-26 KST. This is an unpublished working-tree candidate, not a stable release, installed-plugin update or effectiveness result.

## Baseline and scope

- Base: toranalytics/off-the-wall main at `6a6019edfe0326910c93ec0b5e290a2dd2293a9a`. Its code matches the earlier audited `8ff8e6d`; intervening changes were four README listing additions.
- Fix priorities: invalid settings silently enabling capture, queued/in-flight results repopulating disabled or deleted storage. Also guard report seeding and detached launch logs, because they share these boundaries.
- No push, PR, release, tag, npm publish, account switch, installed GJC/Speech change or host reload was performed. Package/host manifests say unreleased 0.2.1; the existing marketplace 0.1.1 entry is intentionally untouched pending a separate release decision.
- All new tests use synthetic messages and isolated local fixtures. Process tests run the actual hook script -> detached Node worker -> fake Claude/Codex executable, NOT actual host apps, model services, CLI tools or MCP.

## Red/green evidence

- Initial privacy suite: 13 tests on baseline, 2 passed / 11 failed. The same behaviors pass after fixes.
- Independent static review found three further gaps: queued seed batches after revocation, missing-config revision returning to `absent`, and unguarded asynchronous launch-error logs.
- Additional queued/running missing-config and multi-batch regressions reproduced three failures before follow-up fixes. Fault-injected launch-error tests cover the logging path.
- Independent read-only re-review found these three resolved within the stated authorization model. It did not independently execute the test suite or certify the whole product.
- Final local suite: 184/184, zero failures/skips on macOS, separately under Node 18.20.8, 20.20.2, 22.23.4 and 26.5.0. Logs are bundled under verification/.
- Package dry-run includes the config module and excludes runtime caches, live config, correction files and generation files. No package was published.

## Safety boundary

Existing invalid config disables recall, capture and routing. Missing config keeps normal defaults. One UTF-8 BOM is accepted; unknown keys, non-booleans and invalid nested values are rejected. Status exposes a fixed sanitized issue code.

Foreground capture/seed initializes a generation and target files. Jobs bind that generation, root/correction identities and config revision. Default-config jobs also bind the root directory timestamp revision after initialization. This detects a create-opt-out/remove-config sequence on supported filesystems and may conservatively drop jobs after unrelated root-entry changes.

Authorization is checked before provider dispatch and before appending. Detached writes open existing targets without O_CREAT or mkdir. If deletion occurs after the final check/open, writes can only reach an unlinked old fd, not a new pathname/generation. Fault injection tests this exact interleaving. Detached launch-error/debug logs use the same guard.

A seed report checks each not-yet-dispatched batch, shares revocation across runners, marks partial reports and refuses late seeding. Non-seeding reports remain explicit provider-processing actions even with capture off. Invalid config stops both kinds before history/provider processing.

New POSIX files/directories request 0600/0700. Session replacement uses a temporary file and rename; reads and late missing-session Stop events do not initialize deleted storage.

## Limits and remaining work

- Already-dispatched provider calls may finish and consume usage. Already-sent text cannot be retracted. Authorization linearizes at checks, not at every wall-clock instant of arbitrary external edits.
- Metadata/timestamp sensitivity depends on filesystem precision. There is no persistent observer of every transient filesystem operation.
- In-place editing/truncating correction contents is NOT a revocation command. Delete the correction file or entire store for this behavior. A fresh foreground action may initialize new storage; older results cannot enter it.
- Existing permissions are not globally migrated. Actual accessibility depends on ancestor permissions and OS ACLs. New POSIX modes do not establish Windows ACL guarantees.
- Atomic session replacement reduces partial-write exposure but does not recover corrupted nonhuman provenance, prove crash/power-loss durability, or serialize all concurrent hooks. Corrupt-session quarantine remains a follow-up.
- Native child-CLI project/tool/MCP context isolation remains unverified/unfixed. Fake CLI tests are not evidence of native provider/tool sandboxing.
- No exactly-once retry deduplication, per-memory UI, clear/pause command, live-host reload, Linux/Windows runtime execution, fresh remote CI, user-efficacy or savings evidence. POSIX shim/open-fd tests explicitly skip Windows.

## Reproduce

Extract source/ and run `node --test` from that folder with Node >=18. No npm dependencies or real providers are required. Prefer an empty HOME, CODEX_HOME and CLAUDE_CONFIG_DIR when rerunning; test fixtures override their own storage and provider paths. The supplied run-tests.sh sets an isolated profile for this purpose.

The separate candidate.patch applies to the stated base with `git apply --check` then `git apply`. It includes no private conversation, real config, credentials, tokens or test-generated storage.
