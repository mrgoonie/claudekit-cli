# System Architecture

## Overview

ClaudeKit CLI uses **modular domain-driven architecture** with facade patterns. Separates concerns into CLI infrastructure, commands with phase handlers, domain-specific business logic, cross-domain services, and pure utilities. Designed for extensibility, security, and cross-platform compatibility.

**Version**: 3.36.0-dev.7 | **LOC**: ~60K | **TypeScript Files**: 548 | **Domains**: 17 | **Commands**: 20 groups

## High-Level Architecture

```
┌─────────────────────────────────────┐
│   Desktop App (Tauri v2 / Rust)     │
│   System tray, auto-update,         │
│   native file dialogs               │
└────────────────┬────────────────────┘
                 │ (shared React UI)
┌─────────────────▼────────────────────┐
│     User Interface (CLI/Terminal     │
│     + Dashboard React SPA)           │
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

### desktop/ - Tauri Control Center (native mode)
Native shell for the shared dashboard. The Phase 1 invoke bridge now covers config/statusline, project registry, sessions, entity browsers, MCP discovery, dashboard aggregates, and system diagnostics. Pure helpers live in `src-tauri/src/core/`.

Phase 3 adds the unsigned desktop distribution layer around that shell:
- `.github/workflows/desktop-build.yml` now prepares portable desktop assets alongside the user-facing bundles.
- `scripts/generate-desktop-release-manifest.ts` emits a plain `desktop-manifest.json` download manifest from the tagged GitHub Release assets.
- `src/domains/desktop/` now backs `ck app` with reusable manifest resolution, install, uninstall, and detached launch helpers.
- Signed in-app updater support remains deferred until a dedicated signing-key phase ships a real Tauri updater contract.

Phase 5A changes the runtime split:
- Tauri dev boots the frontend directly instead of shelling into `ck config ui`.
- Supported desktop reads use Tauri commands or desktop-safe local adapters.
- Unsupported server-backed flows such as migration, update orchestration, and onboarding install stay explicit CLI/web workflows instead of hidden `/api` calls.
- Desktop first run now has its own native onboarding gate: if no projects are registered and no global `.ck.json` exists, the app redirects into a chromeless discovery flow that scans common home-directory workspaces and persists completion with `tauri-plugin-store`.

Phase 5B extends the native shell instead of the shared web backend:
- The tray menu now renders recent projects from `~/.claudekit/projects.json`, sorted by `last_opened` then `added_at`.
- Rust-side tray handlers own project recency updates and system-terminal launch, so tray actions work without Express.
- The shared React app listens for a semantic `tray-open` event and translates it into `/project/:projectId`, `/dashboard`, or settings navigation.

### skills/ - Skills Management
Multi-select installation, registry tracking, uninstall per agent.

### uninstall/ - ClaudeKit Uninstaller
Detection with fallback (no metadata.json), safe removal.

### update-cli.ts - CLI Self-Update
Detects installed kits, builds kit-specific commands, parallel version checks.

### migrate - Idempotent Reconciliation Pipeline

`ck migrate` follows a 3-phase model designed for safe repeated execution:

1. **RECONCILE** — Pure function (`reconciler.ts`), zero I/O. Takes source items + registry + target states + manifest → produces `ReconcilePlan` with actions. 8-case decision matrix: install, update, skip, conflict, delete (+ rename/path-migration from manifest).
2. **EXECUTE** — Applies plan actions. Interactive conflict resolution (`conflict-resolver.ts`) with diff preview. Updates Registry v3.0 with new checksums.
3. **REPORT** — Destination-aware plan display (`plan-display.ts`) with preflight rows and a boxed WHERE / WHAT / NEXT footer. Dashboard summary via API.

**Key design invariants:**
- Reconciler is pure — all I/O in caller (migrate-command.ts or migration-routes.ts)
- Registry v3.0 tracks source + target SHA-256 checksums per installation
- Skills excluded from orphan detection (directory-based, not file-level)
- `convertedChecksums` uses `Record<string, string>` for JSON safety
- Manifest path fields validated via `safeRelativePath` (no traversal, no empty strings)
- Migration lock (30s timeout) prevents concurrent registry corruption

Detailed diagrams + contracts: `docs/reconciliation-architecture.md`.

### api/ - ClaudeKit API Command Group (NEW)
Orchestrator routing actions to typed handlers (status, services, setup, proxy). Sub-routers for vidcap/reviewweb services with consistent proxy pattern. All handlers support `--json` flag. HTTP client manages auth + retries.

### watch/ - GitHub Issues Auto-Responder (Completed)

Long-running daemon that polls GitHub Issues and spawns Claude for AI-powered analysis and multi-turn responses. Designed for 6-8+ hour unattended overnight operation.

**Architecture:**

1. **Setup validation** — Check GitHub CLI auth, repo access, Claude CLI availability
2. **Poll loop** — Query new issues via gh CLI, filter by author exclusions, check rate limits
3. **Issue processor** — Route issue → brainstorm → clarification → planning → response posting
4. **Claude invocation** — Call `claude -p` with contextual prompts, timeout handling, turn counting
5. **Comment polling** — Monitor issue comments for user replies, detect stale conversations
6. **Plan generation** — Build plan prompts, invoke Claude, parse structured phases
7. **Response posting** — Scan for credentials (9 patterns), strip @mentions, post via stdin (not args), inject AI disclaimer
8. **State persistence** — Track activeIssues, processed issues, conversation history in .ck.json
9. **Logging** — Daily rotated logs in ~/.claudekit/logs/, summary printing on shutdown
10. **Process locking** — Single instance via `proper-lockfile`, heartbeat every 30s to keep lock fresh

**Key Features:**

- Process lock prevents concurrent executions
- Rate limiting: configurable issues/hour, turns/issue, poll interval
- Author exclusion list (skip bot accounts)
- Multi-turn conversations with max 10 turns/issue
- Credential detection blocks posting entirely
- Graceful SIGINT/SIGTERM handling: completes current task, saves state
- Configurable timeouts: brainstorm (300s), planning (600s)
- Stale issue detection (24h timeout)
- Input sanitization defends against 6+ prompt injection patterns

**Configuration (.ck.json):**

```json
{
  "watch": {
    "pollIntervalMs": 30000,
    "maxTurnsPerIssue": 10,
    "maxIssuesPerHour": 10,
    "excludeAuthors": ["bot", "automated"],
    "showBranding": true,
    "timeouts": { "brainstormSec": 300, "planSec": 600 }
  }
}
```

**CLI Flags:**

- `--interval <ms>` — Override poll interval (default: 30000ms)
- `--dry-run` — Detect issues without posting responses
- `--verbose` — Enable debug logging

**State Machine:**

Each issue flows: `new` → `brainstorming` → `clarifying` → `planning` → `plan_posted` → `completed` (or → `error`/`timeout`)

## Domains Layer (17 Domains — was 16)

### config/ - Configuration Management
Config generator, manager, validator. Settings merger with conflict resolution and diff calculation. Global/local mode handling.

### github/ - GitHub API Integration
Octokit wrapper for releases and auth (GitHub CLI only). Asset selection: official package > custom assets > fallback tarball.

### health-checks/ - Doctor Command System
Parallel checkers for system (Node, npm, Python, git, gh), auth (token scopes, rate limit), GitHub API, ClaudeKit (installs, versions, skills), platform, network. Includes auto-healer for common issues.

### installation/ - Download, Extract, Merge
File downloader with streaming. ZIP/TAR extraction with security validation (path traversal, archive bombs, 500MB limit). Selective merger with multi-kit awareness: detects shared files, prevents overwriting newer versions.

### skills/ - Skills Management
Detection (config, dependencies, scripts), customization scanning with hash comparison, migration executor with backup and rollback. agentskills.io integration with metadata version/author support.

### ui/ - Interactive UI
Prompts for kit/version selection, confirmations. Ownership display for multi-kit awareness.

### versioning/ - Version Management
CLI version checker with caching (7-day TTL) and stable-by-default self-update behavior. Kit version checker. Selection UI with beta/prerelease filtering.

### help/ - Help System
Custom renderer with theme support and NO_COLOR compliance. CommandHelp, OptionGroup, ColorTheme interfaces.

### web-server/ - Express+Vite Dashboard (NEW)
Express server with Vite HMR on single port (3456-3460 auto-fallback). 6 pages, 45+ components, 16 API routes, WebSocket support.

### web-server/ + claude-data/ - Hook Diagnostics
`/api/system/hook-diagnostics` exposes recent structured hook activity for the Config UI. `hook-log-reader.ts` resolves global installs (`~/.claude/hooks/.logs/hook-log.jsonl`) and project installs (`<project>/.claude/hooks/.logs/hook-log.jsonl`), supports registry-backed and discovered project ids, tolerates malformed JSONL lines, and returns summary counts for dashboard rendering. These routes default to local-only access, but `ck config --host ...` can expose the dashboard intentionally while keeping same-origin browser validation in place.

### api-key/ - API Key Management (NEW)
Secure storage and validation of API keys (Gemini, Discord, Telegram, OpenAI, etc.).

### claudekit-data/ - Claude User Data Parser (NEW)
Parses Claude user data: history, sessions, project state. Integration point for project discovery in dashboard.

### claudekit-api/ - API Client Infrastructure (NEW)
HTTP client with fetch wrapper, auth headers (Bearer token), rate limit retry (429 status). Typed error handler: `CkApiError` with error code mapping, rate limit info parsing from response headers. Factory pattern: `createApiClient(apiKey)` returns configured client instance.

### sync/ - Update Checking & Preview (NEW)
Passive version checking with diff calculation. Merge preview UI for update decisions.

### error/ - Error Classification (NEW)
Structured error types and handling utilities.

### migration/ - Legacy Migration & Manifest (NEW)
Metadata schemas, release manifest parsing, legacy version migration support.

## Services Layer

### file-operations/ - File System
Manifest reader/writer with multi-kit support. Manifest tracker for file ownership. Ownership checker.

### package-installer/ - Package Installation
Dependency installer (Node, Python, system). Gemini MCP linker for AI tooling. Process executor. Package manager detection (npm/yarn/pnpm/bun).

### transformers/ - Path Transformations
Command prefix applier (/ck: namespace). Folder path transformer for directory renaming.

### claude-data/ - Claude User Data Parsing
History, session, and project state parsing from Claude's local data storage.

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

## Dashboard Architecture (NEW)

### Entry Point
`ck config ui` launches an Express+Vite server on a single port (3456-3460 auto-fallback). Default bind host is `127.0.0.1`; `--host` enables intentional LAN/Tailscale/custom-host access.

### Frontend (React+Vite)
- **6 Main Pages**: GlobalConfig, ProjectConfig, Migrate, Skills, Onboarding, ProjectDashboard
- **45+ Components**: schema-form, config-editor, migrate (plan, conflict resolver, diff viewer), skills UI, system status
- **11 Custom Hooks**: useMigrationPlan, useConfigEditor, useWebSocket, etc.
- **Styling**: Tailwind CSS with responsive design
- **HMR**: Hot module reloading in development mode

### Backend (Express API Routes)
- **action-routes** — Reconciliation plan execution
- **migration-routes** — Migration status & conflict resolution
- **project-routes** — Project discovery & management
- **skill-routes** — Skill installation/uninstall status
- **ck-config-routes** — Global configuration endpoints
- **system-routes** — System diagnostics
- **session-routes** — Session management
- **user-routes** — User data endpoints
- **settings-routes** — Settings management
- **health-routes** — Health check endpoints

### WebSocket Support
Live updates for long-running operations (downloads, migrations, installations).

## Recent Improvements

- **#412 Idempotent migration**: Pure reconciler, Registry v3.0 with checksums, portable manifest, CLI + Dashboard conflict resolution
- **Hook diagnostics dashboard**: Scope-aware hook log reader, `/api/system/hook-diagnostics`, and `ck config` panel for recent hook failures
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
