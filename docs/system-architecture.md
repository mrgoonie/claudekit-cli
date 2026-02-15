# System Architecture

## Overview

ClaudeKit CLI uses **modular domain-driven architecture** with facade patterns. Separates concerns into CLI infrastructure, commands with phase handlers, domain-specific business logic, cross-domain services, and pure utilities. Designed for extensibility, security, and cross-platform compatibility.

**Version**: 3.32.0-dev.3 | **Modules**: 122 focused (target: <100 LOC each) | **Commands**: 7

## High-Level Architecture

```
┌─────────────────────────────────────┐
│     User Interface (CLI/Terminal)   │
└────────────────┬────────────────────┘
                 │
┌─────────────────▼────────────────────┐
│    CLI Layer (config, registry)      │
└────────────────┬────────────────────┘
                 │
┌─────────────────▼────────────────────┐
│  Commands (init, new, skills, etc)   │
│  + 8-3 phase handlers per command    │
└────────────────┬────────────────────┘
                 │
┌─────────────────▼────────────────────┐
│    Domains (config, github, skills,  │
│    health-checks, installation, ui,  │
│    versioning, help)                 │
└────────────────┬────────────────────┘
                 │
┌─────────────────▼────────────────────┐
│  Services (file-ops, package-inst,   │
│  transformers, manifest operations)  │
└────────────────┬────────────────────┘
                 │
┌─────────────────▼────────────────────┐
│  Shared Utils (logger, path-         │
│  resolver, safe-prompts, terminal)   │
└─────────────────────────────────────┘
```

## Architectural Patterns

### 1. Facade Pattern

Each domain exposes a facade file that re-exports public API from submodules, provides backward-compatible interface, and hides implementation. Example: `settings-merger.ts` re-exports from `merger/` submodules.

### 2. Phase Handler Pattern

Complex commands use orchestrator + phase handlers: init (8 phases), new (3 phases). Each phase handles one responsibility (~50-100 LOC), orchestrator coordinates flow. Enables unit testing, clear separation of concerns, easy debugging.

### 3. Context-Driven Flow

Commands maintain context object threaded through phases. Enables shared state, atomic operations, and rollback on failure.

## Command Architecture

### init/ - Project Initialization/Update (8 phases)
1. options-resolver: Parse and validate options
2. selection-handler: Kit and version selection
3. download-handler: Release download and extraction
4. migration-handler: Skills migration with backup
5. merge-handler: File merging with conflict detection
6. conflict-handler: Conflict reporting
7. transform-handler: Path transformations
8. post-install-handler: Post-install setup

### new/ - Project Creation (3 phases)
1. directory-setup: Validate target directory
2. project-creation: Create from template
3. post-setup: Optional packages, skills

### skills/ - Skills Management
Multi-select installation, registry tracking, uninstall per agent.

### uninstall/ - ClaudeKit Uninstaller
Detection with fallback (no metadata.json), safe removal.

### update-cli.ts - CLI Self-Update
Detects installed kits, builds kit-specific commands, parallel version checks.

### migrate - Idempotent Reconciliation Pipeline

`ck migrate` now follows a 3-phase model:

1. `RECONCILE` (pure planner, no side effects)
2. `EXECUTE` (strategy-aware writes + registry updates + rollback safety)
3. `REPORT` (final result summary for CLI and dashboard)

Detailed diagrams + contracts: `docs/reconciliation-architecture.md`.

## Domains Layer

### config/ - Configuration Management
Config generator, manager, validator. Settings merger with conflict resolution and diff calculation.

### github/ - GitHub API Integration
Octokit wrapper for releases and auth (GitHub CLI only). Asset selection: official package > custom assets > fallback tarball.

### health-checks/ - Doctor Command System
Parallel checkers for system (Node, npm, Python, git, gh), auth (token scopes, rate limit), GitHub API, ClaudeKit (installs, versions, skills), platform, network. Includes auto-healer for common issues.

### installation/ - Download, Extract, Merge
File downloader with streaming. ZIP/TAR extraction with security validation (path traversal, archive bombs, 500MB limit). Selective merger with multi-kit awareness: detects shared files, prevents overwriting newer versions.

### skills/ - Skills Management
Detection (config, dependencies, scripts), customization scanning with hash comparison, migration executor with backup and rollback.

### ui/ - Interactive UI
Prompts for kit/version selection, confirmations. Ownership display for multi-kit awareness.

### versioning/ - Version Management
CLI version checker with caching (7-day TTL). Kit version checker. Selection UI with beta/prerelease filtering.

### help/ - Help System
Custom renderer with theme support and NO_COLOR compliance. CommandHelp, OptionGroup, ColorTheme interfaces.

## Services Layer

### file-operations/ - File System
Manifest reader/writer with multi-kit support. Manifest tracker for file ownership. Ownership checker.

### package-installer/ - Package Installation
Dependency installer (Node, Python, system). Gemini MCP linker for AI tooling.

### transformers/ - Path Transformations
Command prefix applier (/ck: namespace). Folder path transformer for directory renaming.

## Shared Layer (Pure Utilities)

- **logger.ts** - Structured logging with token sanitization
- **environment.ts** - Platform detection, concurrency tuning
- **path-resolver.ts** - Cross-platform path resolution (XDG-compliant)
- **process-lock.ts** - Process locking: 1-min stale timeout, global exit handler, activeLocks registry
- **safe-prompts.ts** - CI-safe prompt wrappers
- **safe-spinner.ts** - Non-TTY safe spinners
- **terminal-utils.ts** - Terminal utilities
- **output-manager.ts** - Output formatting

## Security Architecture

### Path Traversal Prevention
- Canonical path resolution
- Reject relative paths with ".."
- Verify target within base

### Archive Bomb Prevention
- Maximum extraction: 500MB
- Path traversal validation
- Size checking during extraction

### Authentication Security
- GitHub CLI only (no token prompts)
- Keychain integration
- Token sanitization in logs
- Format validation (ghp_*, github_pat_*)

### Protected Files (always skipped)
.env, .env.local, *.key, *.pem, node_modules/, .git/, dist/, build/, .gitignore, CLAUDE.md, .mcp.json

## Multi-Kit Architecture (Phase 1)

### Selective Merger
Hybrid size+checksum comparison. Multi-kit aware: detects shared files, prevents overwriting newer versions. Comparison reasons: new, size-differ, checksum-differ, unchanged, shared-identical, shared-older.

### Copy Executor
Tracks shared files, enables cross-kit file checking via `setMultiKitContext()`. Skips statistics.

### Manifest Reader
`findFileInInstalledKits()`: Locates file across installed kits. `getUninstallManifest()`: Kit-scoped uninstall with shared file detection.

## Process Lock Architecture

**Stale timeout**: 1 minute (faster recovery). **Global exit handler**: Registered once, covers all termination paths. **Active locks registry**: Set<string> for cleanup on unexpected exit. **Cleanup**: Synchronous on 'exit' event (signals, process.exit(), natural drain). **Best-effort**: Errors swallowed during cleanup.

**Usage**: `await withProcessLock("lock-name", async () => { throw error; })` — throws instead of process.exit().

## Recent Improvements

- **#346 Stale lock fix**: Global exit handler, activeLocks registry, 1-min timeout
- **#344 Installation detection**: Fallback for installs without metadata.json
- **#343 Dev prerelease suppression**: Hide dev→stable updates
- **Skills rename**: `skill` → `skills` command, multi-select, registry
- **Deletion handling**: Glob patterns via picomatch, cross-platform path.sep
- **#339 Sync validation**: Filter deletion paths before validation

## Performance Characteristics

### Optimizations
- Streaming downloads (no memory buffering)
- Parallel release fetching and version checks
- In-memory token caching
- Efficient glob matching
- SHA-256 hashing for change detection
- Release caching (1hr TTL, configurable)
- Version check caching (7-day)

### Resource Limits
- Maximum extraction: 500MB
- Request timeout: 30 seconds
- Progress bar chunk: 1MB
- Cache TTL: 3600s (configurable via CK_CACHE_TTL)

## Data Flows

### New Project Flow
Parse → Validate → Authenticate → Select kit/version → Download → Extract → Copy → Optional: install packages/skills → Prefix transformation → Success

### Update Project Flow
Parse → Validate → Authenticate → Select version → Download → Extract → Skills migration → Merge with conflict detection → Protect custom files → Success

### Authentication Flow
GitHub CLI → Env vars → Config → Keychain → Prompt (if needed) → Return token with method

## Error Handling

### Error Types
Structured error classes with status codes. User-friendly messages. Stack traces in verbose mode. Graceful fallbacks (asset → tarball). Migration-specific errors with rollback.

### Recovery Mechanisms
- Fallback to tarball on asset failure
- Temporary directory cleanup on errors
- Safe prompt cancellation
- Non-TTY detection
- Backup restoration on migration failure

## Integration Points

### External Services
- GitHub API (Octokit): Releases and repositories
- GitHub CLI (gh): Authentication
- OS Keychain: Secure token storage
- npm Registry: Package distribution

### File System
- **Local config**: ~/.claudekit/config.json
- **Global config**: XDG-compliant (~/.config/claude/config.json)
- **Global kits**: ~/.claude/
- **Skills manifest**: .claude/skills/.skills-manifest.json
- **Skills backups**: .claude/backups/skills/
- **Temp files**: OS temp directory

## Development Workflow

```bash
bun install              # Install dependencies
bun run dev              # Run in development mode
bun test                 # Run tests
bun run typecheck        # Type checking
bun run lint             # Lint code
bun run format           # Format code
bun run compile          # Compile standalone binary
```

## Testing Strategy

Unit tests for core libraries, command integration tests, authentication flows, download/extraction, skills migration (6 files), doctor command (50 tests, 324 assertions). Mirrors source structure. Uses Bun test runner. Filesystem isolation with temp directories.

## Build & Distribution

Bun's --compile for standalone binaries. Multi-platform builds via GitHub Actions. Platform detection wrapper (bin/ck.js). Published to npm. Semantic versioning with automated releases via GitHub.

## CI/CD Pipeline

1. Push to main branch
2. Build binaries (all platforms)
3. Type checking, linting, tests
4. Semantic Release determines version
5. Create GitHub release with binaries
6. Publish to npm
7. Discord notification (optional)
