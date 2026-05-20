# Windows Codex-Hooks Smoke Runbook (i9-bootcamp)

Validates that ClaudeKit hooks **wire** and **fire** on real Windows after the
Codex-on-Windows unmask. The unit/integration suite mocks `process.platform`; this
runbook is the only check against a real Windows host.

## Prereqs (on i9-bootcamp)
- Node.js on PATH (`node --version`)
- GitHub CLI authenticated (`gh auth status`) — needed by `ck init` unless using `--kit-path`
- Codex CLI installed (`codex --version`) — for the runtime hook-fire step

## A. Post-merge (npm dev channel)
Once the PRs land on `dev` and `claudekit-cli@dev` publishes:
```powershell
powershell -File reset-i9bootcamp-test.ps1
```

## B. Pre-merge (branch build) — what we run before merging
On the dev host (macOS), build + package the branch artifacts and copy them over:
```bash
# CLI tarball
cd <cli-worktree> && bun run build && npm pack            # -> claudekit-cli-<v>.tgz
scp claudekit-cli-<v>.tgz i9-bootcamp:C:/tmp/cli.tgz

# Engineer kit (root contains claude/)
cd <eng-worktree> && tar -czf /tmp/eng-kit.tgz claude
scp /tmp/eng-kit.tgz i9-bootcamp:C:/tmp/eng-kit.tgz
```
On i9-bootcamp, expand the kit and run the harness against the local builds:
```powershell
mkdir C:\tmp\eng-kit -Force; tar -xzf C:\tmp\eng-kit.tgz -C C:\tmp\eng-kit
powershell -File reset-i9bootcamp-test.ps1 -CliTarball C:\tmp\cli.tgz -KitPath C:\tmp\eng-kit
```

## C. Wiring assertions (auto-printed by the script)
- **Claude hooks wired: 15** (kit canonical) + 2 CLI-injected (TaskCompleted, TeammateIdle) = **17** total. Every command begins with `node "`. No `node-hook-runner.sh`, no `skill-dedup`.
- **Codex hooks wired: ≥1** (subset surviving the converter's event/matcher filter for the detected Codex version).
- **config.toml hooks feature flag: True**.
- `~/.codex/hooks/` contains wrapper `.cjs` files.

## D. Runtime hook-fire check (MANUAL — the load-bearing step)
Wiring ≠ firing. Confirm Codex actually invokes a migrated hook:
1. `cd` to a scratch dir; start a Codex session.
2. Trigger an event a migrated hook listens on. The most observable is a `PreToolUse`/Bash
   hook (`scout-block` / `privacy-block`): ask Codex to run a shell command that touches a
   blocked path (e.g. read inside `node_modules`) and confirm the hook's block/decision fires.
   Alternatively trigger `descriptive-name` via a Write.
3. Confirm in Codex's output/notify channel that the hook ran (a decision, an injected
   context line, or a block). Capture the output.

### Pass / fail
- **PASS:** wiring assertions in C all hold AND at least one migrated hook is observed firing under Codex.
- **PARTIAL:** wiring holds but no hook observed firing → capture Codex version + stderr; likely an upstream Codex-on-Windows runtime issue (file upstream). Our wiring is still correct.
- **FAIL:** wiring assertions in C do not hold → regression in the CLI/kit; reopen.

## Cleanup / re-run
The script is idempotent — re-run it to reset. To leave the box in dev+beta state for
daily use, run option A (npm dev channel) after merge.
