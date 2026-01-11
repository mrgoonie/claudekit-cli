# Codebase Summary

## Overview

ClaudeKit CLI is a command-line tool for bootstrapping and updating ClaudeKit projects from private GitHub repository releases. Built with Bun and TypeScript, it provides secure, fast project setup and maintenance with comprehensive features for downloading, extracting, and merging project templates.

**Version**: 1.16.0
**Architecture**: Modular domain-driven with facade patterns
**Total TypeScript Files**: 334 source files (122 new focused modules)
**Commands**: 6 (new, init/update, versions, doctor, diagnose, uninstall)
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
Each domain module exposes a facade file (e.g., `settings-merger.ts`) that:
- Re-exports public API from submodules
- Provides backward-compatible interface
- Hides internal implementation details

```typescript
// Example: domains/config/settings-merger.ts (Facade)
export { mergeSettings, validateMerge } from "./merger/merge-engine.js";
export { resolveConflicts } from "./merger/conflict-resolver.js";
export type { MergeResult, MergeOptions } from "./merger/types.js";
```

#### Phase Handler Pattern
Complex commands use orchestrator + phase handlers for single responsibility:

```typescript
// Example: commands/init/init-command.ts (Orchestrator)
export async function initCommand(options: InitOptions) {
  await resolveOptions(options);        // phases/options-resolver.ts
  await selectKitAndVersion(context);   // phases/selection-handler.ts
  await downloadRelease(context);       // phases/download-handler.ts
  await handleMigration(context);       // phases/migration-handler.ts
  await mergeFiles(context);            // phases/merge-handler.ts
  await applyTransforms(context);       // phases/transform-handler.ts
  await runPostInstall(context);        // phases/post-install-handler.ts
}
```

### 0. Help System (src/domains/help/)

#### help-types.ts - Type Definitions for Custom Help System
Foundation interfaces and types for the custom help renderer.

**Core Interfaces:**
- **CommandHelp**: Complete help data for a single command (name, description, usage, examples, optionGroups, sections, aliases, deprecated)
- **HelpExample**: Single usage example with command and description (max 2 per command)
- **OptionGroup**: Logical grouping of related options with title (e.g., "Output Options", "Filter Options")
- **OptionDefinition**: Single option with flags, description, defaultValue, and deprecation info
- **DeprecatedInfo**: Deprecation metadata (message, alternative, removeInVersion)
- **HelpSection**: Generic help section for additional content (notes, warnings, related commands)

**Rendering Configuration:**
- **ColorTheme**: Color theme interface with banner, command, heading, flag, description, example, warning, error, muted, success
- **ColorFunction**: Type for color formatting functions (respects NO_COLOR)
- **HelpOptions**: Renderer config (showBanner, showExamples, maxExamples, interactive, width, theme, noColor)
- **HelpRenderContext**: Context passed to renderer (command, globalHelp, options)

**Type Utilities:**
- **CommandRegistry**: Record<string, CommandHelp> for all command definitions
- **HelpFormatter**: Custom formatter function type (help, context) => string
- **GlobalHelp**: Global help data (name, description, version, usage, commands, globalOptions)

**Design Principles:**
- Conciseness over completeness (max 2 examples per command)
- Accessibility (NO_COLOR environment variable support)
- Extensibility (custom formatters, pluggable themes)
- Interactive support (scrolling for long content)

**Test Coverage:** 36 passing tests with 108 assertions

### 1. Command Layer (src/commands/)

Commands follow the orchestrator + phase handlers pattern for complex operations.

#### init/ - Project Initialization/Update
Modularized into orchestrator + 8 phase handlers:
- `init-command.ts`: Main orchestrator (~100 lines)
- `phases/options-resolver.ts`: Parse and validate options
- `phases/selection-handler.ts`: Kit and version selection
- `phases/download-handler.ts`: Release download
- `phases/migration-handler.ts`: Skills migration
- `phases/merge-handler.ts`: File merging
- `phases/conflict-handler.ts`: Conflict detection
- `phases/transform-handler.ts`: Path transformations
- `phases/post-install-handler.ts`: Post-install setup

#### new/ - Project Creation
Modularized into orchestrator + 3 phase handlers:
- `new-command.ts`: Main orchestrator
- `phases/directory-setup.ts`: Directory validation
- `phases/project-creation.ts`: Project creation
- `phases/post-setup.ts`: Optional packages, skills deps

#### uninstall/ - ClaudeKit Uninstaller
Modularized into command + handlers:
- `uninstall-command.ts`: Main command
- `installation-detector.ts`: Detect installations
- `analysis-handler.ts`: Analyze what to remove
- `removal-handler.ts`: Safe removal

#### update-cli.ts - CLI Self-Update with Smart Kit Detection
Checks for CLI updates and displays kit-specific reminder commands:
- **buildInitCommand()**: Helper function to construct init commands with appropriate flags
  - Parameters: `isGlobal` (boolean), `kit?` (KitType)
  - Returns: Command string like `ck init --kit engineer --yes --install-skills`
  - Always includes `--yes --install-skills` flags
- **displayKitUpdateReminder()**: Detects installed kits from metadata and shows:
  - Kit-specific commands instead of generic `ck init` or `ck init -g`
  - Parallel version checks for update availability (non-blocking)
  - Kit versions with available updates marked with green arrow
  - Smart padding alignment for multi-kit display
- Uses `readMetadataFile()` to parse full kit metadata including per-kit versions
- Integrates with `getInstalledKits()` for multi-kit detection

### 2. Domains Layer (src/domains/)

Business logic organized by domain with facade pattern.

#### config/ - Configuration Management
```
config/
├── index.ts
├── config-generator.ts
├── config-manager.ts
├── config-validator.ts
├── settings-merger.ts      # Facade
├── types.ts
└── merger/                 # Merge submodules
    ├── conflict-resolver.ts
    ├── diff-calculator.ts
    ├── file-io.ts
    ├── merge-engine.ts
    └── types.ts
```

#### github/ - GitHub API Integration
```
github/
├── github-auth.ts
├── github-client.ts        # Facade
├── npm-registry.ts
├── types.ts
└── client/                 # API submodules
    ├── asset-utils.ts
    ├── auth-api.ts
    ├── error-handler.ts
    ├── releases-api.ts
    └── repo-api.ts
```

#### health-checks/ - Doctor Command System
```
health-checks/
├── claudekit-checker.ts    # Facade (14 checkers)
├── platform-checker.ts     # Facade
├── check-runner.ts
├── auto-healer.ts
├── report-generator.ts
├── checkers/               # Individual checkers
│   ├── active-plan-checker.ts
│   ├── claude-md-checker.ts
│   ├── cli-install-checker.ts
│   ├── config-completeness-checker.ts
│   ├── hooks-checker.ts
│   ├── installation-checker.ts
│   ├── path-refs-checker.ts
│   ├── permissions-checker.ts
│   ├── settings-checker.ts
│   └── skills-checker.ts
├── platform/               # Platform-specific
│   ├── environment-checker.ts
│   ├── shell-checker.ts
│   └── windows-checker.ts
└── utils/
    ├── path-normalizer.ts
    └── version-formatter.ts
```

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

## Future Considerations

### Planned Improvements
- Marketing kit support (infrastructure ready)
- Enhanced progress reporting
- Diff preview before merging
- Plugin system

### Extensibility
- Modular command structure
- Pluggable authentication providers
- Customizable protected patterns
- Kit configuration extensibility
- Category mappings extensibility
