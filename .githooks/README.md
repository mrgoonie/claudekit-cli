# Git Hooks

Local quality gate enforcement. Matches upstream CI checks so nothing broken reaches the remote.

## Installation

Hooks auto-install on `bun install` (via `prepare` script). Manual install:

```bash
bun run install:hooks
```

Works in both normal repos and worktrees (uses `core.hooksPath` with absolute path).

## Hooks

| Hook | Checks | When |
|------|--------|------|
| `pre-commit` | typecheck + lint:fix + build | Before every commit |
| `pre-push` | typecheck + lint + build + test | Before every push |

## Bypassing

**AI agents: NEVER use `--no-verify`.** The hooks exist because AI-generated code repeatedly failed CI, causing 3-6 fix-up commits per PR. Fix the code, don't skip the gate.

Human bypass (emergencies only):

```bash
SKIP_HOOKS=true git commit -m "..."
SKIP_HOOKS=true git push
```
