# Codebase Summary

## Overview

ClaudeKit CLI is a command-line tool for bootstrapping and updating ClaudeKit projects from private GitHub repository releases. Built with Bun and TypeScript, it provides secure, fast project setup and maintenance with comprehensive features for downloading, extracting, and merging project templates.

**Version**: 3.32.0-dev.3 (next stable: 3.32.0)
**Architecture**: Modular domain-driven with facade patterns
**Total TypeScript Files**: 283 source files (122 focused modules)
**Commands**: 7 (new, init, skills, doctor, uninstall, versions, update-cli)
**Modules**: 122 focused submodules (target: <100 lines each)

## Architecture Highlights

The codebase underwent a major modularization refactor, reducing 24 large files (~12,197 lines) to facades (~2,466 lines) with 122 new focused modules. Key patterns:

- **Facade Pattern**: Each domain exposes a facade file that re-exports public API from submodules
- **Phase Handler Pattern**: Complex commands use orchestrator + phase handlers for single responsibility
- **Module Size Target**: Submodules ~50-100 lines, facades ~50-150 lines, hard limit 200 lines
- **Self-Documenting Names**: kebab-case file names describe purpose without needing to read content

## Technology Stack

### Runtime & Build Tools
- **Bun**: Primary runtime and package manager (>=1.3.2)
- **TypeScript**: Type-safe development (v5.7.2, strict mode)
- **Node.js**: Compatible with Node.js LTS environments

### Core Dependencies
- **@octokit/rest**: GitHub API client for repository interactions
- **@clack/prompts**: Beautiful interactive CLI prompts
- **cac**: Command-line argument parser
- **extract-zip**: ZIP archive extraction
- **tar**: TAR.GZ archive handling
- **fs-extra**: Enhanced filesystem operations
- **ignore**: Glob pattern matching for file filtering
- **zod**: Runtime type validation and schema parsing
- **cli-progress**: Progress bar rendering
- **ora**: Terminal spinners
- **picocolors**: Terminal colors

### Development Tools
- **Biome**: Fast linting and formatting
- **Semantic Release**: Automated versioning and publishing
- **GitHub Actions**: CI/CD automation with multi-platform binary builds

### Target Platforms
- **macOS** (arm64, x64)
- **Linux** (x64)
- **Windows** (x64)

## Project Structure

```
claudekit-cli/
├── bin/                          # Binary distribution
│   └── ck.js                     # Platform detection wrapper
├── src/                          # Source code (334 TS files)
│   ├── cli/                      # CLI infrastructure (NEW)
│   │   ├── cli-config.ts         # CLI framework configuration
│   │   ├── command-registry.ts   # Command registration
│   │   └── version-display.ts    # Version output formatting
│   ├── commands/                 # Command implementations
│   │   ├── init/                 # Init command modules (NEW)
│   │   │   ├── index.ts          # Public exports (facade)
│   │   │   ├── init-command.ts   # Main orchestrator
│   │   │   ├── types.ts          # Command-specific types
│   │   │   └── phases/           # 8 phase handlers
│   │   │       ├── conflict-handler.ts
│   │   │       ├── download-handler.ts
│   │   │       ├── merge-handler.ts
│   │   │       ├── migration-handler.ts
│   │   │       ├── options-resolver.ts
│   │   │       ├── post-install-handler.ts
│   │   │       ├── selection-handler.ts
│   │   │       └── transform-handler.ts
│   │   ├── new/                  # New command modules (NEW)
│   │   │   ├── index.ts          # Public exports
│   │   │   ├── new-command.ts    # Main orchestrator
│   │   │   └── phases/           # 3 phase handlers
│   │   │       ├── directory-setup.ts
│   │   │       ├── post-setup.ts
│   │   │       └── project-creation.ts
│   │   ├── uninstall/            # Uninstall modules (NEW)
│   │   │   ├── index.ts
│   │   │   ├── uninstall-command.ts
│   │   │   ├── analysis-handler.ts
│   │   │   ├── installation-detector.ts
│   │   │   └── removal-handler.ts
│   │   ├── migrate/              # Migrate command (idempotent reconciliation)
│   │   │   └── migrate-command.ts # Main orchestrator (discover → reconcile → execute → report)
│   │   ├── portable/             # Portable migration modules
│   │   │   ├── reconciler.ts      # Pure reconciler (zero I/O, 8-case decision matrix)
│   │   │   ├── reconcile-types.ts # Shared types (ReconcileInput, ReconcilePlan, ReconcileAction)
│   │   │   ├── portable-registry.ts # Registry v3.0 with SHA-256 checksums
│   │   │   ├── portable-manifest.ts # portable-manifest.json schema + loader
│   │   │   ├── portable-installer.ts # Installation executor
│   │   │   ├── checksum-utils.ts  # Content/file checksums, binary detection
│   │   │   ├── conflict-resolver.ts # Interactive CLI conflict resolution
│   │   │   ├── diff-display.ts    # Diff output with ANSI sanitization
│   │   │   └── plan-display.ts    # Terraform-style plan display
│   │   ├── doctor.ts             # Doctor command
│   │   ├── init.ts               # Init facade
│   │   ├── update-cli.ts         # CLI self-update with smart kit detection
│   │   └── version.ts            # Version listing
│   ├── domains/                  # Business logic by domain
│   │   ├── config/               # Configuration management
│   │   │   ├── merger/           # Settings merge logic (NEW)
│   │   │   │   ├── conflict-resolver.ts
│   │   │   │   ├── diff-calculator.ts
│   │   │   │   ├── file-io.ts
│   │   │   │   ├── merge-engine.ts
│   │   │   │   └── types.ts
│   │   │   ├── config-generator.ts
│   │   │   ├── config-manager.ts
│   │   │   ├── config-validator.ts
│   │   │   └── settings-merger.ts  # Facade
│   │   ├── github/               # GitHub API integration
│   │   │   ├── client/           # API modules (NEW)
│   │   │   │   ├── asset-utils.ts
│   │   │   │   ├── auth-api.ts
│   │   │   │   ├── error-handler.ts
│   │   │   │   ├── releases-api.ts
│   │   │   │   └── repo-api.ts
│   │   │   ├── github-auth.ts
│   │   │   ├── github-client.ts  # Facade
│   │   │   ├── npm-registry.ts
│   │   │   └── types.ts
│   │   ├── health-checks/        # Doctor command system
│   │   │   ├── checkers/         # Individual checkers (NEW)
│   │   │   │   ├── active-plan-checker.ts
│   │   │   │   ├── claude-md-checker.ts
│   │   │   │   ├── cli-install-checker.ts
│   │   │   │   ├── config-completeness-checker.ts
│   │   │   │   ├── hooks-checker.ts
│   │   │   │   ├── installation-checker.ts
│   │   │   │   ├── path-refs-checker.ts
│   │   │   │   ├── permissions-checker.ts
│   │   │   │   ├── settings-checker.ts
│   │   │   │   ├── shared.ts
│   │   │   │   └── skills-checker.ts
│   │   │   ├── platform/         # Platform checks (NEW)
│   │   │   │   ├── environment-checker.ts
│   │   │   │   ├── shell-checker.ts
│   │   │   │   └── windows-checker.ts
│   │   │   ├── utils/            # Checker utilities (NEW)
│   │   │   │   ├── path-normalizer.ts
│   │   │   │   └── version-formatter.ts
│   │   │   ├── auto-healer.ts
│   │   │   ├── check-runner.ts
│   │   │   ├── claudekit-checker.ts  # Facade
│   │   │   ├── platform-checker.ts   # Facade
│   │   │   └── report-generator.ts
│   │   ├── help/                 # Help system
│   │   │   ├── commands/         # Command help definitions (NEW)
│   │   │   │   ├── common-options.ts
│   │   │   │   ├── doctor-command-help.ts
│   │   │   │   ├── init-command-help.ts
│   │   │   │   ├── new-command-help.ts
│   │   │   │   ├── uninstall-command-help.ts
│   │   │   │   ├── update-command-help.ts
│   │   │   │   └── versions-command-help.ts
│   │   │   ├── help-banner.ts
│   │   │   ├── help-colors.ts
│   │   │   ├── help-commands.ts  # Facade
│   │   │   └── help-renderer.ts
│   │   ├── installation/         # Download, extraction, merging
│   │   │   ├── download/         # Download logic (NEW)
│   │   │   │   └── file-downloader.ts
│   │   │   ├── extraction/       # Archive extraction (NEW)
│   │   │   │   ├── extraction-validator.ts
│   │   │   │   ├── tar-extractor.ts
│   │   │   │   └── zip-extractor.ts
│   │   │   ├── merger/           # File merge logic (NEW)
│   │   │   │   ├── copy-executor.ts
│   │   │   │   ├── file-scanner.ts
│   │   │   │   └── settings-processor.ts
│   │   │   ├── package-managers/ # PM detectors (NEW)
│   │   │   │   ├── bun-detector.ts
│   │   │   │   ├── detection-core.ts
│   │   │   │   ├── detector-base.ts
│   │   │   │   ├── npm-detector.ts
│   │   │   │   ├── pnpm-detector.ts
│   │   │   │   └── yarn-detector.ts
│   │   │   ├── utils/            # Install utilities (NEW)
│   │   │   │   ├── archive-utils.ts
│   │   │   │   ├── encoding-utils.ts
│   │   │   │   ├── file-utils.ts
│   │   │   │   └── path-security.ts
│   │   │   ├── download-manager.ts   # Facade
│   │   │   ├── file-merger.ts        # Facade
│   │   │   ├── package-manager-detector.ts  # Facade
│   │   │   └── selective-merger.ts
│   │   ├── skills/               # Skills management
│   │   │   ├── customization/    # Customization scan (NEW)
│   │   │   │   ├── comparison-engine.ts
│   │   │   │   ├── hash-calculator.ts
│   │   │   │   └── scan-reporter.ts
│   │   │   ├── detection/        # Skills detection (NEW)
│   │   │   │   ├── config-detector.ts
│   │   │   │   ├── dependency-detector.ts
│   │   │   │   └── script-detector.ts
│   │   │   ├── migrator/         # Migration logic (NEW)
│   │   │   │   ├── migration-executor.ts
│   │   │   │   └── migration-validator.ts
│   │   │   ├── skills-customization-scanner.ts  # Facade
│   │   │   ├── skills-detector.ts               # Facade
│   │   │   ├── skills-migrator.ts               # Facade
│   │   │   └── skills-manifest.ts
│   │   ├── ui/                   # User interface
│   │   │   ├── prompts/          # Prompt modules (NEW)
│   │   │   │   ├── confirmation-prompts.ts
│   │   │   │   ├── installation-prompts.ts
│   │   │   │   ├── kit-prompts.ts
│   │   │   │   └── version-prompts.ts
│   │   │   ├── ownership-display.ts
│   │   │   ├── ownership-prompts.ts
│   │   │   └── prompts.ts        # Facade
│   │   └── versioning/           # Version management
│   │       ├── checking/         # Version checks (NEW)
│   │       │   ├── cli-version-checker.ts
│   │       │   ├── kit-version-checker.ts
│   │       │   ├── notification-display.ts
│   │       │   └── version-utils.ts
│   │       ├── selection/        # Version selection (NEW)
│   │       │   ├── selection-ui.ts
│   │       │   └── version-filter.ts
│   │       ├── version-checker.ts    # Facade
│   │       └── version-selector.ts   # Facade
│   ├── services/                 # Cross-domain services
│   │   ├── file-operations/      # File system operations
│   │   │   ├── manifest/         # Manifest ops (NEW)
│   │   │   │   ├── manifest-reader.ts
│   │   │   │   ├── manifest-tracker.ts
│   │   │   │   └── manifest-updater.ts
│   │   │   ├── manifest-writer.ts    # Facade
│   │   │   └── ownership-checker.ts
│   │   ├── package-installer/    # Package installation
│   │   │   ├── dependencies/     # Dependency install (NEW)
│   │   │   │   ├── node-installer.ts
│   │   │   │   ├── python-installer.ts
│   │   │   │   └── system-installer.ts
│   │   │   ├── gemini-mcp/       # Gemini MCP (NEW)
│   │   │   │   ├── config-manager.ts
│   │   │   │   ├── linker-core.ts
│   │   │   │   └── validation.ts
│   │   │   ├── dependency-installer.ts   # Facade
│   │   │   ├── gemini-mcp-linker.ts      # Facade
│   │   │   ├── package-installer.ts
│   │   │   └── process-executor.ts
│   │   └── transformers/         # Path transformations
│   │       ├── commands-prefix/  # Prefix logic (NEW)
│   │       │   ├── file-processor.ts
│   │       │   ├── prefix-applier.ts
│   │       │   ├── prefix-cleaner.ts
│   │       │   └── prefix-utils.ts
│   │       ├── folder-transform/ # Folder transforms (NEW)
│   │       │   ├── folder-renamer.ts
│   │       │   ├── path-replacer.ts
│   │       │   └── transform-validator.ts
│   │       ├── commands-prefix.ts        # Facade
│   │       ├── folder-path-transformer.ts  # Facade
│   │       └── global-path-transformer.ts
│   ├── shared/                   # Pure utilities (no domain logic)
│   │   ├── environment.ts        # Platform detection
│   │   ├── logger.ts             # Logging utilities
│   │   ├── output-manager.ts     # Output formatting
│   │   ├── path-resolver.ts      # Path resolution
│   │   ├── progress-bar.ts       # Progress indicators
│   │   ├── safe-prompts.ts       # Safe prompt wrappers
│   │   ├── safe-spinner.ts       # Safe spinner wrappers
│   │   ├── skip-directories.ts   # Directory skip patterns
│   │   └── terminal-utils.ts     # Terminal utilities
│   ├── types/                    # Domain-specific types & Zod schemas
│   │   ├── commands.ts           # Command option schemas
│   │   ├── common.ts             # Common types
│   │   ├── errors.ts             # Error types
│   │   ├── github.ts             # GitHub API types
│   │   ├── kit.ts                # Kit types and constants
│   │   ├── metadata.ts           # Metadata schemas
│   │   └── skills.ts             # Skills types
│   ├── index.ts                  # CLI entry point
│   └── __tests__/                # Unit tests mirror src/ structure
│       └── commands/             # Command unit tests
│           └── update-cli.test.ts # Tests for buildInitCommand helper
├── tests/                        # Additional test suites
│   ├── commands/                 # Command tests
│   ├── helpers/                  # Test helpers
│   ├── integration/              # Integration tests
│   ├── lib/                      # Library tests
│   ├── scripts/                  # Script tests
│   └── utils/                    # Utility tests
├── docs/                         # Documentation
├── plans/                        # Implementation plans
├── .github/workflows/            # CI/CD configuration
│   ├── release.yml               # Release automation
│   └── build-binaries.yml        # Multi-platform binary builds
├── package.json                  # Package manifest
└── tsconfig.json                 # TypeScript configuration
```

## Key Components

### Modular Architecture Patterns

#### Facade Pattern
Each domain module exposes a facade file that re-exports public API from submodules, provides backward-compatible interface, and hides implementation details.

#### Phase Handler Pattern
Complex commands use orchestrator + phase handlers: each phase handles one responsibility (~50-100 lines), orchestrator coordinates flow. Example: init-command.ts orchestrates 8 phases (options, selection, download, migration, merge, transforms, post-install).

### 0. Help System (src/domains/help/)
Custom help renderer with theme support and NO_COLOR compliance. Exposes CommandHelp, HelpExample, OptionGroup, and ColorTheme interfaces for consistent, accessible help output. Max 2 examples per command for conciseness.

### 1. Command Layer (src/commands/)

#### init/ - Project Initialization/Update (8 phases)
Orchestrator + phase handlers: options-resolver, selection-handler, download-handler, migration-handler, merge-handler, conflict-handler, transform-handler, post-install-handler. Post-install phase calls `handlePluginInstall()` to register CK plugin with Claude Code for namespaced skill commands (/ck:*).

#### new/ - Project Creation (3 phases)
Orchestrator + phase handlers: directory-setup, project-creation, post-setup.

#### skills/ - Skills Management (multi-select, registry, uninstall)
Renamed from `skill` command. Includes detection, installation, uninstall, and registry tracking of skills across agents.

#### uninstall/ - ClaudeKit Uninstaller
Detection, analysis, and safe removal with fallback for installations without metadata.json. Calls `handlePluginUninstall()` to clean up CK plugin and marketplace registration from Claude Code (kit-scoped: only for engineer kit).

#### update-cli.ts - CLI Self-Update with Smart Kit Detection
Detects installed kits, builds kit-specific init commands (e.g., `ck init --kit engineer --yes --install-skills`), performs parallel version checks with non-blocking fallback.

#### migrate/ + portable/ - Idempotent Reconciliation Pipeline
3-phase RECONCILE → EXECUTE → REPORT pipeline for safe repeated migrations. Pure reconciler (zero I/O, 8-case decision matrix), Registry v3.0 with SHA-256 checksums, portable manifest for cross-version evolution. Interactive CLI conflict resolution with diff preview. Dashboard UI with plan viewer and conflict resolver. See `docs/reconciliation-architecture.md`.

### 2. Domains Layer (src/domains/)

Business logic by domain with facade pattern.

**config/** - Config management, merger with conflict resolution
**github/** - GitHub API client, auth (GitHub CLI only), npm registry
**health-checks/** - Doctor command: parallel checkers for system, auth, GitHub, ClaudeKit, platform, network
**installation/** - Download, extract (ZIP/TAR), merge (selective, multi-kit aware), package manager detection
**skills/** - Detection, customization scanning, migration with backup/rollback
**ui/** - Interactive prompts (kit/version selection, confirmations), ownership display
**versioning/** - Version checking (CLI/kit), caching (7-day TTL), selection UI

#### installation/ - Download, Extraction, Merging
```
installation/
├── download-manager.ts     # Facade
├── file-merger.ts          # Facade (+ setMultiKitContext method)
├── package-manager-detector.ts  # Facade
├── selective-merger.ts     # Multi-kit aware merger (Phase 1)
├── download/
│   └── file-downloader.ts
├── extraction/
│   ├── extraction-validator.ts
│   ├── tar-extractor.ts
│   └── zip-extractor.ts
├── merger/
│   ├── copy-executor.ts    # Multi-kit support: setMultiKitContext, shared file tracking
│   ├── file-scanner.ts
│   └── settings-processor.ts
├── package-managers/
│   ├── bun-detector.ts
│   ├── npm-detector.ts
│   ├── pnpm-detector.ts
│   ├── yarn-detector.ts
│   ├── detection-core.ts
│   └── detector-base.ts
└── utils/
    ├── archive-utils.ts
    ├── encoding-utils.ts
    ├── file-utils.ts
    └── path-security.ts
```

**Multi-Kit Merge Phase 1 Features:**

`selective-merger.ts` (NEW):
- Hybrid size+checksum comparison for efficient copy decisions
- Multi-kit context awareness (via `setMultiKitContext()`)
- File comparison reasons: `new`, `size-differ`, `checksum-differ`, `unchanged`, `shared-identical`, `shared-older`
- Semantic versioning comparison for shared files across kits
- Returns `CompareResult` with changed status and detailed reason

`copy-executor.ts` (ENHANCED):
- `setMultiKitContext(claudeDir, installingKit)`: Enable cross-kit file checking
- Tracks shared files and skipped count statistics
- Prevents overwriting newer versions from other kits
- Passes multi-kit context to SelectiveMerger for intelligent decisions

`file-merger.ts` (ENHANCED):
- Facade exports `setMultiKitContext()` method
- Wires multi-kit context through to CopyExecutor

#### skills/ - Skills Management
```
skills/
├── skills-customization-scanner.ts  # Facade
├── skills-detector.ts               # Facade
├── skills-migrator.ts               # Facade
├── skills-manifest.ts
├── skills-mappings.ts
├── customization/
│   ├── comparison-engine.ts
│   ├── hash-calculator.ts
│   └── scan-reporter.ts
├── detection/
│   ├── config-detector.ts
│   ├── dependency-detector.ts
│   └── script-detector.ts
└── migrator/
    ├── migration-executor.ts
    └── migration-validator.ts
```

#### versioning/ - Version Management
```
versioning/
├── version-checker.ts      # Facade
├── version-selector.ts     # Facade
├── release-cache.ts
├── version-cache.ts
├── checking/
│   ├── cli-version-checker.ts
│   ├── kit-version-checker.ts
│   ├── notification-display.ts
│   └── version-utils.ts
└── selection/
    ├── selection-ui.ts
    └── version-filter.ts
```

### 3. Services Layer (src/services/)

Cross-domain services with focused submodules.

#### file-operations/ - File System Operations
```
file-operations/
├── manifest-writer.ts      # Facade
├── ownership-checker.ts
├── manifest/               # Manifest operations (NEW)
│   ├── manifest-reader.ts  # Multi-kit manifest reading
│   ├── manifest-tracker.ts
│   └── manifest-updater.ts
```

**Manifest Operations (Phase 1):**

`manifest-reader.ts` (NEW):
- `findFileInInstalledKits()`: Locates file in any installed kit's metadata (multi-kit aware)
- `InstalledFileInfo`: Interface returning file ownership, version, checksum across kits
- `readKitManifest()`: Read kit-specific metadata from manifest.json
- `getUninstallManifest()`: Kit-scoped uninstall with shared file detection (multi-kit support)
- Supports both multi-kit format and legacy format metadata

`manifest-writer.ts` (FACADE):
- Coordinates manifest tracking and updates

#### package-installer/ - Package Installation
```
package-installer/
├── dependency-installer.ts   # Facade
├── gemini-mcp-linker.ts      # Facade
├── package-installer.ts
├── process-executor.ts
├── dependencies/
│   ├── node-installer.ts
│   ├── python-installer.ts
│   └── system-installer.ts
└── gemini-mcp/
    ├── config-manager.ts
    ├── linker-core.ts
    └── validation.ts
```

#### plugin-installer.ts - CC Plugin Installer
Handles Claude Code plugin marketplace registration during `ck init`:
- CC version gate: requires >= 1.0.33 (via `cc-version-checker.ts`)
- Copies plugin from release to `~/.claudekit/marketplace/`
- Registers local marketplace with CC (`claude plugin marketplace add`)
- Installs/updates plugin (`claude plugin install/update ck@claudekit`)
- Post-install verification via `claude plugin list`
- Returns structured `PluginInstallResult` with verification status
- Cleanup: `handlePluginUninstall()` removes plugin and marketplace registration on `ck uninstall`
- Plugin-only distribution: no fallback to bare skill copy

#### cc-version-checker.ts - CC Version Gate
Validates CC >= 1.0.33 for plugin support. Non-fatal — callers skip plugin install if CC missing/old.

#### skill-migration-merger.ts - Skill Migration
Detects user-modified skills (ownership: ck-modified) and preserves as standalone alongside plugin.

#### transformers/ - Path Transformations
```
transformers/
├── commands-prefix.ts        # Facade
├── folder-path-transformer.ts  # Facade
├── global-path-transformer.ts
├── commands-prefix/
│   ├── file-processor.ts
│   ├── prefix-applier.ts
│   ├── prefix-cleaner.ts
│   └── prefix-utils.ts
└── folder-transform/
    ├── folder-renamer.ts
    ├── path-replacer.ts
    └── transform-validator.ts
```

### 4. Shared Layer (src/shared/)

Pure utilities with no domain logic:
- `environment.ts` - Platform detection, concurrency tuning
- `logger.ts` - Structured logging with token sanitization
- `output-manager.ts` - Output formatting
- `path-resolver.ts` - Cross-platform path resolution (XDG-compliant)
- `progress-bar.ts` - Progress indicators
- `safe-prompts.ts` - CI-safe prompt wrappers
- `safe-spinner.ts` - Non-TTY safe spinners
- `terminal-utils.ts` - Terminal utilities

## Data Flow

### New Project Flow
1. Parse and validate command options
2. Authenticate with GitHub (multi-tier fallback)
3. Select kit (interactive or via flag)
4. Select version (interactive or latest)
5. Validate target directory
6. Verify repository access
7. Download archive (with progress)
8. Extract with security validation
9. Apply exclude patterns
10. Copy files to target
11. Optional: Install packages (OpenCode, Gemini)
12. Optional: Install skills dependencies
13. Optional: Apply command prefix (/ck:)
14. Success message with next steps

### Update Project Flow
1. Parse and validate options (including --global, --fresh, --beta)
2. Handle fresh installation if --fresh flag
3. Set global flag in ConfigManager
4. Authenticate with GitHub
5. Select kit and version (show beta if --beta)
6. Download and extract to temp
7. Detect skills migration need (manifest or heuristics)
8. Execute migration if needed (with backup/rollback)
9. Scan for custom .claude files
10. Merge with conflict detection
11. Optional: Apply command prefix
12. Generate new skills manifest
13. Success message

### Authentication Flow
```
GH CLI → Env Vars → Config → Keychain → Prompt User
  ↓         ↓         ↓         ↓           ↓
Success   Success   Success   Success   Save to Keychain?
  ↓         ↓         ↓         ↓           ↓
Return Token with Method
```

### Skills Migration Flow
```
Detection (Manifest or Heuristics)
    ↓
User Confirmation (Interactive Mode)
    ↓
Backup Creation (with compression)
    ↓
Migration Execution
    ↓
Generate New Manifest
    ↓
Success or Rollback on Error
```

## Security Architecture

### Security Layers
1. **Application Layer**: Token sanitization, input validation (Zod)
2. **Download Layer**: Path traversal prevention, archive bomb detection
3. **Extraction Layer**: Exclude pattern enforcement, size limits
4. **Storage Layer**: OS keychain encryption, protected file preservation

### Path Traversal Prevention
- Resolve paths to canonical forms
- Reject relative paths with ".."
- Verify target starts with base path
- Maximum extraction size: 500MB

### Authentication Security
- Tokens never logged or exposed
- Automatic sanitization in logs
- Keychain integration for secure storage
- Token format validation (ghp_*, github_pat_*)

### Protected Files
Always skipped during updates:
- .env, .env.local, .env.*.local
- *.key, *.pem, *.p12
- node_modules/**, .git/**
- dist/**, build/**
- .gitignore, .repomixignore, .mcp.json, CLAUDE.md

## Performance Characteristics

### Optimizations
- Streaming downloads (no memory buffering)
- Parallel release fetching
- In-memory token caching
- Efficient glob pattern matching
- SHA-256 hashing for change detection
- Release data caching (1hr TTL, configurable)
- Version check caching (7-day cache)

### Resource Limits
- Maximum extraction size: 500MB
- Request timeout: 30 seconds
- Progress bar chunk size: 1MB
- Cache TTL: 3600s (configurable via CK_CACHE_TTL)

## Build & Distribution

### Binary Compilation
- Bun's --compile flag for standalone binaries
- Multi-platform builds via GitHub Actions
- Platform detection wrapper script (bin/ck.js)

### NPM Distribution
- Published to npm registry
- Global installation via npm, yarn, pnpm, or bun
- Semantic versioning with automated releases

### CI/CD Pipeline
1. Push to main branch
2. Build binaries (parallel, all platforms)
3. Run type checking, linting, tests
4. Semantic Release determines version
5. Create GitHub release with binaries
6. Publish to npm registry
7. Discord notification (optional)

## Key Features

### CC Plugin Installer
- **Version gate**: Requires CC >= 1.0.33 for plugin system support
- **Plugin registration**: Automatically registers CK plugin with Claude Code for namespaced skill access (/ck:cook, /ck:debug)
- **Marketplace management**: Persistent marketplace location (~/.claudekit/marketplace/) with idempotent registration
- **Verified install**: Post-install verification via `claude plugin list`, deferred skill deletions gated on verification
- **Skill migration**: User-modified skills preserved as standalone alongside plugin
- **Metadata tracking**: Records `pluginInstalled`, `pluginVersion` for idempotent re-runs
- **Integrated cleanup**: `ck uninstall` removes plugin and marketplace registration (engineer kit only)
- **Non-fatal**: Plugin is progressive enhancement — installation continues if Claude Code unavailable

### New in v1.16.0
- **Init command**: Renamed from update (deprecation warning)
- **Fresh installation**: --fresh flag for clean reinstall
- **Beta versions**: --beta flag for pre-release visibility
- **Command prefix**: --prefix flag for /ck: namespace
- **Optional packages**: OpenCode and Gemini integration
- **Skills dependencies**: --install-skills for auto-setup
- **Update notifications**: 7-day cached version checks with color-coded display
- **Release caching**: Configurable TTL for release data
- **Parallel file tracking**: Batch processing with p-limit for faster installs
- **Platform optimizations**: macOS native unzip fallback, adaptive concurrency
- **Slow extraction warnings**: 30-second threshold notifications
- **Environment detection**: Platform-aware concurrency tuning (macOS: 10, Windows: 15, Linux: 20)
- **Smart Kit Detection for `ck update`**: Automatic detection of installed kits; displays kit-specific commands (e.g., `ck init --kit engineer --yes --install-skills`) instead of generic ones

### Multi-Kit Support (Phase 1 - IN PROGRESS)
- **Selective merge with multi-kit awareness**: Detects and reuses files shared across kits
- **Smart file comparison**: Hybrid size+checksum comparison for efficient copy decisions
- **Version-aware merging**: Semver comparison prevents overwriting newer versions from other kits
- **Shared file tracking**: Identifies files owned by multiple kits and skips redundant copies
- **Cross-kit file detection**: `findFileInInstalledKits()` locates files across installed kits
- **Kit-scoped uninstall**: Safely remove one kit while preserving shared files from other kits
- **Multi-kit metadata**: Extended metadata format tracks per-kit file ownership and versions

### Multi-Tier Authentication
Flexible authentication with automatic fallback for seamless UX across environments.

### Smart File Merging
Intelligent conflict handling and customization preservation during updates.

### Skills Migration System
Automated migration from flat to categorized structures with zero data loss guarantee.

### Global Path Resolution
Platform-aware paths with XDG compliance and Windows support.

### Version Management
Interactive version selection, beta version support, release caching.

### Dependency Management
Auto-detection and installation of system dependencies (doctor command).

## Error Handling

### Error Types
- Structured error classes with status codes
- User-friendly error messages
- Stack traces in verbose mode
- Graceful fallbacks (asset → tarball)
- Migration-specific errors with rollback

### Recovery Mechanisms
- Automatic fallback to tarball on asset failure
- Temporary directory cleanup on errors
- Safe prompt cancellation
- Non-TTY environment detection
- Backup restoration on migration failure

## Integration Points

### External Services
- GitHub API: Repository and release management
- npm Registry: Package distribution
- OS Keychain: Secure credential storage (macOS, Linux, Windows)
- Discord Webhooks: Release notifications

### File System
- Configuration (local): ~/.claudekit/config.json
- Configuration (global): Platform-specific (XDG-compliant)
- Cache: ~/.claudekit/cache or platform-specific
- Global kit installation: ~/.claude/
- Local project installations: {project}/.claude/
- Skills manifest: .claude/skills/.skills-manifest.json
- Skills backups: .claude/backups/skills/
- Temporary files: OS temp directory

## Development Workflow

### Local Development
```bash
bun install              # Install dependencies
bun run dev              # Run in development mode
bun test                 # Run tests
bun run typecheck        # Type checking
bun run lint             # Lint code
bun run format           # Format code
```

### Binary Compilation
```bash
bun run compile          # Compile standalone binary
bun run compile:binary   # Compile to bin/ck
bun run build:platform-binaries  # Build all platforms
```

## Testing Strategy

### Test Coverage
- Unit tests for all core libraries
- Command integration tests
- Authentication flow tests
- Download and extraction tests
- Skills migration system tests (6 test files)
- Doctor command tests (50 tests, 324 assertions)

### Test Files Structure
- Mirrors source structure (tests/ matches src/)
- Uses Bun's built-in test runner
- Setup/teardown for filesystem operations
- Temporary directories for isolation

## Process Lock Architecture

### Lock Management (src/shared/process-lock.ts)
- **Stale timeout**: 1 minute (faster recovery from orphaned locks)
- **Global exit handler**: Registered once per process, covers all termination paths
- **Active locks registry**: Set<string> tracks lock names for cleanup on unexpected exit
- **Cleanup strategy**: Synchronous cleanup on 'exit' event (fires for signals, process.exit(), natural drain)
- **Best-effort release**: Errors swallowed during cleanup (process terminating anyway)
- **Integration point**: Used by `withProcessLock<T>(lockName, fn)` for concurrent operation prevention

### Usage Pattern
```typescript
// Inside command handlers: throw instead of process.exit(1)
// Process-lock will handle graceful cleanup on unexpected termination
await withProcessLock("engineer-install", async () => {
  // Operation with lock protection
  throw new Error("User cancelled"); // ← Throws, not process.exit()
});
```

## Recent Improvements

- **#412 Idempotent migration**: 3-phase reconciliation pipeline, Registry v3.0, portable manifest, CLI/Dashboard conflict resolution
- **#346 Stale lock fix**: Global exit handler, activeLocks registry, 1-min timeout
- **#344 Installation detection**: Fallback support for installs without metadata.json
- **#343 Dev prerelease suppression**: Hide dev→stable update notifications
- **Skills command**: Renamed from `skill` to `skills`, multi-select, registry + uninstall
- **Deletion handling**: Glob pattern support via picomatch, cross-platform path.sep
- **#339 Sync validation**: Filter deletion paths before validation
