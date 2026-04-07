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
bun run validate
# Equivalent to: bun run typecheck && bun run lint && bun test && bun run build
# Note: validate uses lint (read-only check), not lint:fix. Run lint:fix manually first.
```

**When touching UI files (`src/ui/`):** Also run `bun run ui:build` — the UI has a stricter TypeScript config (`tsc -b`) that catches errors `tsc --noEmit` misses (unused variables, missing ES lib methods). CI runs `ui:build` and will fail if you skip this step locally.

**Enforced by git hooks** — `pre-commit` runs typecheck+lint+build, `pre-push` adds tests. Hooks auto-install on `bun install`. If hooks are missing, run `bun run install:hooks`.

**AI agents: NEVER use `--no-verify` to bypass hooks. NEVER set `SKIP_HOOKS=true`. If the hook rejects your commit, fix the code — do not skip the gate. This rule is NON-NEGOTIABLE.**

**Human bypass (emergencies only):** `SKIP_HOOKS=true git commit -m "..."` or `SKIP_HOOKS=true git push`.

**Why:** AI-generated code historically failed CI in 80%+ of PRs, causing 3-6 fix-up commits each. The hooks exist to catch these failures locally before they waste CI cycles and pollute git history.

**Worktree support:** Hooks work in both normal repos and worktrees. The install script uses `core.hooksPath` with a relative path (`.githooks`) that resolves from each worktree's root. After creating a worktree, run `bun install` or `bun run install:hooks` from the worktree root.

**Common pitfalls:**
- Web server deps (`express`, `ws`, `chokidar`, `get-port`, `open`) must be in `package.json` — not just transitive
- UI component files must pass biome formatting (long JSX lines auto-wrapped)
- Express 5 types `req.params`/`req.query` as `string | string[]` — cast with `String()`

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

## Desktop App (Tauri v2)

ClaudeKit ships a native desktop app ("Control Center") built with Tauri v2 (Rust backend + React frontend).

### Architecture

The dashboard React app (`src/ui/`) runs in two modes:
- **Web mode** — served via `ck config ui` (Express + Vite on :3456)
- **Desktop mode** — embedded in Tauri webview, detected by `isTauri()` from `src/ui/src/hooks/use-tauri.ts`

The Rust backend (`src-tauri/`) provides native capabilities (filesystem, tray, auto-update) via Tauri commands. The frontend calls these via `@tauri-apps/api`.

### Rust Backend Structure

```
src-tauri/
├── tauri.conf.json     # App config (build, CSP, updater, icons)
├── Cargo.toml          # Rust dependencies
├── capabilities/       # Permission grants (store, dialog, updater)
├── icons/              # App icons (generated from src/ui/public/images/logo-512.png)
└── src/
    ├── lib.rs          # Tauri builder: plugins, setup, command registration
    ├── tray.rs         # System tray: Open, Check Updates, Quit
    ├── projects.rs     # Multi-project management (store-backed)
    ├── commands/
    │   └── config.rs   # 7 commands: read/write config, settings, statusline
    └── core/
        ├── mod.rs
        ├── config_parser.rs  # JSON read/write with graceful missing-file handling
        ├── paths.rs          # Platform-aware path resolution (~/.claude/, project/.claude/)
        └── schema.rs         # CkConfig, StatuslineLayout, StatuslineTheme structs
```

### Quick Commands

```bash
bun run tauri:dev       # Dev (starts dashboard:dev + Rust in parallel)
bun run tauri:build     # Production build (dmg/msi/AppImage)
cd src-tauri && cargo check   # Type-check Rust only
```

### CI

`.github/workflows/desktop-build.yml` builds on macOS/Ubuntu/Windows. Triggered by: PRs that touch `src-tauri/` or `src/ui/` (path filter), `desktop-v*` tag pushes (releases), and `workflow_dispatch` (manual). Release job creates GitHub release on `desktop-v*` tags.

**TODO (pre-release):**
- Generate updater key pair: `tauri signer generate`
- Store `TAURI_SIGNING_PRIVATE_KEY` as repo secret
- Populate `pubkey` in `tauri.conf.json`

---

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
