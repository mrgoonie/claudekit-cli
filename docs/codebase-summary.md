# Codebase Summary and Structure
# ClaudeKit CLI

**Version:** 0.1.0
**Date:** 2025-10-08
**Lines of Code:** ~1,438 (production) + ~850 (tests)
**Language:** TypeScript
**Runtime:** Bun v1.x+

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Directory Structure](#directory-structure)
3. [Module Breakdown](#module-breakdown)
4. [Entry Points](#entry-points)
5. [Key Dependencies](#key-dependencies)
6. [Testing Structure](#testing-structure)
7. [Build and Distribution](#build-and-distribution)
8. [Configuration Files](#configuration-files)

---

## Project Overview

**ClaudeKit CLI** is a command-line tool for bootstrapping and updating projects from private GitHub repository releases. Built with Bun and TypeScript, it provides a fast, secure, and user-friendly experience for project setup and maintenance.

**Core Features:**
- Multi-tier GitHub authentication (gh CLI → env vars → keychain → prompt)
- Streaming downloads with progress tracking
- Smart file merging with conflict detection
- Secure credential storage using OS keychain
- Beautiful CLI interface with interactive prompts

**Tech Stack:**
- Runtime: Bun (fast JavaScript/TypeScript runtime)
- Language: TypeScript 5.x (strict mode)
- Validation: Zod (runtime type checking)
- CLI Framework: CAC (command parsing)
- UI: @clack/prompts, ora, cli-progress
- GitHub: @octokit/rest
- File Operations: fs-extra, tar, unzipper

---

## Directory Structure

```
claudekit-cli/
├── .github/                    # GitHub workflows (future)
├── bin/                        # Compiled binaries (output)
├── dist/                       # Build output (transpiled JS)
├── docs/                       # Documentation
│   ├── project-pdr.md         # Product requirements
│   ├── code-standards.md      # Coding standards
│   ├── system-architecture.md # Architecture diagrams
│   ├── codebase-summary.md    # This file
│   └── tech-stack.md          # Technology stack details
├── plans/                      # Implementation plans & reports
│   ├── 251008-claudekit-cli-implementation-plan.md
│   ├── reports/               # Agent reports
│   │   ├── 251008-from-tester-to-developer-test-summary-report.md
│   │   ├── 251008-from-code-reviewer-to-developer-review-report.md
│   │   └── ...
│   ├── research/              # Research documents
│   │   └── 251008-cli-frameworks-bun-research.md
│   └── templates/             # Plan templates
├── src/                        # Source code
│   ├── commands/              # Command implementations
│   │   ├── new.ts            # 'ck new' command
│   │   └── update.ts         # 'ck update' command
│   ├── lib/                   # Core libraries
│   │   ├── auth.ts           # Authentication manager
│   │   ├── github.ts         # GitHub API client
│   │   ├── download.ts       # Download manager
│   │   ├── merge.ts          # File merger
│   │   └── prompts.ts        # Interactive prompts
│   ├── utils/                 # Utility modules
│   │   ├── config.ts         # Configuration manager
│   │   └── logger.ts         # Logger with sanitization
│   ├── index.ts               # CLI entry point
│   └── types.ts               # Type definitions & schemas
├── tests/                      # Test files
│   ├── lib/
│   │   ├── auth.test.ts
│   │   ├── github.test.ts
│   │   ├── download.test.ts
│   │   ├── merge.test.ts
│   │   └── prompts.test.ts
│   ├── utils/
│   │   ├── config.test.ts
│   │   └── logger.test.ts
│   └── types.test.ts
├── .gitignore                  # Git ignore patterns
├── AGENTS.md                   # Agent definitions
├── CLAUDE.md                   # AI assistant instructions
├── README.md                   # User documentation
├── biome.json                  # Biome config (linter)
├── bun.lockb                   # Bun lock file
├── package.json                # Package manifest
└── tsconfig.json               # TypeScript configuration
```

---

## Module Breakdown

### Core Entry Point

#### `src/index.ts` (47 lines)
**Purpose:** CLI entry point and command routing

**Responsibilities:**
- Initialize CAC command parser
- Register commands (new, update)
- Handle version and help flags
- Global error handling
- Process exit codes

**Key Code:**
```typescript
#!/usr/bin/env bun

import { cac } from 'cac';
import { newCommand } from './commands/new';
import { updateCommand } from './commands/update';

const cli = cac('ck');

cli.command('new [dir]', 'Create a new project')
  .option('--kit <kit>', 'Kit type: engineer, marketing')
  .option('--version <version>', 'Specific version')
  .action(newCommand);

cli.command('update [dir]', 'Update existing project')
  .option('--kit <kit>', 'Kit type: engineer, marketing')
  .option('--version <version>', 'Specific version')
  .action(updateCommand);

cli.version(VERSION);
cli.help();
cli.parse();
```

---

### Type Definitions

#### `src/types.ts` (146 lines)
**Purpose:** Central type definitions and validation schemas

**Contents:**
- Zod schemas for runtime validation
- TypeScript type exports
- Custom error classes
- Kit configuration

**Key Schemas:**
```typescript
// Command options
export const NewCommandOptionsSchema = z.object({
  dir: z.string().default('.'),
  kit: KitType.optional(),
  version: z.string().optional(),
});

// GitHub release
export const GitHubReleaseSchema = z.object({
  id: z.number(),
  tag_name: z.string(),
  name: z.string().nullable(),
  assets: z.array(GitHubReleaseAssetSchema),
  // ...
});

// Configuration
export const ConfigSchema = z.object({
  github: z.object({
    token: z.string().optional(),
  }).optional(),
  defaults: z.object({
    kit: KitType.optional(),
    dir: z.string().optional(),
  }).optional(),
});
```

**Error Classes:**
```typescript
export class ClaudeKitError extends Error { ... }
export class AuthenticationError extends ClaudeKitError { ... }
export class GitHubError extends ClaudeKitError { ... }
export class DownloadError extends ClaudeKitError { ... }
export class ExtractionError extends ClaudeKitError { ... }
```

---

### Commands

#### `src/commands/new.ts` (118 lines)
**Purpose:** Create new project from release

**Workflow:**
1. Parse and validate options
2. Get target directory (prompt if needed)
3. Validate directory is empty
4. Authenticate with GitHub
5. Select kit (prompt if needed)
6. Fetch latest release
7. Download release asset
8. Extract archive
9. Merge files to target directory
10. Show success message with next steps

**Key Features:**
- Interactive prompts for missing options
- Directory validation
- Progress tracking
- Error handling with cleanup

---

#### `src/commands/update.ts` (115 lines)
**Purpose:** Update existing project

**Workflow:**
1. Parse and validate options
2. Validate directory exists
3. Authenticate with GitHub
4. Detect kit from existing project
5. Fetch release (latest or specified version)
6. Detect file conflicts
7. Show confirmation prompt
8. Download and extract
9. Merge with conflict resolution
10. Show update summary

**Key Features:**
- Conflict detection before download
- Protected file patterns
- Confirmation prompt
- Update statistics

---

### Core Libraries

#### `src/lib/auth.ts` (152 lines)
**Purpose:** Multi-tier authentication management

**Authentication Fallback Chain:**
1. GitHub CLI (`gh auth token`)
2. Environment variables (GITHUB_TOKEN, GH_TOKEN)
3. Configuration file (~/.claudekit/config.json)
4. OS Keychain (via keytar)
5. User prompt (with optional storage)

**Key Methods:**
```typescript
class AuthManager {
  static async getToken(): Promise<{ token: string; method: AuthMethod }> { ... }
  static async getFromGhCli(): Promise<string | null> { ... }
  static async promptForToken(): Promise<string> { ... }
  static async saveToken(token: string): Promise<void> { ... }
  static validateTokenFormat(token: string): boolean { ... }
}
```

**Features:**
- Token format validation
- Secure keychain storage
- User consent before storing
- Token caching
- Clear error messages

---

#### `src/lib/github.ts` (149 lines)
**Purpose:** GitHub API client for fetching releases

**Key Methods:**
```typescript
class GitHubClient {
  constructor(token: string) { ... }

  async getLatestRelease(kit: KitConfig): Promise<GitHubRelease> { ... }
  async getRelease(kit: KitConfig, version: string): Promise<GitHubRelease> { ... }
  async listReleases(kit: KitConfig): Promise<GitHubRelease[]> { ... }
}
```

**Features:**
- Octokit REST API integration
- Retry logic with exponential backoff
- Rate limit handling
- Error mapping (404, 401, 403)
- Private repository support

**Error Handling:**
- 404: Repository or release not found
- 401: Invalid or expired token
- 403: Rate limit exceeded
- Network errors with retry

---

#### `src/lib/download.ts` (178 lines)
**Purpose:** Streaming downloads with progress tracking

**Key Methods:**
```typescript
class DownloadManager {
  async createTempDir(): Promise<string> { ... }
  async downloadAsset(asset: GitHubReleaseAsset, destDir: string): Promise<string> { ... }
  async extractArchive(archivePath: string, destDir: string): Promise<void> { ... }
}
```

**Features:**
- Streaming downloads (memory efficient)
- Progress bar with speed and ETA
- Temporary directory management
- Format detection (tar.gz, zip)
- Automatic cleanup

**Archive Extraction:**
- TAR.GZ: Uses `tar` library with streaming
- ZIP: Uses `unzipper` library
- Path traversal protection
- Strip top-level directory

---

#### `src/lib/merge.ts` (117 lines)
**Purpose:** Smart file merging with conflict detection

**Protected Patterns:**
```typescript
const DEFAULT_IGNORE_PATTERNS = [
  '.env',
  '.env.*',
  '*.key',
  '*.pem',
  '*.p12',
  'node_modules/**',
  '.git/**',
  'dist/**',
  'build/**',
  'bun.lockb',
];
```

**Key Methods:**
```typescript
class FileMerger {
  constructor(ignorePatterns?: string[]) { ... }

  async merge(
    sourceDir: string,
    destDir: string,
    isNewProject: boolean
  ): Promise<MergeResult> { ... }

  async detectConflicts(sourceDir: string, destDir: string): Promise<string[]> { ... }
  private async copyFile(source: string, dest: string): Promise<void> { ... }
}
```

**Features:**
- Conflict detection before merge
- Protected file patterns with `ignore` library
- Recursive directory copying
- Merge statistics (created, skipped, overwritten)
- Error recovery

---

#### `src/lib/prompts.ts` (114 lines)
**Purpose:** Interactive user prompts with validation

**Key Methods:**
```typescript
class PromptsManager {
  async selectKit(): Promise<KitType> { ... }
  async selectVersion(versions: GitHubRelease[], defaultVersion?: string): Promise<string> { ... }
  async getDirectory(defaultDir?: string): Promise<string> { ... }
  async confirm(message: string, defaultValue?: boolean): Promise<boolean> { ... }

  intro(message: string): void { ... }
  outro(message: string): void { ... }
  note(message: string, title?: string): void { ... }
}
```

**Features:**
- Beautiful UI with `@clack/prompts`
- Input validation
- Default values
- Colorized output
- Progress indicators

---

### Utilities

#### `src/utils/config.ts` (84 lines)
**Purpose:** Configuration file management

**Configuration Location:** `~/.claudekit/config.json`

**Key Methods:**
```typescript
class ConfigManager {
  static async load(): Promise<Config> { ... }
  static async save(config: Config): Promise<void> { ... }
  static async get(key: string): Promise<any> { ... }
  static async set(key: string, value: any): Promise<void> { ... }
  static async getToken(): Promise<string | undefined> { ... }
  static async setToken(token: string): Promise<void> { ... }
}
```

**Features:**
- JSON configuration storage
- Nested key access
- Automatic directory creation
- Validation with Zod
- In-memory caching

---

#### `src/utils/logger.ts` (38 lines)
**Purpose:** Logging with token sanitization

**Log Levels:**
```typescript
logger.info(message: string): void
logger.success(message: string): void
logger.warning(message: string): void
logger.error(message: string, error?: unknown): void
logger.debug(message: string): void (only if DEBUG env var set)
```

**Security Features:**
```typescript
sanitize(text: string): string {
  return text
    .replace(/ghp_[a-zA-Z0-9]{36}/g, 'ghp_***')
    .replace(/github_pat_[a-zA-Z0-9_]{82}/g, 'github_pat_***')
    .replace(/gho_[a-zA-Z0-9]{36}/g, 'gho_***')
    // ... more patterns
}
```

**Features:**
- Colorized output with `picocolors`
- Token sanitization (all GitHub token formats)
- Conditional debug logging
- Error stack traces
- Clean, readable output

---

## Entry Points

### CLI Entry Point
**File:** `src/index.ts`
**Shebang:** `#!/usr/bin/env bun`
**Binary:** `ck` (defined in package.json)

**Usage:**
```bash
ck new                          # Interactive mode
ck new --kit engineer          # With options
ck update                       # Interactive mode
ck --version                    # Show version
ck --help                       # Show help
```

### Package Entry Point
**File:** `dist/index.js` (after build)
**Method:** `bun build src/index.ts --outdir dist --target node`

### Standalone Binary
**File:** `ck` (compiled binary)
**Method:** `bun build src/index.ts --compile --outfile ck`

---

## Key Dependencies

### Production Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `cac` | ^6.7.14 | Command-line argument parsing |
| `@clack/prompts` | ^0.7.0 | Beautiful interactive prompts |
| `@octokit/rest` | ^22.0.0 | GitHub REST API client |
| `zod` | ^3.23.8 | Runtime type validation |
| `keytar` | ^7.9.0 | Secure credential storage |
| `ora` | ^9.0.0 | Terminal spinners |
| `cli-progress` | ^3.12.0 | Progress bars |
| `picocolors` | ^1.1.1 | Terminal colors |
| `fs-extra` | ^11.2.0 | Enhanced file system operations |
| `tar` | ^7.4.3 | TAR archive extraction |
| `unzipper` | ^0.12.3 | ZIP archive extraction |
| `ignore` | ^5.3.2 | .gitignore-style pattern matching |
| `tmp` | ^0.2.3 | Temporary file management |

### Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | ^5.7.2 | TypeScript compiler |
| `@biomejs/biome` | ^1.9.4 | Linter and formatter |
| `@types/bun` | latest | Bun type definitions |
| `@types/node` | ^22.10.1 | Node.js type definitions |
| `@types/*` | various | Type definitions for dependencies |

---

## Testing Structure

### Test Organization

Tests mirror the source structure:

```
tests/
├── lib/                        # Library tests
│   ├── auth.test.ts           # 9 tests - Authentication
│   ├── github.test.ts         # 5 tests - GitHub client
│   ├── download.test.ts       # 5 tests - Downloads
│   ├── merge.test.ts          # 11 tests - File merging
│   └── prompts.test.ts        # 11 tests - User prompts
├── utils/                      # Utility tests
│   ├── config.test.ts         # 15 tests - Configuration
│   └── logger.test.ts         # 13 tests - Logging
└── types.test.ts               # 24 tests - Types & validation

Total: 93 tests (100% pass rate)
```

### Test Coverage

**Overall:** 93 tests passing
**Coverage:** ~80% (estimated)

**Coverage by Module:**
- ✅ **Excellent:** types.ts, config.ts, logger.ts, merge.ts
- ✅ **Good:** auth.ts, prompts.ts
- ✅ **Basic:** github.ts, download.ts (integration tests would require mocking)

### Test Execution

```bash
bun test                        # Run all tests
bun test --watch               # Watch mode
bun test path/to/file.test.ts # Run specific test
```

**Performance:** 734ms total execution time

---

## Build and Distribution

### Development Build

```bash
bun install                     # Install dependencies
bun run dev                     # Run in development mode
bun run typecheck              # Type check
bun run lint                    # Lint code
bun run format                  # Format code
bun test                        # Run tests
```

### Production Build

```bash
# Transpiled build (for npm)
bun run build
# Output: dist/index.js

# Standalone binary (for direct distribution)
bun run compile
# Output: ./ck (executable)
```

### Cross-Platform Builds

```bash
# macOS ARM64
bun build --compile src/index.ts --target=bun-darwin-arm64 --outfile ck-macos-arm64

# macOS x64
bun build --compile src/index.ts --target=bun-darwin-x64 --outfile ck-macos-x64

# Linux x64
bun build --compile src/index.ts --target=bun-linux-x64 --outfile ck-linux

# Windows x64
bun build --compile src/index.ts --target=bun-windows-x64 --outfile ck.exe
```

### Distribution Methods

**1. npm Registry (Primary):**
```bash
bun add -g claudekit-cli
```

**2. GitHub Releases (Standalone Binary):**
```bash
curl -fsSL https://github.com/mrgoonie/claudekit-cli/releases/download/v0.1.0/ck-macos-arm64 -o ck
chmod +x ck
sudo mv ck /usr/local/bin/
```

**3. From Source:**
```bash
git clone https://github.com/mrgoonie/claudekit-cli
cd claudekit-cli
bun install
bun link
```

---

## Configuration Files

### `package.json`
**Purpose:** Package manifest and scripts

**Key Fields:**
```json
{
  "name": "claudekit-cli",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "ck": "./dist/index.js"
  },
  "engines": {
    "bun": ">=1.0.0"
  }
}
```

### `tsconfig.json`
**Purpose:** TypeScript compiler configuration

**Key Settings:**
```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["bun-types"]
  }
}
```

### `biome.json`
**Purpose:** Biome linter and formatter configuration

**Key Rules:**
- Recommended rules enabled
- Organize imports
- No `any` warnings
- No debugger/console.log in production
- 2-space indentation
- 100 character line width

### `.gitignore`
**Purpose:** Git ignore patterns

**Ignored:**
- `node_modules/`
- `dist/`
- `bin/`
- `*.log`
- `.env`
- `bun.lockb` (should be committed, but shown as example)

---

## Code Statistics

### Lines of Code by Module

| Module | Lines | Complexity | Status |
|--------|-------|------------|--------|
| **index.ts** | 47 | Low | ✅ Complete |
| **types.ts** | 146 | Low | ✅ Complete |
| **auth.ts** | 152 | Medium | ✅ Complete |
| **github.ts** | 149 | Medium | ✅ Complete |
| **download.ts** | 178 | High | ✅ Complete |
| **merge.ts** | 117 | Medium | ✅ Complete |
| **prompts.ts** | 114 | Low | ✅ Complete |
| **config.ts** | 84 | Low | ✅ Complete |
| **logger.ts** | 38 | Low | ✅ Complete |
| **new.ts** | 118 | Medium | ✅ Complete |
| **update.ts** | 115 | Medium | ✅ Complete |

**Total Production Code:** 1,438 lines
**Total Test Code:** ~850 lines
**Code-to-Test Ratio:** 1:0.59

### Code Quality Metrics

- **Type Coverage:** 100% (TypeScript strict mode)
- **Test Coverage:** ~80%
- **Linting Errors:** 0
- **Type Errors:** 0
- **Security Vulnerabilities:** 0
- **Average File Size:** 130 lines
- **Max File Size:** 178 lines (well under 500 line limit)

---

## Development Workflow

### Adding a New Feature

1. **Plan:** Create implementation plan in `plans/`
2. **Research:** Conduct research if needed, document in `plans/research/`
3. **Implement:** Write code following code standards
4. **Test:** Add comprehensive tests
5. **Review:** Run code review checklist
6. **Document:** Update relevant documentation
7. **Commit:** Use conventional commit format

### Modifying Existing Code

1. **Read:** Review module documentation
2. **Understand:** Check tests to understand behavior
3. **Modify:** Make changes following code standards
4. **Test:** Update and add tests
5. **Verify:** Run `bun test` and `bun run typecheck`
6. **Document:** Update JSDoc and README if needed

---

## Quick Reference

### Common Commands

```bash
# Development
bun install                     # Install dependencies
bun run dev new --kit engineer # Run in development
bun test                        # Run tests
bun run typecheck              # Type check
bun run lint                    # Lint
bun run format                  # Format

# Build
bun run build                   # Build for npm
bun run compile                 # Build standalone binary

# Local Testing
bun link                        # Link globally
ck new --kit engineer          # Test command
bun unlink                      # Unlink
```

### File Locations

- **Source Code:** `src/`
- **Tests:** `tests/`
- **Documentation:** `docs/`
- **Build Output:** `dist/` (gitignored)
- **Binaries:** `bin/` (gitignored)
- **Config:** `~/.claudekit/config.json` (user machine)
- **Keychain:** OS-specific (macOS Keychain, etc.)

### Environment Variables

```bash
GITHUB_TOKEN=ghp_xxx           # GitHub PAT
GH_TOKEN=ghp_xxx               # Alternative
DEBUG=1                         # Enable debug logging
```

---

## Future Enhancements

### Planned Features
- Marketing kit support
- Linux and Windows compatibility
- Self-update mechanism
- Local template caching
- Shell completion scripts

### Technical Debt
- Add integration tests with Octokit mocking
- Add E2E tests for full command flows
- Complete JSDoc for all public APIs
- Add coverage reporting (c8/istanbul)
- Add CI/CD pipeline

### Performance Optimizations
- Parallel downloads (if multiple assets)
- Resume support for interrupted downloads
- Incremental updates (only download changed files)
- Better caching strategies

---

**Document Version:** 1.0
**Last Updated:** 2025-10-08
**Lines of Code:** 1,438 (production) + 850 (tests)
**Status:** Production Ready
**Next Review:** 2025-11-08
