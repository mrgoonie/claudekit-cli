# ClaudeKit CLI

CLI tool (`ck`) for bootstrapping/updating ClaudeKit projects from GitHub releases.

## 🎯 Core Principle

**User experience is paramount.** The CLI is users' first touchpoint with ClaudeKit. Prioritize clarity over cleverness: intuitive commands, helpful errors, minimal friction from install to daily use.

---

## CRITICAL: Quality Gate

**MUST pass before ANY commit/PR. No exceptions.**

```bash
bun run typecheck && bun run lint:fix && bun test && bun run build
```

**All must pass before commit/PR. No exceptions.**

## Quick Commands

```bash
# Development
bun install                    # Install deps
bun run dev new --kit engineer # Run locally
bun test                       # Run tests
bun run lint:fix               # Auto-fix lint
bun run typecheck              # Type check
bun run build                  # Build for npm

# Testing
bun test <file>                # Single file
bun test --watch               # Watch mode
```

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

## Documentation

Detailed docs in `docs/`:
- `project-overview-pdr.md` - Product requirements
- `codebase-summary.md` - Architecture overview
- `code-standards.md` - Coding conventions
- `system-architecture.md` - Technical details
- `deployment-guide.md` - Release procedures
