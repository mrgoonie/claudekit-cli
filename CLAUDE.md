# ClaudeKit CLI

## 🎯 Core Mission

**This CLI is the front door to ClaudeKit.** Every command, prompt, and message serves one purpose: **empower users to understand and adopt the CK stack.**

### The Two Imperatives

1. **Educate** — Users must understand what ClaudeKit is, what each kit offers, and why it matters to their workflow. No blind installation. Informed adoption.

2. **Install** — Zero friction from discovery to working setup. Whether Engineer, Marketing, or both — the path must be clear, fast, and successful.

### Design Philosophy

- **Show, don't tell** — Feature previews over marketing copy
- **Guide, don't gatekeep** — Sensible defaults, optional depth
- **Succeed, don't abandon** — Every install ends with working config + clear next steps
- **Respect time** — Fast paths for experts, guided paths for newcomers

### The Kits

| Kit | Purpose | Audience |
|-----|---------|----------|
| **Engineer** | AI-powered coding: skills, hooks, multi-agent workflows | Developers building with Claude |
| **Marketing** | Content automation: campaigns, social, analytics | Marketers leveraging AI |

Both kits share the ClaudeKit foundation. Users can install one or both.

---

CLI tool (`ck`) for bootstrapping/updating ClaudeKit projects from GitHub releases.

## 🎯 Core Principle

**User experience is paramount.** The CLI is users' first touchpoint with ClaudeKit. Prioritize clarity over cleverness: intuitive commands, helpful errors, minimal friction from install to daily use.

---

## CRITICAL: Quality Gate

**MUST pass before ANY commit/PR. No exceptions.**

```bash
bun run ci:local
```

`bun run ci:local` is the **single source of truth** for what passing CI means. It runs the exact same 7 steps as the `Test` job in `.github/workflows/ci.yml`, in the same order, with the same env vars. If `ci:local` passes, the CI `Test` job will pass — modulo network/env quirks.

The pre-push git hook calls into the same script, so hook ↔ CI parity can never silently drift. **AI sessions MUST run `bun run ci:local` before pushing.**

### What `ci:local` checks (mirrors CI `Test` job)

| # | Step | Catches |
|---|------|---------|
| 1 | `typecheck` (`tsc --noEmit`) | Type errors |
| 2 | `lint` (`biome check`) | Style + auto-fixable issues |
| 3 | `build` (`bun build src/index.ts`) | Bundle errors |
| 4 | `test` (`bun test`) | Unit/integration test failures |
| 5 | **`help:check-parity` + `manifest:generate` + `docs:generate` drift check** | Stale `cli-manifest.json` / `docs/cli-reference.md` |
| 6 | `ui:build` (`tsc -b` + vite) | UI type errors stricter than `tsc --noEmit` (unused vars, ES lib methods like `Array.at()`) |
| 7 | `prepublish-check` (`node scripts/prepublish-check.js`) | Packaged CLI shape |

### Common upstream drift class (self-heal)

| Symptom (CI error) | Cause | One-liner self-heal |
|---|---|---|
| `cli-manifest.json or docs/cli-reference.md is stale` | Release commit on `main` bumped `package.json` but skipped regenerating the manifest/docs (step 5 above) | `bun run manifest:generate && bun run docs:generate && git add cli-manifest.json docs/cli-reference.md && git commit -m "chore: regenerate cli-manifest and docs"` — MUST use `chore:` (never `fix:`/`hotfix:`) so this commit does NOT trigger a release |
| `[X] CAC <-> HELP_REGISTRY parity check failed` | Added a command or flag without updating the help registry | Update the relevant entry in the help-command source, rerun `bun run help:check-parity` |
| `tsc -b` errors only in `ui:build`, not `typecheck` | UI tsconfig is stricter (unused vars, ES lib methods) | Run `bun run ui:build` from the repo root, fix the errors |
| `Prepublish check failed` | `package.json` `files`/`bin` arrays missing a path | Audit `package.json` `files` against `bin/`, `dist/`, `cli-manifest.json` |

Use `chore:` (NOT `hotfix:` or `fix:`) for the manifest-regen commit — version-sync commits must NOT trigger releases.

**Note:** Step 5 always regenerates `cli-manifest.json` / `docs/cli-reference.md`, which updates the `generatedAt` timestamp every run. After a passing `ci:local`, **timestamp-only diffs on those two files are safe to ignore or `git checkout`** — the drift check explicitly excludes `generatedAt` / `<!-- generated:` lines.

### `validate` vs `ci:local`

| Command | Use for | Includes |
|---|---|---|
| `bun run validate` | Fast inner-loop dev check | typecheck + lint + bun test + ui:test + build |
| `bun run ci:local` | **Pre-push / pre-PR / mirror CI exactly** | typecheck + lint + build + bun test + **help-parity drift** + **ui:build** + **prepublish-check** |

`validate` is FASTER but does NOT catch the parity-drift class. **Use `ci:local` before pushing.**

### Other CI workflows (not gated by `ci:local`)

| Workflow | Trigger | What it does |
|---|---|---|
| `CI / Metadata Deletions Check` | every PR | `scripts/check-metadata-deletions.js` — guards command-archive deletions metadata |
| `CI / Release Dry-Run Check` | PRs touching release-related files only | semantic-release dry-run; auto-skipped otherwise |
| `release.yml` / `release-dev.yml` | merge to `main` / `dev` | semantic-release publishes npm package |
| `sync-dev-after-release.yml` | post-release on `main` | opens `chore: merge main into dev` PR |

`ci:local` does NOT mirror `Metadata Deletions Check` or `Release Dry-Run Check` (both require git-history context and rarely fail). If you're touching release config or deletions metadata, also run the matching script manually: `node scripts/check-metadata-deletions.js` or `node scripts/check-release-dry-run.js`.

### Pre-push hook (auto-installed)

`pre-push` calls `scripts/ci-local.sh`, then adds `bun run ui:test` (vitest suite that CI's Test job does NOT run). Hooks auto-install on `bun install`; if missing run `bun run install:hooks`. The hook works in both normal repos and worktrees.

**AI agents: NEVER use `--no-verify` to bypass hooks. NEVER set `SKIP_HOOKS=true`.** If the hook rejects, fix the code — do not skip the gate. This rule is NON-NEGOTIABLE.

**Human bypass (emergencies only):** `SKIP_HOOKS=true git push`.

**Why:** AI-generated code historically failed CI in 80%+ of PRs, causing 3-6 fix-up commits each. The hooks exist to catch these failures locally before they waste CI cycles and pollute git history.

### Common pitfalls

- Web server deps (`express`, `ws`, `chokidar`, `get-port`, `open`) must be in `package.json` — not just transitive
- UI component files must pass biome formatting (long JSX lines auto-wrapped)
- Express 5 types `req.params`/`req.query` as `string | string[]` — cast with `String()`
- Don't `git pull` from `main` into a feature branch — use `git merge origin/main` and resolve with `git checkout --ours CHANGELOG.md package.json` (see Release Workflow below)

## Quick Commands

```bash
# Development
bun install                    # Install deps
bun run dev new --kit engineer # Run locally
bun test                       # Run tests
bun run lint:fix               # Auto-fix lint
bun run typecheck              # Type check
bun run build                  # Build for npm
bun run dashboard:dev          # Start config UI dashboard

# Testing
bun test <file>                # Single file
bun test --watch               # Watch mode
```

## Dashboard Development (Config UI)

```bash
bun run dashboard:dev     # Start dashboard (Express+Vite on :3456)
```

- **Single port:** http://localhost:3456 (auto-fallback 3456-3460)
- Backend API + Vite HMR served together
- **DO NOT** use `cd src/ui && bun dev` alone — no API backend, everything breaks
- Source: `src/commands/config/config-ui-command.ts` → `src/domains/web-server/`

## Project Structure

```
src/
├── index.ts          # CLI entry (cac framework)
├── commands/         # CLI commands (new, init, doctor, uninstall, version, update-cli, migrate)
├── types/            # Domain-specific types & Zod schemas
│   ├── index.ts      # Re-exports all types
│   ├── commands.ts   # Command option schemas
│   ├── kit.ts        # Kit types & constants
│   ├── metadata.ts   # Metadata schemas
│   └── ...           # Other domain types
├── domains/          # Business logic by domain
│   ├── config/       # Config management
│   ├── github/       # GitHub client, auth, npm registry
│   ├── health-checks/# Doctor command checkers
│   ├── help/         # Help system & banner
│   ├── installation/ # Download, merge, setup
│   ├── migration/    # Legacy migrations
│   ├── skills/       # Skills management
│   ├── ui/           # Prompts & ownership display
│   └── versioning/   # Version checking & releases
├── services/         # Cross-domain services
│   ├── file-operations/  # File scanning, manifest, ownership
│   ├── package-installer/ # Package installation logic
│   └── transformers/     # Path transformations
├── shared/           # Pure utilities (no domain logic)
│   ├── logger.ts
│   ├── environment.ts
│   ├── path-resolver.ts
│   ├── safe-prompts.ts
│   ├── safe-spinner.ts
│   └── terminal-utils.ts
└── __tests__/        # Unit tests mirror src/ structure
tests/                # Additional test suites
```

## Key Patterns

- **CLI Framework**: `cac` for argument parsing
- **Interactive Prompts**: `@clack/prompts`
- **Logging**: `shared/logger.ts` for verbose debug output
- **Cross-platform paths**: `services/transformers/global-path-transformer.ts`
- **Domain-Driven**: Business logic grouped by domain in `domains/`
- **Path Aliases**: `@/` maps to `src/` for cleaner imports

## Quality Gate Rules

### Path Safety (MANDATORY)
All file paths MUST use `path.join()`, `path.resolve()`, or `path.normalize()` — never concatenate with string `+` or template literals. Quote all paths in shell commands with double quotes. Test with spaces in directory names before committing path-handling code.

**Watch files:** `settings-processor.ts`, `global-path-transformer.ts`, `command-normalizer.ts`, `process-lock.ts`

### Release Config Freeze
NEVER modify `.releaserc.js`, `release*.yml`, or `scripts/*build*` without running `bun run build && npm pack --dry-run` to verify package contents. Dev and main release configs MUST stay functionally equivalent — if you change one, verify the other. Always run `npx semantic-release --dry-run` on release config PRs.

### Migration Test Requirement
Changes to `migrate-command.ts`, `provider-registry.ts`, or `reconciler.ts` MUST include a fixture-based integration test covering the new provider/state path. Test both fresh-install and upgrade-from-previous-version scenarios.

### Update Command Decision Matrix
Before modifying `update-cli.ts`, consult this truth table:

| User Flag | npm Channel | Registry Source | Expected Behavior |
|-----------|-------------|-----------------|-------------------|
| (none) | stable | npm latest | Update to latest stable |
| --dev | dev | npm @dev tag | Update to latest dev |
| --yes | (any) | (any) | Non-interactive, skip kit selection |
| --yes + prerelease installed | dev | npm @dev tag | Stay on dev channel |

All paths must be covered by tests in `update-cli.test.ts`.

---

## Idempotent Migration (`ck migrate`)

The `ck migrate` command uses a **3-phase reconciliation pipeline** (RECONCILE → EXECUTE → REPORT) designed for safe repeated execution as CK evolves.

**Key modules in `src/commands/portable/`:**
- `reconciler.ts` — Pure function, zero I/O, 8-case decision matrix (install/update/skip/conflict/delete)
- `portable-registry.ts` — Registry v3.0 with SHA-256 checksums (source + target per item)
- `portable-manifest.ts` — `portable-manifest.json` for cross-version evolution (renames, path migrations, section renames)
- `reconcile-types.ts` — Shared types: `ReconcileInput`, `ReconcilePlan`, `ReconcileAction`
- `conflict-resolver.ts` — Interactive CLI conflict resolution with diff preview
- `checksum-utils.ts` — Content/file checksums, binary detection

**Dashboard UI in `src/ui/src/components/migrate/`:**
- `reconcile-plan-view.tsx`, `conflict-resolver.tsx`, `diff-viewer.tsx`, `migration-summary.tsx`

**Architecture doc:** `docs/reconciliation-architecture.md`

**Design invariants:**
- Reconciler is pure — all I/O happens in caller (migrate-command.ts or migration-routes.ts)
- Registry tracks both source and target checksums to detect user edits
- Skills are directory-based — excluded from orphan detection and file-level checksums
- `convertedChecksums` uses `Record<string, string>` (not Map) for JSON serialization safety
- All manifest path fields use `safeRelativePath` Zod validator (no traversal, no empty strings)

## Platform Notes

| Platform | Claude Config Path |
|----------|-------------------|
| Linux/macOS | `~/.claude/` or `$HOME/.claude/` |
| Windows (PowerShell) | `%USERPROFILE%\.claude\` or `C:\Users\[USERNAME]\.claude` |
| WSL | `/home/[username]/.claude/` (Linux filesystem, not Windows) |

**Important**: Use `$HOME` (Unix) or `%USERPROFILE%` (Windows) instead of `~` in scripts - tilde doesn't expand on Windows.

## Git Workflow

```bash
# Feature branch from dev
git checkout dev && git pull origin dev
git checkout -b kai/<feature>

# After work complete
bun run typecheck && bun run lint:fix && bun test && bun run build
git push origin kai/<feature>
# Create PR to dev branch
```

## Commit Convention

- `feat:` → minor version bump
- `fix:` → patch version bump
- `hotfix:` → patch version bump (distinct "Hotfixes" section in changelog/release notes)
- `perf:` → patch version bump
- `refactor:` → patch version bump
- `docs:`, `test:`, `chore:` → no version bump

> **Note:** `hotfix:` is a custom type (not in the Conventional Commits spec). It works with our semantic-release config but may be flagged by strict commit linters if added later.

## Release Workflow (dev→main)

**Conflict Resolution Pattern:**
1. Create PR `dev→main` — will have CHANGELOG.md + package.json conflicts
2. Merge `main→dev` locally: `git merge origin/main`
3. Resolve conflicts: `git checkout --ours CHANGELOG.md package.json`
4. Commit with: `chore: merge main into dev` (MUST contain "merge" + "main")
5. Push to dev — semantic-release **skips** this commit (via `.releaserc.js` rule)
6. PR now mergeable → merge to main → triggers production release

**Why this works:** `.releaserc.js` has rule `{ type: "chore", subject: "*merge*main*", release: false }` to prevent premature dev version bumps after syncing with main.

## Documentation

Detailed docs in `docs/`:
- `project-overview-pdr.md` - Product requirements
- `codebase-summary.md` - Architecture overview
- `code-standards.md` - Coding conventions
- `system-architecture.md` - Technical details
- `deployment-guide.md` - Release procedures

## Agent Quick Reference

Machine-readable CLI manifest: [`cli-manifest.json`](./cli-manifest.json)
Human/LLM reference: [`docs/cli-reference.md`](./docs/cli-reference.md)

Top-level commands (all support `ck <cmd> --help`):
- `ck new` — bootstrap a new ClaudeKit project
- `ck init` — initialize/update a ClaudeKit project
- `ck update` — update the CLI itself
- `ck doctor` — health check
- `ck uninstall`, `ck backups`, `ck versions`, `ck setup`
- `ck config`, `ck projects`, `ck skills`, `ck agents`, `ck commands`, `ck migrate`
- `ck api`, `ck plan`, `ck content`, `ck watch`

Two-level help also works: `ck <cmd> <subcommand> --help`.

Pitfalls:
- `ck init --force` does NOT do a fresh install — use `--fresh` for that.
- `ck update --kit` is deprecated — use `ck init --kit` instead.
- `ck migrate --dry-run` first to preview before writing.
