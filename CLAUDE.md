# ClaudeKit CLI

CLI tool (`ck`) for bootstrapping/updating ClaudeKit projects from GitHub releases.

## CRITICAL: Quality Gate

**MUST pass before ANY commit/PR. No exceptions.**

```bash
bun test && bun run lint && bun run typecheck && bun run build
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
├── index.ts      # CLI entry (cac framework)
├── types.ts      # Shared types & Zod schemas
├── commands/     # CLI commands (new, init, doctor, diagnose, uninstall, version)
├── lib/          # Core business logic (auth, github, download, merge, skills-*, version-*)
└── utils/        # Shared utilities (config, logger, package-installer)
```

## Key Patterns

- **CLI Framework**: `cac` for argument parsing
- **Interactive Prompts**: `@clack/prompts`
- **Logging**: `utils/logger.ts` for verbose debug output
- **Cross-platform paths**: `lib/global-path-transformer.ts`

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
bun test && bun run lint && bun run typecheck && bun run build
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
