# ClaudeKit CLI - AI Development Guide

CLI tool (`ck`) for bootstrapping/updating ClaudeKit projects from GitHub releases.

## CRITICAL: Quality Gate

**MUST pass before ANY commit/PR. No exceptions.**

```bash
bun test && bun run lint && bun run typecheck && bun run build
```

| Check | Command | Failure = Blocked PR |
|-------|---------|---------------------|
| Tests | `bun test` | YES |
| Lint | `bun run lint` | YES |
| Types | `bun run typecheck` | YES |
| Build | `bun run build` | YES |

**DO NOT skip. DO NOT commit with failures. Fix ALL issues first.**

---

## Quick Reference

```bash
# Development
bun install                    # Install deps
bun run dev new --kit engineer # Run locally
bun test                       # Run tests
bun run lint                   # Lint check
bun run lint:fix               # Auto-fix lint issues
bun run typecheck              # Type check
bun run build                  # Build for npm
```

## Architecture

```
src/
├── index.ts           # CLI entry, command registration (cac framework)
├── types.ts           # Shared types & Zod schemas
├── commands/          # CLI commands (new, update/init, doctor, diagnose, uninstall, version)
├── lib/               # Core business logic
│   ├── auth.ts        # Multi-tier GitHub auth (gh CLI → env → keychain → prompt)
│   ├── github.ts      # GitHub API, release fetching
│   ├── download.ts    # Streaming downloads with progress
│   ├── merge.ts       # Smart file merging, conflict detection
│   ├── skills-*.ts    # Skills migration system (detect → backup → migrate)
│   └── version-*.ts   # Version management (cache, check, display, format, select)
└── utils/             # Shared utilities
    ├── config.ts      # Config file management (~/.claudekit/config.json)
    ├── logger.ts      # Verbose logging
    └── package-installer.ts  # Optional package installation (opencode, gemini)
```

## Key Concepts

### Commands
| Command | File | Purpose |
|---------|------|---------|
| `ck new` | `commands/new.ts` | Create new project from release |
| `ck init` | `commands/update.ts` | Update existing project (replaces `update`) |
| `ck doctor` | `commands/doctor.ts` | Check/install dependencies |
| `ck diagnose` | `commands/diagnose.ts` | Debug auth/access issues |
| `ck uninstall` | `commands/uninstall.ts` | Remove ClaudeKit installation |
| `ck --version` | `commands/version.ts` | Show version + update notifications |

### Authentication Flow
```
gh CLI → GITHUB_TOKEN env → config file → OS keychain → interactive prompt
```
Implementation: `lib/auth.ts`

### Skills Migration System
Handles flat → categorized directory restructuring:
1. `skills-detector.ts` - Detect migration needs
2. `skills-customization-scanner.ts` - SHA-256 hash comparison
3. `skills-backup-manager.ts` - Backup before migration
4. `skills-migrator.ts` - Execute migration
5. `skills-manifest.ts` - Manifest-based tracking

### Protected Patterns
Files never overwritten: `.env*`, `*.key`, `*.pem`, `node_modules/`, `.git/`, `dist/`, `build/`

## Development Patterns

### CLI Framework
Uses `cac` for argument parsing. Commands registered in `index.ts`:
```typescript
cli.command('new', 'Create new project')
   .option('--kit <kit>', 'Kit name')
   .option('--dir <dir>', 'Target directory')
   .action(newCommand)
```

### Interactive Prompts
Uses `@clack/prompts` for beautiful CLI UX:
```typescript
import * as p from '@clack/prompts'
const result = await p.select({ message: 'Select version', options })
```

### Error Handling
Wrap commands with try/catch, use `p.cancel()` for user cancellation:
```typescript
try {
  // command logic
} catch (error) {
  p.cancel('Operation failed')
  process.exit(1)
}
```

### Logging
Use verbose logger for debug output:
```typescript
import { logger } from '../utils/logger'
logger.verbose('Debug info', { data })
```

## Testing

```bash
bun test                    # All tests
bun test <file>             # Single file
bun test --watch            # Watch mode
bun run test:quick          # Quick dev test
```

Test files: `*.test.ts` alongside source files

## Build & Release

```bash
bun run build               # Build to dist/
bun run compile             # Single binary (local)
bun run compile:binaries    # All platform binaries
```

**CI/CD**: Semantic-release on `main` branch. Commits trigger:
- `feat:` → minor version bump
- `fix:` → patch version bump
- `BREAKING CHANGE:` → major version bump

## Common Tasks

### Add New Command
1. Create `src/commands/<name>.ts`
2. Export command function with options type
3. Register in `src/index.ts`
4. Add tests

### Add New CLI Option
1. Add to command registration in `index.ts`
2. Update types in `types.ts` if needed
3. Handle in command implementation
4. Update README.md

### Modify Merge Behavior
Edit `lib/merge.ts` - handles file conflict detection and resolution

### Update Skills Migration
Edit relevant `lib/skills-*.ts` file based on component

## Tech Stack

- **Runtime**: Bun 1.3.2+
- **Language**: TypeScript 5.7
- **CLI**: cac (argument parsing)
- **UX**: @clack/prompts, ora (spinners), cli-progress
- **GitHub**: @octokit/rest
- **Security**: keytar (OS keychain)
- **Validation**: zod
- **Linting**: Biome

## Important Files

| File | Purpose |
|------|---------|
| `package.json` | Version source of truth |
| `bin/ck.js` | npm entrypoint |
| `.github/workflows/` | CI/CD pipelines |
| `scripts/` | Build/release automation |

## Gotchas

1. **keytar** requires native compilation - external in build
2. **@octokit/rest** also external due to ESM issues
3. **Version sync**: Binary version must match package.json
4. **Global paths**: Use `lib/global-path-transformer.ts` for cross-platform paths
5. **Fresh installs**: `--fresh` flag is destructive - requires confirmation
