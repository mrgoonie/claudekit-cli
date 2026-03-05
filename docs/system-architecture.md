# System Architecture

## Overview

ClaudeKit CLI is built with a **modular domain-driven architecture** using facade patterns. The system separates concerns into CLI infrastructure, commands with phase handlers, domain-specific business logic, cross-domain services, and pure utilities. Designed for extensibility, security, and cross-platform compatibility.

## Architecture Highlights

The codebase underwent a major modularization refactor:
- **24 large files (~12,197 lines)** reduced to **facades (~2,466 lines)**
- **122 new focused modules** (target: <100 lines each)
- **Facade pattern** for backward compatibility
- **Phase handler pattern** for complex commands
- **Self-documenting file names** using kebab-case

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         User Interface                       │
│                     (CLI / Terminal)                         │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    CLI Layer (src/cli/)                      │
│  • cli-config.ts       - Framework configuration            │
│  • command-registry.ts - Command registration               │
│  • version-display.ts  - Version output formatting          │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│               Command Layer (src/commands/)                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ init/         │ new/          │ uninstall/          │   │
│  │ Orchestrator  │ Orchestrator  │ Command + handlers  │   │
│  │ + 8 phases    │ + 3 phases    │                     │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│               Domains Layer (src/domains/)                   │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐ │
│  │ config/  │ github/  │ health-  │ install- │ skills/  │ │
│  │ merger/  │ client/  │ checks/  │ ation/   │ custom-  │ │
│  │          │          │ checkers/│ download/│ ization/ │ │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              Services Layer (src/services/)                  │
│  ┌────────────────┬──────────────────┬─────────────────┐   │
│  │ file-operations│ package-installer│ transformers    │   │
│  │ manifest/      │ dependencies/    │ commands-prefix/│   │
│  │                │ gemini-mcp/      │ folder-transform│   │
│  └────────────────┴──────────────────┴─────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                Shared Layer (src/shared/)                    │
│  ┌────────────┬────────────┬────────────┬─────────────┐   │
│  │ logger     │ path-      │ environ-   │ safe-*      │   │
│  │            │ resolver   │ ment       │             │   │
│  └────────────┴────────────┴────────────┴─────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                 External Integrations                        │
│  ┌──────────────┬──────────────┬──────────────────────┐   │
│  │  GitHub API  │  GitHub CLI  │  File System         │   │
│  │  (Octokit)   │  (gh)        │  (fs-extra)          │   │
│  └──────────────┴──────────────┴──────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Component Architecture

### Modular Domain Architecture

Each domain follows the **facade + submodules** pattern:

```
domain/
├── index.ts              # Re-exports (optional)
├── domain-name.ts        # Facade - public API
├── types.ts              # Domain-specific types
└── submodule/            # Implementation details
    ├── index.ts          # Submodule re-exports
    ├── focused-module-1.ts  # Single responsibility
    ├── focused-module-2.ts  # Single responsibility
    └── types.ts          # Submodule types
```

### Command Architecture (Phase Handlers)

Complex commands use orchestrator + phase handlers:

```
command/
├── index.ts              # Public exports
├── command-name.ts       # Orchestrator (~100 lines)
├── types.ts              # Command types
└── phases/               # Phase handlers
    ├── index.ts          # Re-exports
    ├── phase-1.ts        # Single responsibility (~50-100 lines)
    ├── phase-2.ts        # Single responsibility
    └── ...
```

**Example: Init Command Flow**
```
┌─────────────────────────────────────────────────────────────┐
│                    init-command.ts (Orchestrator)            │
├─────────────────────────────────────────────────────────────┤
│  1. options-resolver.ts    → Parse and validate options     │
│  2. selection-handler.ts   → Kit and version selection      │
│  3. download-handler.ts    → Download release               │
│  4. migration-handler.ts   → Skills migration               │
│  5. conflict-handler.ts    → Detect conflicts               │
│  6. merge-handler.ts       → Merge files                    │
│  7. transform-handler.ts   → Apply transformations          │
│  8. post-install-handler.ts→ Post-install setup             │
└─────────────────────────────────────────────────────────────┘
```

### Modularization Summary

| Domain | Original Files | Facade Lines | New Modules |
|--------|---------------|--------------|-------------|
| init.ts | 1 file | ~200 | 12 modules |
| new.ts | 1 file | ~150 | 5 modules |
| uninstall.ts | 1 file | ~100 | 5 modules |
| download-manager.ts | 1 file | ~200 | 12 modules |
| claudekit-checker.ts | 1 file | ~150 | 14 modules |
| github-client.ts | 1 file | ~150 | 6 modules |
| settings-merger.ts | 1 file | ~100 | 6 modules |
| version-selector.ts | 1 file | ~100 | 3 modules |
| skills-customization-scanner.ts | 1 file | ~100 | 3 modules |
| package-installer.ts | 1 file | ~150 | 7 modules |
| **Total** | **24 files** | **~2,466** | **122 modules** |

### 0. Help System Architecture

Custom help system with color themes, command definitions, and interactive features. See `domains/help/` for implementation.

### 1. Command Layer

All commands follow orchestrator + phase handlers pattern. Key commands:
- **new/**: Project creation (3 phases)
- **init/**: Project update/initialization (8 phases)
- **uninstall/**: Safe kit removal (3 handlers)
- **content/**: Social media daemon with 30+ handlers for Git scanning, content generation, multi-platform publishing (X, Facebook)

### 2. Content Command (New)

`src/commands/content/` monitors Git repos, generates social content via Claude CLI, publishes to X and Facebook.

**Subcommands:** start, stop, status, logs, setup, queue, approve, reject

**Key features:**
- Daemon lifecycle with PID lock file
- SQLite WAL storage for content queue
- Git event scanning and classification
- Claude CLI integration with robust JSON parsing
- Multi-platform publishing with rate limiting
- Review system (auto/manual/hybrid)
- Engagement analytics

See `src/commands/content/` for 30+ phase handlers (git-scanner, content-creator, publisher, review-manager, db-manager, etc.)

### 3. Installation & Download Flow

**Download Flow:**
1. Authenticate (GitHub CLI)
2. Fetch release from GitHub API
3. Stream download with progress
4. Extract archive (TAR.GZ or ZIP) with security validation
5. Apply exclude patterns
6. Detect and strip wrapper directories
7. Copy files to destination

**Security:**
- Path traversal prevention
- Archive bomb detection (500MB limit)
- Protected file preservation (.env, keys, etc.)
- Platform-specific optimizations (macOS native unzip)

#### Multi-Kit Merge Support

Supports installing multiple kits into the same `.claude` directory:
- `SelectiveMerger`: Hybrid size+checksum comparison for efficient copies
- `CopyExecutor`: Multi-kit context awareness with shared file tracking
- `ManifestReader`: Locates files across installed kits
- Origin tracking for kit-scoped uninstall (Phase 2)

See `domains/installation/` for implementation.

### 4. Shared Services

**Configuration:** Platform-aware paths (XDG, Windows), global vs local modes
**Path Resolver:** Cross-platform path building for config, cache, components
**Logger:** Structured logging with token sanitization
**File Scanner:** Custom file detection during updates
**Environment:** Platform detection, adaptive concurrency tuning
**Safe Prompts/Spinners:** CI-safe interactive components

### 5. Type System

Domain types (KitType, ArchiveType, AuthMethod) and Zod schemas for runtime validation.
See `src/types/` for:
  ├─ GitHubError
  ├─ DownloadError
  └─ ExtractionError
```

**4. Constants:**
```typescript
AVAILABLE_KITS: Kit configurations
PROTECTED_PATTERNS: Files to preserve
```

## Data Flow Diagrams

### New Project Creation Flow

```
User Command: ck new --kit engineer --dir ./my-project
                          │
                          ▼
      ┌───────────────────────────────────────┐
      │  1. Parse & Validate Options (Zod)    │
      └───────────────┬───────────────────────┘
                      │
                      ▼
      ┌───────────────────────────────────────┐
      │  2. Authenticate (Multi-tier)          │
      │     • Try GitHub CLI                   │
      │     • Try Env Vars                     │
      │     • Try Config                       │
      │     • Try Keychain                     │
      │     • Prompt User                      │
      └───────────────┬───────────────────────┘
                      │
                      ▼
      ┌───────────────────────────────────────┐
      │  3. Verify Repository Access           │
      │     • GitHub.checkAccess()             │
      └───────────────┬───────────────────────┘
                      │
                      ▼
      ┌───────────────────────────────────────┐
      │  4. Fetch Release                      │
      │     • getLatestRelease() or            │
      │       getReleaseByTag()                │
      └───────────────┬───────────────────────┘
                      │
                      ▼
      ┌───────────────────────────────────────┐
      │  5. Select Download Asset              │
      │     Priority:                          │
      │     1. ClaudeKit package               │
      │     2. Custom asset                    │
      │     3. GitHub tarball                  │
      └───────────────┬───────────────────────┘
                      │
                      ▼
      ┌───────────────────────────────────────┐
      │  6. Download Archive                   │
      │     • Streaming download               │
      │     • Progress tracking                │
      │     • Temp directory                   │
      └───────────────┬───────────────────────┘
                      │
                      ▼
      ┌───────────────────────────────────────┐
      │  7. Extract Archive                    │
      │     • Detect type (tar.gz/zip)        │
      │     • Security validation              │
      │     • Apply exclude patterns           │
      │     • Strip wrapper directory          │
      └───────────────┬───────────────────────┘
                      │
                      ▼
      ┌───────────────────────────────────────┐
      │  8. Validate Extraction                │
      │     • Check critical paths             │
      │     • Verify completeness              │
      └───────────────┬───────────────────────┘
                      │
                      ▼
      ┌───────────────────────────────────────┐
      │  9. Copy to Target Directory           │
      │     • Skip confirmation (new project)  │
      │     • Apply protected patterns         │
      └───────────────┬───────────────────────┘
                      │
                      ▼
      ┌───────────────────────────────────────┐
      │  10. Success Message & Next Steps      │
      └───────────────────────────────────────┘
```

### Update Project Flow

```
User Command: ck update --kit engineer
                          │
                          ▼
      ┌───────────────────────────────────────┐
      │  1. Parse & Validate Options           │
      └───────────────┬───────────────────────┘
                      │
                      ▼
      ┌───────────────────────────────────────┐
      │  2. Verify Project Directory Exists    │
      └───────────────┬───────────────────────┘
                      │
                      ▼
      ┌───────────────────────────────────────┐
      │  3. Authenticate & Fetch Release       │
      │     (Same as New Project Flow)         │
      └───────────────┬───────────────────────┘
                      │
                      ▼
      ┌───────────────────────────────────────┐
      │  4. Download & Extract to Temp         │
      └───────────────┬───────────────────────┘
                      │
                      ▼
      ┌───────────────────────────────────────┐
      │  5. Scan for Custom .claude Files      │
      │     • FileScanner.findCustomFiles()    │
      │     • Compare dest vs source           │
      └───────────────┬───────────────────────┘
                      │
                      ▼
      ┌───────────────────────────────────────┐
      │  6. Detect Conflicts                   │
      │     • List files to be overwritten     │
      │     • Exclude protected files          │
      └───────────────┬───────────────────────┘
                      │
                      ▼
      ┌───────────────────────────────────────┐
      │  7. Request User Confirmation          │
      │     • Show conflict list               │
      │     • Ask to proceed                   │
      └───────────────┬───────────────────────┘
                      │
                      ▼
      ┌───────────────────────────────────────┐
      │  8. Merge Files                        │
      │     • Apply protected patterns         │
      │     • Add custom file patterns         │
      │     • Copy with statistics             │
      └───────────────┬───────────────────────┘
                      │
                      ▼
      ┌───────────────────────────────────────┐
      │  9. Success Message & Summary          │
      └───────────────────────────────────────┘
```

### Authentication Flow

```
      ┌──────────────────────────────────┐
      │  AuthManager.getToken()          │
      └──────────┬───────────────────────┘
                 │
                 ▼
      ┌──────────────────────────────────┐
      │  Check: Is GitHub CLI installed? │
      └──────────┬───────────────────────┘
                 │
           Installed?──No──► Throw AuthenticationError
                 │            (with installation instructions)
               Yes
                 │
                 ▼
      ┌──────────────────────────────────┐
      │  Run: gh auth token -h github.com │
      └──────────┬───────────────────────┘
                 │
           Success?──Yes──► Cache & Return Token
                 │
                No
                 │
                 ▼
      ┌──────────────────────────────────┐
      │  Throw AuthenticationError       │
      │  (with re-auth instructions)     │
      └──────────────────────────────────┘
```

## Security Architecture

### Security Layers

```
┌─────────────────────────────────────────────────┐
│             Application Layer                    │
│  • Token sanitization in logs                   │
│  • Token format validation                      │
│  • User input validation (Zod)                  │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│             Download Layer                       │
│  • Path traversal prevention                    │
│  • Archive bomb detection (500MB limit)         │
│  • Safe path resolution                         │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│             Extraction Layer                     │
│  • Exclude pattern enforcement                  │
│  • Wrapper directory detection                  │
│  • File size tracking                           │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│             Storage Layer                        │
│  • GitHub CLI session management                │
│  • Protected file preservation                  │
│  • Temporary directory cleanup                  │
└─────────────────────────────────────────────────┘
```

### Path Traversal Prevention

```typescript
// Validation Process:
1. Resolve both paths to absolute canonical forms
2. Calculate relative path from base to target
3. Reject if relative path starts with ".."
4. Reject if relative path starts with "/"
5. Verify target starts with base path

// Example:
Base: /home/user/project
Target: /home/user/project/../etc/passwd
Relative: ../etc/passwd
Result: ❌ REJECTED (starts with "..")
```

### Archive Bomb Prevention

```typescript
// Size Tracking:
totalExtractedSize = 0
for each file in archive:
  totalExtractedSize += file.size
  if (totalExtractedSize > 500MB):
    throw ExtractionError("Archive bomb detected")
```

## Performance Characteristics

### Memory Management
- **Streaming Downloads**: No buffering, direct stream to disk
- **Extraction**: Process files incrementally, not all at once
- **Token Caching**: In-memory caching after first fetch
- **Progress Tracking**: Chunked updates (1MB chunks)

### Parallelization
- **Version Listing**: Parallel fetching for multiple kits
- **Authentication**: Sequential fallback (by design)
- **Download**: Single stream (network limited)
- **Extraction**: Sequential for safety

### Resource Limits
```typescript
MAX_EXTRACTION_SIZE = 500 * 1024 * 1024  // 500MB
REQUEST_TIMEOUT = 30000                   // 30 seconds
PROGRESS_CHUNK_SIZE = 1024 * 1024        // 1MB
```

## Error Handling Architecture

### Error Hierarchy
```
Error (JavaScript)
  │
  └─ ClaudeKitError (Base)
       ├─ AuthenticationError (401)
       ├─ GitHubError (variable status)
       ├─ DownloadError
       └─ ExtractionError
```

### Error Propagation
```
Low-Level Operation
  │
  ├─ Throw Specific Error (DownloadError)
  │
  ▼
Command Handler
  │
  ├─ Catch & Log Error
  │
  ├─ Show User-Friendly Message
  │
  └─ Exit with Status Code 1
```

### Fallback Mechanisms
```
Asset Download Failed
  ↓
Fall back to GitHub Tarball
  ↓
If that fails too → Error

GitHub CLI Auth Failed
  ↓
Try Environment Variables
  ↓
Try Config File
  ↓
Try Keychain
  ↓
Prompt User
```

## Build & Distribution Architecture

### Compilation Flow
```
TypeScript Source (src/)
  │
  ├─ Bun Build → dist/ (Type checking, transpiling)
  │
  ├─ Bun Compile → bin/ck-{platform}-{arch} (Standalone binaries)
  │
  └─ NPM Package → bin/ck.js (Platform detection wrapper)
```

### Binary Distribution
```
bin/
├── ck.js                  # Platform detection wrapper
├── ck-darwin-arm64        # macOS Apple Silicon
├── ck-darwin-x64          # macOS Intel
├── ck-linux-x64           # Linux x64
└── ck-win32-x64.exe       # Windows x64
```

### Platform Detection
```javascript
// bin/ck.js
const platform = process.platform;  // darwin, linux, win32
const arch = process.arch;          // arm64, x64
const binaryName = `ck-${platform}-${arch}${ext}`;
spawn(binaryPath, args);
```

## CI/CD Architecture

### GitHub Actions Workflow
```
Push to main
  │
  ├─ Job: Build Binaries (Parallel)
  │   ├─ macOS arm64
  │   ├─ macOS x64
  │   ├─ Linux x64
  │   └─ Windows x64
  │
  ├─ Job: Release (after binaries)
  │   ├─ Type check
  │   ├─ Lint
  │   ├─ Test
  │   ├─ Download binaries
  │   ├─ Semantic Release
  │   │   ├─ Determine version bump
  │   │   ├─ Generate changelog
  │   │   ├─ Create GitHub release
  │   │   └─ Publish to NPM
  │   └─ Discord notification
  │
  └─ Success ✓
```

### Semantic Release
```
Commit Messages → Semantic Release
  │
  ├─ feat: → Minor version bump (1.x.0)
  ├─ fix: → Patch version bump (1.0.x)
  └─ BREAKING CHANGE: → Major version bump (x.0.0)
  │
  ├─ Generate CHANGELOG.md
  ├─ Update package.json version
  ├─ Create Git tag
  ├─ Create GitHub release
  └─ Publish to NPM
```

## Integration Points

### External Services
```
┌────────────────────────────────────────┐
│         ClaudeKit CLI                   │
└────────┬───────────────────────────────┘
         │
         ├─► GitHub API (api.github.com)
         │    • Repository access verification
         │    • Release fetching
         │    • Asset downloads
         │
         ├─► npm Registry (registry.npmjs.org)
         │    • Package publishing
         │    • Version distribution
         │
         ├─► OS Keychain
         │    • macOS: Keychain Access
         │    • Linux: Secret Service API
         │    • Windows: Credential Vault
         │
         └─► File System
              • Configuration (local): ~/.claudekit/
              • Configuration (global):
                - macOS/Linux: ~/.config/claude/
                - Windows: %LOCALAPPDATA%\claude\
              • Cache (local): ~/.claudekit/cache
              • Cache (global):
                - macOS/Linux: ~/.cache/claude/
                - Windows: %LOCALAPPDATA%\claude\cache
              • Global kit installation: ~/.claude/
              • Local project installations: {project}/.claude/
              • Temporary files: OS temp dir
              • Target directories: User-specified
```

### API Contracts

#### GitHub API
```typescript
// Endpoints:
GET /repos/{owner}/{repo}
GET /repos/{owner}/{repo}/releases/latest
GET /repos/{owner}/{repo}/releases/tags/{tag}
GET /repos/{owner}/{repo}/releases

// Authentication:
Authorization: Bearer {token}
X-GitHub-Api-Version: 2022-11-28
```

#### GitHub CLI Integration
```typescript
// Token retrieval:
execSync("gh auth token -h github.com", { encoding: "utf-8" })

// Auth status check:
execSync("gh auth status -h github.com", { stdio: "pipe" })

// User authentication:
// Users must run: gh auth login -h github.com
```

## Extensibility Points

### Adding New Commands
1. Create `src/commands/new-command.ts`
2. Define options schema in `src/types.ts`
3. Register command in `src/index.ts`
4. Add tests in `tests/commands/new-command.test.ts`

### Adding New Kits
1. Update `AVAILABLE_KITS` in `src/types.ts`
2. Add kit configuration (name, repo, owner, description)
3. Update `KitType` enum in Zod schema
4. Document in README.md

### Adding New Authentication Methods
1. Add method to `AuthMethod` type in `src/types.ts`
2. Implement in `AuthManager.getToken()` fallback chain
3. Update authentication flow documentation
4. Add tests for new method

### Custom Error Types
1. Extend `ClaudeKitError` base class
2. Define error code and status code
3. Use in appropriate module
4. Document in error handling guide

## Deployment Architecture

### Installation Methods
```
User Installation
  │
  ├─ npm install -g claudekit-cli
  ├─ yarn global add claudekit-cli
  ├─ pnpm add -g claudekit-cli
  ├─ bun add -g claudekit-cli
  └─ From source: bun install && bun link
  │
  └─► Global Binary: /usr/local/bin/ck (symlink to bin/ck.js)
```

### Runtime Environment
```
User Executes: ck new
  │
  ├─ Shell resolves: /usr/local/bin/ck
  │
  ├─ Executes: bin/ck.js (Node.js wrapper)
  │
  ├─ Detects platform & architecture
  │
  ├─ Spawns: bin/ck-{platform}-{arch}
  │
  └─► Runs compiled Bun binary
```

## Monitoring & Observability

### Logging Architecture
```
Operation → Logger
  │
  ├─ Sanitize (remove tokens)
  │
  ├─ Format (add timestamp, level)
  │
  ├─ Output
  │   ├─ Console (stdout/stderr)
  │   └─ File (if --log-file specified)
  │
  └─ Levels:
      • debug (verbose only)
      • info
      • success
      • warning
      • error
```

### Error Tracking
- Structured error classes with codes
- Status codes for HTTP errors
- Stack traces in verbose mode
- User-friendly error messages

### Performance Metrics
- Download speed (network limited)
- Extraction time (typically <5s)
- Authentication time (<1s)
- Memory usage (<100MB)

## Future Architecture Considerations

### Planned Enhancements
- Plugin system for extensibility
- Caching layer for repeated operations
- Diff preview before merge
- Rollback functionality
- Background update checks

### Scalability
- Current architecture supports single-user CLI
- Can be extended for team/enterprise use
- Potential for central configuration server
- API service for programmatic access

### Modularity
- Clear separation of concerns
- Reusable libraries (auth, download, merge)
- Test-friendly design
- Easy to extend and maintain
