# Codebase Summary

## Overview

ClaudeKit CLI is a command-line tool for bootstrapping and updating ClaudeKit projects from private GitHub repository releases. Built with Bun and TypeScript, it provides secure, fast project setup and maintenance with comprehensive features for downloading, extracting, and merging project templates.

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

## Project Structure

```
claudekit-cli/
├── bin/                           # Binary distribution
│   └── ck.js                      # Platform detection wrapper script
├── src/                           # Source code
│   ├── commands/                  # Command implementations
│   │   ├── new.ts                # Create new project command
│   │   ├── update.ts             # Update existing project command
│   │   └── version.ts            # List available versions command
│   ├── lib/                       # Core business logic
│   │   ├── auth.ts               # Multi-tier authentication manager
│   │   ├── github.ts             # GitHub API client wrapper
│   │   ├── download.ts           # Download and extraction manager
│   │   ├── merge.ts              # Smart file merger with conflict detection
│   │   └── prompts.ts            # Interactive prompt manager
│   ├── utils/                     # Utility modules
│   │   ├── config.ts             # Configuration manager
│   │   ├── logger.ts             # Logging with sanitization
│   │   ├── file-scanner.ts       # File discovery and custom file detection
│   │   ├── safe-prompts.ts       # Promise-safe prompt wrapper
│   │   └── safe-spinner.ts       # Safe spinner for CI environments
│   ├── index.ts                   # CLI entry point
│   └── types.ts                   # Type definitions and schemas
├── tests/                         # Comprehensive test suite
│   ├── commands/                  # Command tests
│   ├── lib/                       # Library tests
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

#### version.ts - Version Listing
- Lists available releases for all kits
- Filter by kit type
- Shows release metadata (date, assets, prerelease status)
- Parallel fetching for multiple kits

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

### 3. Utilities (`src/utils/`)

#### config.ts - Configuration Manager
- Loads/saves user configuration
- Default kit and directory settings
- Token storage (delegates to keychain)
- JSON-based config file at `~/.claudekit/config.json`

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

#### Custom Error Types
- `ClaudeKitError`: Base error class
- `AuthenticationError`: Authentication failures
- `GitHubError`: GitHub API errors
- `DownloadError`: Download failures
- `ExtractionError`: Archive extraction failures

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
8. Scan for custom .claude files in destination
9. Merge files with conflict detection
10. Protect custom files and patterns
11. User confirmation for overwrites
12. Success message

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

### Test Files Structure
- Mirrors source structure (`tests/` matches `src/`)
- Uses Bun's built-in test runner
- Includes setup/teardown for filesystem operations
- Uses temporary directories for isolation

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

### Multi-Tier Authentication
Provides flexible authentication with automatic fallback to ensure seamless user experience across different environments.

### Smart File Merging
Intelligently handles file conflicts and preserves user customizations while updating projects.

### Exclude Patterns
User-defined glob patterns to skip specific files during download and merge, with security restrictions.

### Custom .claude File Preservation
Automatically detects and protects custom .claude files that don't exist in the new release.

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

### Recovery Mechanisms
- Automatic fallback to tarball on asset failure
- Temporary directory cleanup on errors
- Safe prompt cancellation
- Non-TTY environment detection

## File Statistics

### Largest Files by Token Count
1. `src/lib/download.ts` (5,244 tokens) - Download and extraction logic
2. `tests/lib/github-download-priority.test.ts` (4,006 tokens)
3. `README.md` (2,815 tokens)
4. `tests/types.test.ts` (2,700 tokens)
5. `tests/lib/merge.test.ts` (2,574 tokens)

### Total Metrics (from Repomix)
- Total Files: 40 files
- Total Tokens: 51,849 tokens
- Total Characters: 197,176 characters
- Output Format: XML (repomix-output.xml)

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
- Configuration: `~/.claudekit/config.json`
- Temporary files: OS temp directory
- Target directories: User-specified locations

## Future Considerations

### Planned Improvements
- Additional kit types (marketing kit coming soon)
- Enhanced progress reporting
- Diff preview before merging
- Rollback functionality
- Update notifications

### Extensibility
- Modular command structure for easy additions
- Pluggable authentication providers
- Customizable protected patterns
- Kit configuration extensibility
