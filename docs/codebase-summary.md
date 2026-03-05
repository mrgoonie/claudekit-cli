# Codebase Summary

## Overview

ClaudeKit CLI is a command-line tool for bootstrapping and updating ClaudeKit projects from private GitHub repository releases. Built with Bun and TypeScript, it provides secure, fast project setup and maintenance with comprehensive features for downloading, extracting, and merging project templates.

**Version**: 3.32.0-dev.3 (next stable: 3.32.0)
**Architecture**: Modular domain-driven with facade patterns
**Total TypeScript Files**: 334+ source files (122 focused modules + content daemon)
**Commands**: 14 (new, init, skills, doctor, uninstall, versions, update-cli, content, config, setup, agents, commands, plan, migrate)
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
│   │   ├── content/              # Content daemon (NEW)
│   │   │   ├── index.ts
│   │   │   ├── content-command.ts      # Main daemon orchestrator
│   │   │   ├── content-subcommands.ts  # start/stop/status/logs/etc
│   │   │   ├── content-review-commands.ts  # approve/reject logic
│   │   │   ├── types.ts
│   │   │   └── phases/           # 30+ phase handlers
│   │   │       ├── git-scanner.ts
│   │   │       ├── event-classifier.ts
│   │   │       ├── content-creator.ts
│   │   │       ├── output-parser.ts
│   │   │       ├── platform-adapters/
│   │   │       │   ├── x-adapter.ts
│   │   │       │   ├── facebook-adapter.ts
│   │   │       │   └── rate-limiter.ts
│   │   │       ├── review-manager.ts
│   │   │       ├── publisher.ts
│   │   │       ├── engagement-tracker.ts
│   │   │       ├── db-manager.ts
│   │   │       └── ... (15+ more phases)
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
Orchestrator + phase handlers: options-resolver, selection-handler, download-handler, migration-handler, merge-handler, conflict-handler, transform-handler, post-install-handler.

#### new/ - Project Creation (3 phases)
Orchestrator + phase handlers: directory-setup, project-creation, post-setup.

#### skills/ - Skills Management (multi-select, registry, uninstall)
Renamed from `skill` command. Includes detection, installation, uninstall, and registry tracking of skills across agents.

#### uninstall/ - ClaudeKit Uninstaller
Detection, analysis, and safe removal with fallback for installations without metadata.json.

#### update-cli.ts - CLI Self-Update with Smart Kit Detection
Detects installed kits, builds kit-specific init commands (e.g., `ck init --kit engineer --yes --install-skills`), performs parallel version checks with non-blocking fallback.

#### migrate/ + portable/ - Idempotent Reconciliation Pipeline
3-phase RECONCILE → EXECUTE → REPORT pipeline for safe repeated migrations. Pure reconciler (zero I/O, 8-case decision matrix), Registry v3.0 with SHA-256 checksums, portable manifest for cross-version evolution. Interactive CLI conflict resolution with diff preview. Dashboard UI with plan viewer and conflict resolver. See `docs/reconciliation-architecture.md`.

#### content/ - Social Content Daemon (NEW)
Multi-daemon for monitoring Git repos and publishing social content via Claude CLI:
- `content-command.ts`: Main daemon orchestrator (daemon lifecycle, signal handling)
- `content-subcommands.ts`: start/stop/status/logs/setup/queue subcommands
- `content-review-commands.ts`: approve/reject content
- `types.ts`: Zod schemas (ContentStatus, GitEventType, Platform, ContentConfig, ContentState)
- `phases/`: 30+ phase handlers:
  - **Scanning**: `git-scanner.ts` (repo discovery, commit/PR/tag/plan detection)
  - **Classification**: `event-classifier.ts` (categorize git events)
  - **Generation**: `content-creator.ts` (Claude CLI invocation, 4-strategy JSON parser, validation)
  - **Parsing**: `output-parser.ts` (robust JSON parsing with fallbacks)
  - **Platforms**: `platform-adapters/{x,facebook}-adapter.ts`, `rate-limiter.ts`
  - **Review**: `review-manager.ts` (auto/manual/hybrid modes), `content-preview.ts`
  - **Publishing**: `publisher.ts` (multi-platform orchestration)
  - **Database**: `db-manager.ts`, `db-queries.ts`, `db-queries-{git-events,content-items}.ts` (SQLite WAL, schema)
  - **Analytics**: `engagement-tracker.ts`, `performance-analyzer.ts`
  - **Setup**: `setup-wizard.ts`, `platform-setup-{x,facebook}.ts` (@clack/prompts interactive)
  - **State**: `state-manager.ts` (.ck.json integration)
  - **Logging**: `content-logger.ts` (structured file + console logging)

### 2. Domain Layer (src/domains/)

Business logic by domain with facade pattern.

**config/** - Config management, merger with conflict resolution
**github/** - GitHub API client, auth (GitHub CLI only), npm registry
**health-checks/** - Doctor command: parallel checkers for system, auth, GitHub, ClaudeKit, platform, network
**installation/** - Download, extract (ZIP/TAR), merge (selective, multi-kit aware), package manager detection
**skills/** - Detection, customization scanning, migration with backup/rollback
**ui/** - Interactive prompts (kit/version selection, confirmations), ownership display
**versioning/** - Version checking (CLI/kit), caching (7-day TTL), selection UI

### 3. Services Layer (src/services/)

Cross-domain concerns (file-operations, package-installer, transformers)

### 4. Shared Layer (src/shared/)

Pure utilities (logger, path-resolver, environment, progress-bar, safe-prompts, terminal-utils)

## Data Flow & Security

**Project Creation**: Validate options → Authenticate → Select kit/version → Download → Extract → Copy files
**Project Update**: Validate options → Auth → Select version → Download → Detect migration → Merge → Success
**Auth Flow**: GH CLI (primary) with fallback to env vars and keychain
**Security**: Token sanitization, path traversal prevention, archive bomb detection (500MB limit), protected file preservation

## Key Features

- **Multi-tier auth**: GitHub CLI (primary) with fallback
- **Smart merging**: Conflict detection, customization preservation
- **Skills migration**: Flat → categorized structures with rollback
- **Global paths**: XDG-compliant with Windows support
- **Multi-kit support**: Phase 1 selective merge with shared file tracking
- **Doctor command**: System dependency detection and installation
- **Version caching**: 7-day cache, beta support
- **Content daemon**: Git monitoring, social content generation, multi-platform publishing
- **Idempotent migration**: 3-phase reconciliation pipeline with Registry v3.0

## Recent Improvements

- **#412 Idempotent migration**: 3-phase reconciliation pipeline, Registry v3.0, portable manifest, CLI/Dashboard conflict resolution
- **#346 Stale lock fix**: Global exit handler, activeLocks registry, 1-min timeout
- **#344 Installation detection**: Fallback support for installs without metadata.json
- **#343 Dev prerelease suppression**: Hide dev→stable update notifications
- **Skills command**: Renamed from `skill` to `skills`, multi-select, registry + uninstall
- **Deletion handling**: Glob pattern support via picomatch, cross-platform path.sep
- **#339 Sync validation**: Filter deletion paths before validation
