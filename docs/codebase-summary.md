# Codebase Summary

## Overview

ClaudeKit CLI is a command-line tool for bootstrapping and updating ClaudeKit projects from private GitHub repository releases. Built with Bun and TypeScript, it provides secure, fast project setup and maintenance with comprehensive features for downloading, extracting, and merging project templates.

**Version**: 1.16.0
**Total TypeScript Files**: 44 (30 source + 14 test support)
**Commands**: 6 (new, init/update, versions, doctor, diagnose, uninstall)
**Core Libraries**: 23 modules
**Utilities**: 14 modules

## Technology Stack

### Runtime & Build Tools
- **Bun**: Primary runtime and package manager (>=1.3.2)
- **TypeScript**: Type-safe development (v5.7.2, strict mode)
- **Node.js**: Compatible with Node.js LTS environments

### Core Dependencies
- **@octokit/rest**: GitHub API client for repository interactions
- **@clack/prompts**: Beautiful interactive CLI prompts
- **cac**: Command-line argument parser
- **keytar**: Secure credential storage using OS keychain
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
├── src/                          # Source code (43 TS files)
│   ├── commands/                 # Command implementations (6 files)
│   │   ├── new.ts               # Create new project
│   │   ├── update.ts            # Update existing project (init alias)
│   │   ├── version.ts           # List available versions
│   │   ├── diagnose.ts          # Authentication diagnostics
│   │   ├── doctor.ts            # System dependencies checker/installer
│   │   └── uninstall.ts         # Uninstall ClaudeKit installations
│   ├── lib/                      # Core business logic (23 files)
│   │   ├── auth.ts              # Multi-tier authentication manager
│   │   ├── github.ts            # GitHub API client wrapper
│   │   ├── download.ts          # Download and extraction manager
│   │   ├── merge.ts             # Smart file merger with conflict detection
│   │   ├── ownership-checker.ts # File ownership tracking via checksums
│   │   ├── prompts.ts           # Interactive prompt manager
│   │   ├── release-cache.ts     # Release data caching
│   │   ├── release-filter.ts    # Release filtering logic
│   │   ├── version-cache.ts     # Version check caching
│   │   ├── version-checker.ts   # Update notification system
│   │   ├── version-display.ts   # Version formatting
│   │   ├── version-formatter.ts # Release date formatting
│   │   ├── version-selector.ts  # Interactive version selection
│   │   ├── fresh-installer.ts   # Fresh installation handler
│   │   ├── commands-prefix.ts   # Command namespace transformer
│   │   ├── global-path-transformer.ts # Global path transformations
│   │   ├── skills-manifest.ts   # Manifest generation and validation
│   │   ├── skills-detector.ts   # Migration detection
│   │   ├── skills-migrator.ts   # Migration orchestrator
│   │   ├── skills-backup-manager.ts  # Backup and restore
│   │   ├── skills-customization-scanner.ts  # Customization detector
│   │   ├── skills-mappings.ts   # Category mappings
│   │   └── skills-migration-prompts.ts  # Migration UI
│   ├── utils/                    # Utility modules (14 files)
│   │   ├── config.ts            # Configuration manager
│   │   ├── path-resolver.ts     # Platform-aware path resolution
│   │   ├── logger.ts            # Logging with sanitization
│   │   ├── file-scanner.ts      # File discovery
│   │   ├── safe-prompts.ts      # Promise-safe prompt wrapper
│   │   ├── safe-spinner.ts      # Safe spinner for CI
│   │   ├── claudekit-scanner.ts # ClaudeKit project detection
│   │   ├── dependency-checker.ts  # Dependency validation
│   │   ├── dependency-installer.ts  # Dependency installation
│   │   ├── directory-selector.ts  # Directory selection
│   │   ├── package-installer.ts # Package manager detection
│   │   ├── environment.ts       # Environment detection
│   │   └── ...
│   ├── index.ts                  # CLI entry point
│   └── types.ts                  # Type definitions and schemas
├── tests/                        # Comprehensive test suite
│   ├── commands/                 # Command tests
│   ├── lib/                      # Library tests
│   └── utils/                    # Utility tests
├── docs/                         # Documentation
├── plans/                        # Implementation plans
├── .github/workflows/            # CI/CD configuration
│   ├── release.yml              # Release automation
│   └── build-binaries.yml       # Multi-platform binary builds
├── package.json                  # Package manifest
└── tsconfig.json                 # TypeScript configuration
```

## Key Components

### 0. Help System (src/lib/help/)

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

#### new.ts - Project Creation
Create new ClaudeKit projects from releases with interactive or non-interactive mode.

**Features:**
- Interactive kit selection
- Directory validation
- Force overwrite option
- Exclude pattern support
- Optional package installation (OpenCode, Gemini)
- Skills dependencies installation
- Command prefix support (/ck: namespace)

#### update.ts - Project Updates (init alias)
Update existing projects while preserving customizations.

**Features:**
- Smart preservation of custom files
- Protected file detection
- Conflict detection with user confirmation
- Global flag support (--global/-g)
- Fresh installation mode (--fresh)
- Beta version display (--beta)
- Skills migration detection
- Command prefix support

**Deprecation**: update command renamed to init, shows deprecation warning

#### version.ts - Version Listing
List available releases with filtering and pagination.

**Features:**
- Filter by kit type
- Show beta/prerelease versions (--all)
- Configurable limit (default 30)
- Parallel fetching for multiple kits
- Release metadata display

#### diagnose.ts - Authentication & Access Diagnostics
Verify GitHub authentication and repository access.

**Features:**
- GitHub authentication verification
- Repository access checks
- Release availability validation
- Verbose logging support

#### doctor.ts - System Diagnostics & Dependency Installer
Check system dependencies and offer auto-installation.

**Features:**
- Checks Claude CLI, Python, pip, Node.js, npm
- Auto-installation with user confirmation
- Platform detection (macOS, Linux, Windows, WSL)
- Package manager support (Homebrew, apt, dnf, pacman)
- ClaudeKit setup detection (global and project)
- Component counts (agents, commands, workflows, skills)
- Non-interactive mode for CI/CD
- Manual fallback instructions

**Test Coverage:** 50 passing tests with 324 assertions

#### uninstall.ts - ClaudeKit Uninstaller
Remove ClaudeKit installations safely.

**Features:**
- Detects local and global installations
- Validates via metadata.json
- Interactive confirmation (unless --yes)
- Cross-platform safe deletion
- Clear path display before deletion

### 2. Core Library (src/lib/)

#### auth.ts - Authentication Manager
Multi-tier authentication fallback system.

**Tiers:**
1. GitHub CLI (gh auth token)
2. Environment variables (GITHUB_TOKEN, GH_TOKEN)
3. Config file (~/.claudekit/config.json)
4. OS Keychain (via keytar)
5. User prompt with save option

**Features:**
- Token format validation
- Secure keychain integration
- In-memory caching
- Authentication method tracking

#### github.ts - GitHub Client
Octokit-based GitHub API wrapper.

**Operations:**
- Release fetching (latest or by tag)
- Repository access verification
- Smart asset selection with priority
- Comprehensive error handling

**Asset Priority:**
1. ClaudeKit official package
2. Custom uploaded archives
3. GitHub automatic tarball (fallback)

#### download.ts - Download Manager
Streaming downloads with security validation.

**Features:**
- Streaming downloads with progress bars
- Archive extraction (TAR.GZ and ZIP)
- Path traversal protection
- Archive bomb prevention (500MB limit)
- Wrapper directory detection
- Exclude pattern support
- Percent-encoded path handling

#### merge.ts - File Merger
Smart file conflict detection and selective preservation.

**Features:**
- Conflict detection before merging
- Protected pattern matching
- User confirmation for overwrites
- Custom file preservation
- Merge statistics tracking

#### ownership-checker.ts - File Ownership Tracker
File ownership classification using SHA-256 checksums (pip RECORD pattern).

**Ownership Classifications:**
- **"ck"**: CK-owned and pristine (file in metadata with matching checksum)
- **"ck-modified"**: User-modified CK files (file in metadata with different checksum)
- **"user"**: User-created files (not in metadata)

**Core Methods:**
- `calculateChecksum(filePath)`: SHA-256 hash with streaming (memory-efficient)
- `checkOwnership(filePath, metadata, claudeDir)`: Classify single file ownership

**Features:**
- Memory-efficient streaming for large files
- Windows path normalization (backslash → forward slash)
- Fallback to "user" ownership for legacy installs (no metadata)
- Non-existent file handling (exists: false)

**Test Coverage:** 11 passing tests covering all ownership scenarios

#### Release Management (4 modules)
- **release-cache.ts**: Local caching of release data (default 1hr TTL)
- **release-filter.ts**: Filter releases by prerelease/draft status
- **version-cache.ts**: Update notification caching (7-day cache)
- **version-checker.ts**: Version comparison and update notifications
- **version-display.ts**: Formatted version output
- **version-formatter.ts**: Relative date formatting
- **version-selector.ts**: Interactive version selection UI

#### Installation Utilities (2 modules)
- **fresh-installer.ts**: Fresh installation with confirmation prompts
- **commands-prefix.ts**: Transform commands to /ck: namespace
- **global-path-transformer.ts**: Global path transformation utilities

#### Skills Migration System (7 modules)

**skills-manifest.ts**: Manifest generation with SHA-256 hashing
**skills-detector.ts**: Manifest-based + heuristic detection
**skills-migrator.ts**: Orchestrates migration workflow
**skills-backup-manager.ts**: Backup creation and restore
**skills-customization-scanner.ts**: Detects user modifications
**skills-mappings.ts**: Category to skill mappings
**skills-migration-prompts.ts**: Interactive migration prompts

**Migration Flow:**
```
Detection → User Confirmation → Backup → Migration → Manifest → Success/Rollback
```

### 3. Utilities (src/utils/)

#### config.ts - Configuration Manager
Manages user configuration with global flag support.

**Paths:**
- Local mode (default): ~/.claudekit/config.json
- Global mode: Platform-specific (XDG-compliant)

#### path-resolver.ts - Path Resolver
Platform-aware path resolution for config and cache.

**Methods:**
- getConfigDir(global): Config directory path
- getCacheDir(global): Cache directory path
- getPathPrefix(global): Directory prefix (".claude" or "")
- buildSkillsPath(baseDir, global): Skills directory path
- buildComponentPath(baseDir, component, global): Component paths
- getGlobalKitDir(): Global kit installation directory

**XDG Compliance:**
- Config: XDG_CONFIG_HOME or ~/.config
- Cache: XDG_CACHE_HOME or ~/.cache

#### logger.ts - Logger
Structured logging with token sanitization.

**Log Levels:**
- debug (verbose only)
- info
- success
- warning
- error
- verbose

**Security:**
- Token sanitization (ghp_*, github_pat_*)
- Log file output support
- Environment variable activation

#### file-scanner.ts - File Scanner
Recursive directory scanning and custom file detection.

**Operations:**
- getFiles(dir): All files with relative paths
- findCustomFiles(dest, source, subdir): Custom files in dest

#### Dependency Management (3 modules)
- **dependency-checker.ts**: Validates Claude CLI, Python, pip, Node.js, npm
- **dependency-installer.ts**: Cross-platform installation with package manager detection
- **package-installer.ts**: Detects npm, yarn, pnpm, bun

#### Environment & Safety (4 modules)
- **safe-prompts.ts**: CI-safe interactive prompt wrapper
- **safe-spinner.ts**: Safe spinner for non-TTY environments
- **claudekit-scanner.ts**: Detects ClaudeKit installations
- **environment.ts**: Environment detection utilities
- **directory-selector.ts**: Interactive directory selection

### 4. Type System (src/types.ts)

#### Zod Schemas (Runtime Validation)
- KitType: "engineer" | "marketing"
- ExcludePatternSchema: Validates exclude patterns
- NewCommandOptionsSchema: New command options
- UpdateCommandOptionsSchema: Update command options (with global flag)
- VersionCommandOptionsSchema: Version command options
- UninstallCommandOptionsSchema: Uninstall command options
- UpdateCliOptionsSchema: CLI self-update options
- ConfigSchema: User configuration
- GitHubReleaseSchema: GitHub API response
- KitConfigSchema: Kit configuration
- SkillsManifestSchema: Skills manifest structure
- InstallationOptionsSchema: Optional package installation
- FileOwnership: Type union ("ck" | "user" | "ck-modified")
- TrackedFileSchema: File tracking record with checksum and ownership
- MetadataSchema: Installation metadata with enhanced file tracking

#### Custom Error Types
- ClaudeKitError: Base error class
- AuthenticationError: Authentication failures (401)
- GitHubError: GitHub API errors
- DownloadError: Download failures
- ExtractionError: Archive extraction failures
- SkillsMigrationError: Migration failures

#### Constants
- AVAILABLE_KITS: Kit repository configurations
- PROTECTED_PATTERNS: File patterns to preserve during updates

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
- **Update notifications**: 7-day cached version checks
- **Release caching**: Configurable TTL for release data

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
