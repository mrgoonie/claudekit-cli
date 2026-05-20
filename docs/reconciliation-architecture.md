# Reconciliation Architecture

## Purpose

`ck migrate` now runs as a deterministic 3-phase pipeline:

1. `RECONCILE`: pure planning (no writes)
2. `EXECUTE`: apply plan with conflict policies
3. `REPORT`: summarize installs/updates/skips/failures

This doc is the high-level architecture reference for the idempotent migration system added in PR #413.

## End-to-End Flow

```mermaid
flowchart TD
    A[CLI or Dashboard Request] --> B[Discover Source Items]
    A --> C[Read Portable Registry v3]
    A --> D[Scan Target State]
    A --> E[Load Portable Manifest]

    B --> F[RECONCILE Pure Function]
    C --> F
    D --> F
    E --> F

    F --> G[Plan: install/update/skip/conflict/delete]
    G --> H{Execute?}
    H -- No --> I[Report Plan Only]
    H -- Yes --> J[EXECUTE Write Strategy]

    J --> K[Per-file / merge-single / yaml-merge / json-merge / codex-toml]
    K --> L[Registry Update]
    L --> M[REPORT Final Counts + Warnings]
```

## Phase Contracts

### RECONCILE

- Input:
  - Source portable items
  - Registry entries (`portable-registry.json` v3)
  - Current target checksums/state
  - Optional manifest migrations/renames
- Output:
  - `ReconcilePlan` with action list + summary + conflict flag
- Guarantees:
  - no I/O side effects
  - deterministic for identical inputs

### EXECUTE

- Applies selected actions with provider strategy-aware installers.
- Codex agents use `codex-toml` strategy:
  - writes per-agent `.codex/agents/<slug>.toml`
  - merges `[agents.*]` block into `.codex/config.toml` with CK sentinels
  - serializes writes with a per-target lock to prevent concurrent merge races
- Codex commands migrate as Codex skills, matching current upstream Codex external command import behavior. Project-scope command migrations write `.agents/skills/source-command-*/SKILL.md`; `--global` writes `~/.agents/skills/source-command-*/SKILL.md`.
- Conflict resolution policy:
  - interactive CLI: prompt (`overwrite`, `keep`, `show-diff`)
  - non-interactive: safe default is `keep`
- Atomicity safeguards:
  - file snapshots before writes
  - rollback on registry write failure
  - skill directory backup/restore on failure

### REPORT

- Emits summary counts:
  - `installed`, `skipped`, `failed`
- Includes warnings and per-provider results for CLI + dashboard.
- CLI summary output now includes destination-aware preflight rows plus a boxed WHERE / WHAT / NEXT footer so the target path stays visible before confirmation.

## Codex Hook Compatibility

Codex hook migration is a compatibility subset of Claude Code hooks:

- Supported Codex events are `SessionStart`, `PreToolUse`, `PermissionRequest`, `PostToolUse`, `UserPromptSubmit`, and `Stop`.
- Unsupported CKM events such as `SubagentStart`, `PreCompact`, and `SessionEnd` are skipped with structured warnings.
- Claude-specific or deprecated hooks are not copied or registered: `usage-context-awareness`, `usage-quota-cache-refresh`, `team-context-inject`, and `teammate-idle-handler`.
- Wrapper commands such as `bash .claude/hooks/node-hook-runner.sh .claude/hooks/scout-block.cjs` are matched against the wrapped hook asset, not only the runner script.
- Hook script contents and registered commands are normalized to `.codex/hooks` or `~/.codex/hooks` when targeting Codex.
- Repeated migrations prune CK-owned unsupported or excluded entries from `.codex/hooks.json`, while preserving user-authored hook commands outside CK-managed Codex hook paths.

## Core Components

- `src/commands/portable/reconciler.ts`: pure decision engine
- `src/commands/portable/portable-registry.ts`: registry v3 + migration + locking
- `src/commands/portable/portable-manifest.ts`: renames/path migrations evolution model
- `src/commands/portable/portable-installer.ts`: execution strategies + rollback
- `src/commands/portable/codex-toml-installer.ts`: Codex TOML writer + sentinel merge
- `src/commands/portable/hook-migration-compatibility.ts`: Codex hook event/filter/path compatibility helpers
- `src/commands/migrate/skill-directory-installer.ts`: directory install + rollback
- `src/domains/web-server/routes/migration-routes.ts`: dashboard API entrypoints

## Decision Matrix (High-Level)

For each `(provider,type,item)` tuple, reconciler classifies:

- New source item not in registry -> `install`
- Source unchanged + target unchanged -> `skip`
- Source changed + target unchanged -> `update`
- Source unchanged + target changed by user -> `skip` (preserve user)
- Source changed + target changed -> `conflict`
- Target missing + source changed -> `install` (recreate)
- Target missing + source unchanged -> `skip`
- Registry orphan not in source (non-skill) -> `delete`

## Security + Safety Notes

- SHA-256 checksums for source/target drift.
- Path traversal hardening on manifest and installer paths.
- Canonical-path boundary validation for Codex TOML target directories.
- ANSI/control-code sanitization for diff and plan displays.
- Registry locking for concurrent safety.
- Codex config merge locking + malformed sentinel detection to fail safe.
- Rollback on write-before-registry failure paths.

## Known Limitations and Follow-Ups

- Plan execution endpoint may be disabled in some builds (returns `501`) and is surfaced in UI during review/execute.
- Skill orphan cleanup is intentionally conservative because skills are directory-based and not mapped 1:1 with source item files.
- File checksuming is read-all-at-once today; streaming hash for very large files can be a future optimization.
