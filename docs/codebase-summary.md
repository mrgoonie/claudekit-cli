# Codebase Summary

## Overview

ClaudeKit CLI is a command-line tool for bootstrapping and updating ClaudeKit projects from private GitHub repository releases. Built with Bun and TypeScript, it provides secure, fast project setup and maintenance with comprehensive features for downloading, extracting, and merging project templates. Now includes automated skills directory migration system.

## Technology Stack

### Runtime & Build Tools
- **Bun**: Primary runtime and package manager (>=1.0.0)
- **TypeScript**: Type-safe development (v5.7.2)
- **Node.js**: Compatible with Node.js environments

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

### Development Tools
- **Biome**: Fast linting and formatting
- **Semantic Release**: Automated versioning and publishing
- **GitHub Actions**: CI/CD automation with multi-platform binary builds

### Target Platforms
- **macOS**
- **Linux**
- **Windows**

## Project Structure

```
claudekit-cli/
├── bin/                           # Binary distribution
│   └── ck.js                      # Platform detection wrapper script
├── src/                           # Source code
│   ├── commands/                  # Command implementations
│   │   ├── new.ts                # Create new project command
│   │   ├── update.ts             # Update existing project command (global flag support)
│   │   ├── version.ts            # List available versions command
│   │   ├── diagnose.ts           # Diagnostic command
│   │   └── doctor.ts             # System diagnostics & dependency installer
│   ├── lib/                       # Core business logic
│   │   ├── auth.ts               # Multi-tier authentication manager
│   │   ├── github.ts             # GitHub API client wrapper
│   │   ├── download.ts           # Download and extraction manager
│   │   ├── merge.ts              # Smart file merger with conflict detection
│   │   ├── prompts.ts            # Interactive prompt manager
│   │   ├── skills-manifest.ts    # Manifest generation and validation
│   │   ├── skills-detector.ts    # Migration detection (manifest + heuristics)
│   │   ├── skills-migrator.ts    # Migration orchestrator
│   │   ├── skills-backup-manager.ts      # Backup and restore manager
│   │   ├── skills-customization-scanner.ts  # Customization detector
│   │   ├── skills-mappings.ts    # Category mappings
│   │   └── skills-migration-prompts.ts   # Migration UI prompts
│   ├── utils/                     # Utility modules
│   │   ├── config.ts             # Configuration manager with global flag
│   │   ├── path-resolver.ts      # Platform-aware path resolution (XDG-compliant)
│   │   ├── logger.ts             # Logging with sanitization
│   │   ├── file-scanner.ts       # File discovery and custom file detection
│   │   ├── safe-prompts.ts       # Promise-safe prompt wrapper
│   │   ├── safe-spinner.ts       # Safe spinner for CI environments
│   │   ├── claudekit-scanner.ts  # ClaudeKit project detection
│   │   ├── dependency-checker.ts # Dependency validation
│   │   ├── dependency-installer.ts # Dependency installation
│   │   ├── directory-selector.ts # Directory selection
│   │   └── package-installer.ts  # Package manager detection
│   ├── index.ts                   # CLI entry point
│   └── types.ts                   # Type definitions and schemas
├── tests/                         # Comprehensive test suite
│   ├── commands/                  # Command tests
│   ├── lib/                       # Library tests (including 6 skills tests)
│   ├── utils/                     # Utility tests
│   └── integration/               # Integration tests
├── docs/                          # Documentation
├── plans/                         # Implementation plans and reports
├── .github/workflows/             # CI/CD configuration
│   ├── release.yml               # Release automation
│   └── build-binaries.yml        # Multi-platform binary builds
├── package.json                   # Package manifest
└── tsconfig.json                  # TypeScript configuration
```

## Key Components

### 1. Command Layer (`src/commands/`)

#### new.ts - Project Creation
- Creates new ClaudeKit projects from releases
- Interactive kit selection
- Directory validation and conflict handling
- Support for force overwrite and exclude patterns
- Non-interactive mode for CI environments

#### update.ts - Project Updates
- Updates existing projects to new versions
- Smart preservation of custom .claude files
- Protected file detection and merging
- Conflict detection with user confirmation
- **Global flag support (`--global` / `-g`) for platform-specific config paths**
- **Integrated skills migration detection and execution**
- Manifest generation after successful update

#### version.ts - Version Listing
- Lists available releases for all kits
- Filter by kit type
- Shows release metadata (date, assets, prerelease status)
- Parallel fetching for multiple kits

#### diagnose.ts - Authentication & Access Diagnostics
- GitHub authentication verification
- Repository access checks
- Release availability validation
- Verbose logging support

#### doctor.ts - System Diagnostics & Dependency Installer
**Core Features:**
- **Dependency checking**: Claude CLI, Python (3.8+), pip, Node.js (16+), npm
- **Auto-installation**: Interactive installation with user confirmation
- **Platform detection**: OS-specific methods (macOS, Linux, Windows, WSL)
- **Package managers**: Homebrew, apt, dnf, pacman, PowerShell scripts
- **ClaudeKit setup**: Global and project installation detection
- **Component counts**: Displays agents, commands, workflows, skills
- **Non-interactive mode**: CI/CD safe (no prompts, manual instructions only)
- **Manual fallback**: Instructions when auto-install unavailable

**Security:**
- User confirmation required in interactive mode
- No automatic sudo/admin elevation
- Clear installation method descriptions
- Platform-specific safety checks

**Test Coverage:**
- 50 passing tests with 324 assertions
- Platform-specific installation logic
- Edge cases and error handling
- Non-interactive environment detection

#### uninstall.ts - ClaudeKit Uninstaller
- Detects and removes ClaudeKit installations
- Validates installations via metadata.json
- Interactive confirmation before deletion
- Non-interactive mode (--yes flag)
- Cross-platform safe deletion with rmSync
- Separate detection for local and global installations

### 2. Core Library (`src/lib/`)

#### auth.ts - Authentication Manager
Multi-tier authentication fallback:
1. GitHub CLI (`gh auth token`)
2. Environment variables (`GITHUB_TOKEN`, `GH_TOKEN`)
3. Configuration file (`~/.claudekit/config.json`)
4. OS Keychain (via keytar)
5. User prompt with secure storage option

Features:
- Token format validation
- Secure keychain integration
- In-memory token caching
- Authentication method tracking

#### github.ts - GitHub Client
- Octokit-based GitHub API wrapper
- Release fetching (latest or by tag)
- Repository access verification
- Smart asset selection:
  1. ClaudeKit official package assets (priority)
  2. Custom uploaded archives
  3. GitHub automatic tarball (fallback)
- Comprehensive error handling with status codes

#### download.ts - Download Manager
Core features:
- Streaming downloads with progress bars
- Archive extraction (TAR.GZ and ZIP)
- Path traversal protection (zip slip prevention)
- Archive bomb prevention (500MB limit)
- Wrapper directory detection and stripping
- Exclude pattern support
- Percent-encoded path handling

Security:
- Path safety validation
- Extraction size tracking
- Malicious path detection
- Secure temporary directory handling

#### merge.ts - File Merger
- Smart file conflict detection
- Protected pattern matching
- User confirmation for overwrites
- Selective file preservation
- Protected files only when they exist in destination

#### prompts.ts - Interactive Prompts
- Beautiful CLI interface using @clack/prompts
- Kit selection
- Directory input
- Confirmation dialogs
- Intro/outro messaging

#### Skills Migration System (7 modules)

**skills-manifest.ts - Manifest Manager**
- Generates `.skills-manifest.json` for structure tracking
- SHA-256 hashing for change detection
- Supports flat and categorized structures
- Manifest validation via Zod schema
- Compares manifests to detect skill modifications

**skills-detector.ts - Migration Detector**
- Manifest-based detection with heuristic fallback
- Detects flat → categorized structure transitions
- Scans directories to identify structure type
- Generates skill mappings for migration
- Validates migration necessity

**skills-migrator.ts - Migration Orchestrator**
- Coordinates full migration workflow
- Interactive prompts for user decisions
- Backup creation before migration
- File movement with category organization
- Rollback on failure
- Preserves customizations during migration

**skills-backup-manager.ts - Backup Manager**
- Creates timestamped backups with compression
- Stores backups in `.claude/backups/skills/`
- Validates backup integrity
- Restores from backup on failure
- Cleanup of old backups

**skills-customization-scanner.ts - Customization Scanner**
- Detects user modifications via hash comparison
- Identifies new files not in baseline
- Supports both flat and categorized structures
- Reports customization details for user review
- Prevents accidental overwrite of custom work

**skills-mappings.ts - Category Mappings**
- Maps skills to categories (content, design, planning, etc.)
- Provides path mappings (old → new)
- Lists migratable skills
- Extensible category definitions

**skills-migration-prompts.ts - Interactive Prompts**
- Migration decision confirmation
- Preview of changes before execution
- Backup creation prompts
- Per-skill customization handling
- Summary reporting post-migration

### 3. Utilities (`src/utils/`)

#### config.ts - Configuration Manager
- Loads/saves user configuration
- Default kit and directory settings
- Token storage (delegates to keychain)
- JSON-based config file with global flag support
- Local mode: `~/.claudekit/config.json` (backward compatible)
- Global mode: platform-specific paths via PathResolver

#### path-resolver.ts - Path Resolver
- Platform-aware path resolution for config and cache directories
- XDG Base Directory compliance for Linux/macOS
- Windows %LOCALAPPDATA% integration
- **NEW: Global path resolution methods (v1.5.1+)**
  - `getPathPrefix(global)`: Returns ".claude" for local, "" for global
  - `buildSkillsPath(baseDir, global)`: Builds skills directory paths
  - `buildComponentPath(baseDir, component, global)`: Builds component paths
- Global mode:
  - macOS/Linux: `~/.config/claude/config.json`
  - Windows: `%LOCALAPPDATA%\claude\config.json`
- Local mode (default): `~/.claudekit/config.json`
- **Pattern matching support** for local vs global directory structures
- **Cross-platform path handling** with proper fallbacks

#### logger.ts - Logger
- Verbose mode support
- Token sanitization for security
- Multiple log levels (debug, info, success, warning, error)
- Log file output support
- Environment variable activation

#### file-scanner.ts - File Scanner
- Recursive directory scanning
- Custom file detection (finds files in dest but not in source)
- Relative path handling
- Used for preserving custom .claude files

#### safe-prompts.ts & safe-spinner.ts
- CI-safe wrappers for interactive components
- Graceful fallback in non-TTY environments
- Error handling for cancelled prompts

#### claudekit-scanner.ts - ClaudeKit Setup Detection
- Scans for global and project .claude directories
- Reads metadata.json for version information
- Counts components (agents, commands, workflows, skills)
- Validates skill directories (SKILL.md presence)

#### dependency-checker.ts - Dependency Validation
- Checks Claude CLI, Python, pip, Node.js, npm
- Command existence verification (PATH lookup)
- Version extraction and semantic comparison
- Minimum version requirement validation
- CI environment detection with mock data

#### dependency-installer.ts - Cross-Platform Installation
- OS detection (macOS, Linux, Windows, WSL)
- Package manager detection (Homebrew, apt, dnf, pacman)
- Installation method selection with priority
- Interactive installation with user confirmation
- Manual installation instruction generation
- Platform-specific command execution

### 4. Type System (`src/types.ts`)

#### Schemas (Zod-based)
- `KitType`: Enum for kit types (engineer, marketing)
- `ExcludePatternSchema`: Validates exclude patterns
- `NewCommandOptionsSchema`: New command options
- `UpdateCommandOptionsSchema`: Update command options
- `VersionCommandOptionsSchema`: Version command options
- `ConfigSchema`: User configuration
- `GitHubReleaseSchema`: GitHub release data
- `KitConfigSchema`: Kit configuration
- `SkillsManifestSchema`: Skills manifest structure
- `SkillMappingSchema`: Migration mappings
- `MigrationDetectionResultSchema`: Detection results

#### Custom Error Types
- `ClaudeKitError`: Base error class
- `AuthenticationError`: Authentication failures
- `GitHubError`: GitHub API errors
- `DownloadError`: Download failures
- `ExtractionError`: Archive extraction failures
- `SkillsMigrationError`: Migration failures

#### Constants
- `AVAILABLE_KITS`: Kit repository configurations
- `PROTECTED_PATTERNS`: File patterns to skip during updates

## Data Flow

### New Project Flow
1. Parse and validate command options
2. Authenticate with GitHub (multi-tier fallback)
3. Select kit (interactive or via flag)
4. Validate target directory
5. Verify repository access
6. Fetch release (latest or specific version)
7. Download archive (asset or tarball)
8. Extract to temporary directory
9. Apply exclude patterns
10. Copy files to target directory
11. Success message with next steps

### Update Project Flow
1. Parse and validate command options
2. Authenticate with GitHub
3. Select kit
4. Validate existing project directory
5. Verify repository access
6. Fetch release
7. Download and extract to temp directory
8. Detect skills migration need (manifest or heuristics)
9. Execute migration if needed (with backup/rollback)
10. Scan for custom .claude files in destination
11. Merge files with conflict detection
12. Protect custom files and patterns
13. User confirmation for overwrites
14. Generate new skills manifest
15. Success message

### Skills Migration Flow
```
Detection (Manifest or Heuristics)
    ↓
User Confirmation (Interactive Mode)
    ↓
Backup Creation
    ↓
Migration Execution (Copy to temp → Remove old → Rename temp)
    ↓
Generate New Manifest
    ↓
Success or Rollback on Error
```

### Authentication Flow
```
Try GH CLI → Try Env Vars → Try Config → Try Keychain → Prompt User
     ↓            ↓             ↓            ↓              ↓
  Success      Success       Success      Success     Save to Keychain?
     ↓            ↓             ↓            ↓              ↓
   Use Token   Use Token    Use Token   Use Token     Use Token
```

## Testing Strategy

### Test Coverage
- Unit tests for all core libraries
- Command integration tests
- Authentication flow tests
- Download and extraction tests
- File scanner tests
- GitHub API interaction tests
- Type validation tests
- **Skills migration system tests (6 test files)**
  - Manifest generation and validation
  - Structure detection (manifest + heuristics)
  - Migration orchestration
  - Backup and restore
  - Customization scanning
  - Category mappings

### Test Files Structure
- Mirrors source structure (`tests/` matches `src/`)
- Uses Bun's built-in test runner
- Includes setup/teardown for filesystem operations
- Uses temporary directories for isolation
- **Doctor command tests**: 50 passing tests with 324 assertions
- **Overall coverage**: High test coverage across all modules

## Build & Distribution

### Binary Compilation
- Bun's `--compile` flag for standalone binaries
- Multi-platform builds:
  - macOS (arm64, x64)
  - Linux (x64)
  - Windows (x64)
- Platform detection wrapper script (`bin/ck.js`)
- GitHub Actions workflow for automated builds

### NPM Distribution
- Published to npm registry
- Includes compiled binaries in package
- Global installation via npm, yarn, pnpm, or bun
- Semantic versioning with automated releases

## Security Considerations

### Authentication Security
- Token never logged or exposed
- Automatic sanitization in verbose logs
- Keychain integration for secure storage
- Token format validation

### Download Security
- Path traversal prevention (zip slip protection)
- Archive bomb detection (size limits)
- Safe path validation
- Protected pattern enforcement

### Migration Security
- SHA-256 hashing for tamper detection
- Backup before any file operations
- Rollback on error
- Zero data loss guarantee

### Protected Files
Always skipped during updates:
- `.env`, `.env.local`, `.env.*.local`
- `*.key`, `*.pem`, `*.p12`
- `node_modules/**`, `.git/**`
- `dist/**`, `build/**`
- User-specified `.gitignore`, `.repomixignore`, `.mcp.json`, `CLAUDE.md`

## Configuration Files

### package.json
- Scripts for dev, build, test, lint, format, typecheck
- Binary entry point: `./bin/ck.js`
- Bun engine requirement: >=1.0.0

### tsconfig.json
- Target: ES2022
- Module: ESNext
- Strict mode enabled
- Source maps and declarations
- Output to `./dist`

### biome.json
- Fast linting and formatting configuration
- Consistent code style enforcement

### .releaserc.json
- Semantic Release configuration
- Automated changelog generation
- NPM publishing automation
- GitHub release creation

## Key Features

### Global Path Resolution (NEW v1.5.1+)
Comprehensive path resolution system supporting both local and global installation modes:
- **Centralized PathResolver utilities** with 3 new methods
- **Pattern matching** for automatic directory structure detection
- **Cross-platform compatibility** with XDG compliance
- **Backward compatibility** with existing local installations
- **Platform-specific paths**: Windows (%LOCALAPPDATA%), macOS/Linux (XDG-compliant)

### Multi-Tier Authentication
Provides flexible authentication with automatic fallback to ensure seamless user experience across different environments.

### Smart File Merging
Intelligently handles file conflicts and preserves user customizations while updating projects.

### Exclude Patterns
User-defined glob patterns to skip specific files during download and merge, with security restrictions.

### Custom .claude File Preservation
Automatically detects and protects custom .claude files that don't exist in the new release.

### Skills Migration System
Automated migration from flat to categorized skill directory structures:
- Manifest-based structure detection with heuristic fallback
- SHA-256 hashing for customization detection
- Interactive prompts with user control
- Automatic backup before migration
- Rollback on failure
- Zero data loss guarantee

### Wrapper Directory Detection
Automatically detects and strips version/release wrapper directories from archives.

### Progress Tracking
Visual progress bars for downloads and spinners for long operations.

### Verbose Mode
Detailed logging for debugging with automatic token sanitization.

## Performance Characteristics

### Optimizations
- Streaming downloads (no memory buffering)
- Parallel release fetching for versions command
- In-memory token caching
- Efficient glob pattern matching
- SHA-256 hashing for change detection

### Resource Limits
- Maximum extraction size: 500MB
- Request timeout: 30 seconds
- Progress bar chunk size: 1MB

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

## File Statistics

### Largest Files by Token Count (from Repomix)
1. `README.md` (6,406 tokens)
2. `tests/lib/skills-backup-manager.test.ts` (5,004 tokens)
3. `tests/lib/skills-customization-scanner.test.ts` (4,584 tokens)
4. `CHANGELOG.md` (4,528 tokens)
5. `tests/lib/skills-migrator.test.ts` (4,468 tokens)

### Total Metrics (from Repomix)
- Total Files: 74 files (29 TypeScript source files)
- Total Tokens: 125,461 tokens
- Total Characters: 482,233 characters
- Output Format: XML (repomix-output.xml)
- Test Coverage: 148/152 tests passing (97.4%)

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
```

### CI/CD Pipeline
1. Code pushed to main branch
2. Build binaries for all platforms (parallel)
3. Run type checking, linting, and tests
4. Semantic Release determines version bump
5. Create GitHub release with binaries
6. Publish to npm registry
7. Notify Discord webhook

## Integration Points

### External Services
- GitHub API: Repository and release management
- npm Registry: Package distribution
- OS Keychain: Secure credential storage
- Discord Webhooks: Release notifications

### File System
- **Configuration**: `~/.claudekit/config.json` (local) or platform-specific global paths
- **Global kit installation**: `~/.claude/` (cross-platform)
- **Local project installations**: `{project}/.claude/`
- **Skills manifest**: `.claude/skills/.skills-manifest.json` or `~/.claude/skills/.skills-manifest.json`
- **Skills backups**: `.claude/backups/skills/` or `~/.claude/backups/skills/`
- **Temporary files**: OS temp directory
- **Target directories**: User-specified locations

## Future Considerations

### Planned Improvements
- Marketing kit support (infrastructure ready)
- Enhanced progress reporting
- Diff preview before merging
- Update notifications
- Plugin system

### Extensibility
- Modular command structure for easy additions
- Pluggable authentication providers
- Customizable protected patterns
- Kit configuration extensibility
- Category mappings extensibility
