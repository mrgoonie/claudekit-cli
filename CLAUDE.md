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
bun run typecheck && bun run lint:fix && bun test && bun run build && bun run ui:build
```

**All must pass before commit/PR. No exceptions.**

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

## Project Structure

```
src/
├── index.ts          # CLI entry (cac framework)
├── commands/         # CLI commands (new, init, doctor, uninstall, version, update-cli)
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
- `docs:`, `refactor:`, `test:`, `chore:` → no version bump

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
