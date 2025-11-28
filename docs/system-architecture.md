# System Architecture

## Overview

ClaudeKit CLI is built with a layered architecture that separates concerns into command handling, core business logic, utilities, and external integrations. The system is designed for extensibility, security, and cross-platform compatibility.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         User Interface                       │
│                     (CLI / Terminal)                         │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                      Entry Point                             │
│                   (src/index.ts)                            │
│  • Command parsing (CAC)                                    │
│  • Global options handling                                  │
│  • Verbose mode initialization                              │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    Command Layer                             │
│            (src/commands/*.ts)                              │
│  ┌──────────────┬──────────────┬──────────────┐           │
│  │  new.ts      │  update.ts   │  version.ts  │           │
│  │  Create new  │  Update      │  List        │           │
│  │  project     │  existing    │  versions    │           │
│  └──────────────┴──────────────┴──────────────┘           │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                  Core Business Logic                         │
│                  (src/lib/*.ts)                             │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐ │
│  │  auth    │  github  │download  │  merge   │ prompts  │ │
│  │  .ts     │  .ts     │  .ts     │  .ts     │  .ts     │ │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    Utilities Layer                           │
│                  (src/utils/*.ts)                           │
│  ┌────────────┬────────────┬────────────┬─────────────┐   │
│  │  config    │  logger    │  file-     │  safe-*     │   │
│  │  .ts       │  .ts       │  scanner   │  .ts        │   │
│  └────────────┴────────────┴────────────┴─────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                 External Integrations                        │
│  ┌──────────────┬──────────────┬──────────────────────┐   │
│  │  GitHub API  │  OS Keychain │  File System         │   │
│  │  (Octokit)   │  (keytar)    │  (fs-extra)          │   │
│  └──────────────┴──────────────┴──────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Component Architecture

### 0. Help System Architecture

#### Help Data Structures (src/lib/help/help-types.ts)

Custom help system built to replace CAC's default help with enhanced UX, color themes, and interactive features.

**Type System Architecture:**
```
CommandHelp (central interface)
  ├─ name: string
  ├─ description: string
  ├─ usage: string
  ├─ examples: HelpExample[]
  ├─ optionGroups: OptionGroup[]
  │    └─ options: OptionDefinition[]
  │         ├─ flags: string
  │         ├─ description: string
  │         ├─ defaultValue?: string
  │         └─ deprecated?: DeprecatedInfo
  ├─ sections?: HelpSection[]
  ├─ aliases?: string[]
  └─ deprecated?: DeprecatedInfo
```

**Color Theme Architecture:**
```
ColorTheme Interface
  ├─ banner: ColorFunction      (cyan/bold for logo)
  ├─ command: ColorFunction     (green for command names)
  ├─ heading: ColorFunction     (bold for section titles)
  ├─ flag: ColorFunction        (yellow for options)
  ├─ description: ColorFunction (dim for help text)
  ├─ example: ColorFunction     (cyan for examples)
  ├─ warning: ColorFunction     (yellow for warnings)
  ├─ error: ColorFunction       (red for errors)
  ├─ muted: ColorFunction       (gray for secondary text)
  └─ success: ColorFunction     (green for success)

All functions respect NO_COLOR environment variable
```

**Help Rendering Flow:**
```
User: ck --help
  │
  ▼
CommandRegistry (all command definitions)
  │
  ▼
HelpFormatter(CommandHelp, HelpRenderContext)
  │
  ├─ Apply ColorTheme
  ├─ Format sections (usage, options, examples)
  ├─ Apply width constraints
  ├─ Handle interactive mode (scrolling)
  └─ Respect NO_COLOR flag
  │
  ▼
Formatted Help Output
```

**Design Goals:**
- **Conciseness**: Max 2 examples per command, focused information
- **Accessibility**: NO_COLOR support, screen reader friendly
- **Consistency**: Standardized option grouping and formatting
- **Extensibility**: Custom formatters and themes via interfaces
- **Discoverability**: Clear deprecation warnings with alternatives

**Integration Points:**
- CAC command registration (replaces default help)
- Terminal width detection (for formatting)
- TTY detection (for interactivity)
- Environment variables (NO_COLOR, FORCE_COLOR)

### 1. Entry Point Layer

#### src/index.ts
**Responsibilities:**
- Parse command-line arguments using CAC
- Initialize global options (verbose, log-file)
- Route to appropriate command handlers
- Set up output encoding for cross-platform compatibility

**Key Components:**
```typescript
- cac(): CLI framework initialization
- cli.command(): Register commands (new, update, versions)
- cli.option(): Global options handling
- logger.setVerbose(): Verbose mode configuration
```

**Data Flow:**
```
User Input → CAC Parser → Command Router → Command Handler
```

### 2. Command Layer

#### src/commands/new.ts - Project Creation
**Responsibilities:**
- Validate command options via Zod schemas
- Handle interactive and non-interactive modes
- Orchestrate project creation workflow
- Manage user prompts and confirmations

**Key Operations:**
1. Parse and validate options
2. Select kit (interactive or flag)
3. Validate target directory
4. Authenticate with GitHub
5. Fetch release
6. Download and extract
7. Copy files to destination
8. Display success message

**Dependencies:**
- AuthManager: Authentication
- GitHubClient: Release fetching
- DownloadManager: File download/extraction
- FileMerger: File copying
- PromptsManager: User interaction

#### src/commands/update.ts - Project Updates
**Responsibilities:**
- Update existing projects to new versions
- Preserve custom .claude files
- Detect and handle file conflicts
- Request user confirmation for overwrites
- **Support global flag for platform-specific config paths**

**Key Operations:**
1. Parse and validate options (including global flag)
2. Set global flag in ConfigManager via setGlobalFlag()
3. Validate existing project directory
4. Authenticate with GitHub
5. Fetch release
6. Download and extract to temp
7. Scan for custom files
8. Merge with conflict detection
9. Protect custom files
10. Display update summary

**Unique Features:**
- FileScanner integration for custom file detection
- Protected pattern addition for custom files
- Confirmation required for overwrites
- **Global flag support: `ck update --global` or `ck update -g`**
- **Platform-specific config paths via PathResolver**

#### src/commands/version.ts - Version Listing
**Responsibilities:**
- List available releases for kits
- Filter by kit type and release status
- Display formatted release information
- Support pagination

**Key Operations:**
1. Authenticate with GitHub
2. Fetch releases in parallel for multiple kits
3. Filter by prerelease/draft status
4. Format and display release metadata
5. Show relative timestamps

**Performance:**
- Parallel fetching for multiple kits
- Configurable result limits
- Efficient metadata display

#### src/commands/uninstall.ts - ClaudeKit Uninstaller
**Responsibilities:**
- Detect valid ClaudeKit installations
- Display installation paths before deletion
- Request user confirmation
- Safely remove directories

**Key Operations:**
1. Detect local and global installations via claudekit-scanner
2. Validate installations (must have metadata.json)
3. Display detected installations
4. Request confirmation (unless --yes flag)
5. Remove directories using rmSync with recursive + force
6. Display success message

**Safety Features:**
- Only removes validated ClaudeKit installations
- Interactive confirmation required (unless --yes)
- Clear path display before deletion
- Error handling for removal failures

### 3. Core Library Layer

#### src/lib/auth.ts - Authentication Manager
**Architecture:**
```
┌─────────────────────────────────────────────────────┐
│              Multi-Tier Authentication               │
│                                                      │
│  1. GitHub CLI (gh auth token)                     │
│       ↓ (if not available)                          │
│  2. Environment Variables (GITHUB_TOKEN, GH_TOKEN) │
│       ↓ (if not set)                                │
│  3. Config File (~/.claudekit/config.json)         │
│       ↓ (if not found)                              │
│  4. OS Keychain (keytar)                           │
│       ↓ (if not stored)                             │
│  5. User Prompt (with save option)                 │
└─────────────────────────────────────────────────────┘
```

**Responsibilities:**
- Implement multi-tier authentication fallback
- Validate token format
- Securely store tokens in OS keychain
- Cache tokens in memory
- Track authentication method

**Security Features:**
- Token format validation (ghp_*, github_pat_*)
- Never log tokens
- Secure keychain storage
- In-memory caching after first fetch

#### src/lib/github.ts - GitHub Client
**Architecture:**
```
┌───────────────────────────────────────────────┐
│           GitHub Client (Octokit)              │
│                                                │
│  Authentication → API Requests → Response     │
│                                                │
│  Operations:                                   │
│  • getLatestRelease()                         │
│  • getReleaseByTag()                          │
│  • listReleases()                             │
│  • checkAccess()                              │
│  • getDownloadableAsset() [static]           │
└───────────────────────────────────────────────┘
```

**Responsibilities:**
- Wrap Octokit REST API client
- Fetch releases (latest or by tag)
- Verify repository access
- Select appropriate download asset
- Handle GitHub API errors with proper status codes

**Asset Selection Priority:**
1. Official ClaudeKit package (.zip with "claudekit" + "package")
2. Custom uploaded assets (.tar.gz, .tgz, .zip)
3. GitHub automatic tarball (fallback)

**Error Handling:**
- 401: Authentication failure
- 403: Access denied
- 404: Release/repository not found
- Generic error with status code

#### src/lib/download.ts - Download Manager
**Architecture:**
```
┌────────────────────────────────────────────────────┐
│              Download Manager                       │
│                                                     │
│  Download → Extract → Validate → Clean            │
│                                                     │
│  Features:                                          │
│  • Streaming downloads                             │
│  • Progress tracking                               │
│  • Archive extraction (TAR.GZ, ZIP)               │
│  • Security validation                             │
│  • Exclude pattern filtering                      │
└────────────────────────────────────────────────────┘
```

**Responsibilities:**
- Stream downloads with progress bars
- Extract TAR.GZ and ZIP archives
- Validate extraction safety
- Apply exclude patterns
- Detect and strip wrapper directories
- Prevent path traversal attacks
- Prevent archive bombs

**Security Measures:**
```typescript
// Path Traversal Prevention
isPathSafe() → Validates paths before extraction

// Archive Bomb Prevention
checkExtractionSize() → Limits total extraction to 500MB

// Exclude Pattern Enforcement
shouldExclude() → Filters unwanted files
```

**Wrapper Detection:**
```
Pattern Matching:
• Version: project-v1.0.0, project-1.2.3
• Prerelease: project-v1.0.0-alpha, project-2.0.0-rc.1
• Commit Hash: project-abc1234 (7-40 chars)

Action: Strip wrapper directory, move contents to root
```

#### src/lib/merge.ts - File Merger
**Architecture:**
```
┌─────────────────────────────────────────────────┐
│              File Merger                         │
│                                                  │
│  Scan → Detect Conflicts → Confirm → Copy      │
│                                                  │
│  Protected Patterns:                            │
│  • .env files                                   │
│  • Private keys                                 │
│  • node_modules                                 │
│  • .git directory                               │
│  • Custom user patterns                        │
└─────────────────────────────────────────────────┘
```

**Responsibilities:**
- Detect file conflicts before merging
- Request user confirmation for overwrites
- Preserve protected files
- Copy files with overwrite control
- Track merge statistics

**Protected File Logic:**
```
Protected file + exists in destination = Skip
Protected file + NOT in destination = Copy (new file)
Non-protected file = Copy (with confirmation)
```

**User Interaction:**
```
Conflict Detected → Show Files → Request Confirmation → Proceed/Cancel
```

#### src/lib/prompts.ts - Prompt Manager
**Responsibilities:**
- Provide beautiful CLI interface using @clack/prompts
- Handle kit selection
- Get directory input
- Request confirmations
- Display intro/outro messages
- Wrap prompts for safety

**UI Components:**
- intro(): Welcome message
- outro(): Completion message
- note(): Information display
- select(): Choice selection
- text(): Text input
- confirm(): Yes/no confirmation

### 4. Utilities Layer

#### src/utils/config.ts - Configuration Manager
**Architecture:**
```
┌──────────────────────────────────────────────┐
│         Configuration Manager                 │
│                                               │
│  Local mode (default):                       │
│    ~/.claudekit/config.json                  │
│                                               │
│  Global mode (--global):                     │
│    macOS/Linux: ~/.config/claude/config.json │
│    Windows: %LOCALAPPDATA%\claude\config.json│
│                                               │
│  {                                            │
│    "github": {                               │
│      "token": "stored_in_keychain"          │
│    },                                         │
│    "defaults": {                             │
│      "kit": "engineer",                      │
│      "dir": "."                              │
│    }                                          │
│  }                                            │
└──────────────────────────────────────────────┘
```

**Responsibilities:**
- Load/save user configuration
- Manage default settings
- Handle token storage (delegates to keychain)
- JSON-based persistent storage
- Global flag support for platform-specific paths
- Delegates path resolution to PathResolver

**Configuration Paths:**
Local mode (backward compatible):
- All platforms: `~/.claudekit/config.json`

Global mode (XDG-compliant):
- macOS/Linux: `~/.config/claude/config.json` (respects XDG_CONFIG_HOME)
- Windows: `%LOCALAPPDATA%\claude\config.json`

#### src/utils/path-resolver.ts - Path Resolver
**Responsibilities:**
- Platform-aware path resolution for config and cache directories
- XDG Base Directory specification compliance
- Windows %LOCALAPPDATA% integration
- Support both local and global installation modes
- Centralized path building for ClaudeKit components

**Path Resolution Strategy:**
```
Global Flag Check
  │
  ├─ Local Mode (false)
  │   └─ ~/.claudekit/config.json (backward compatible)
  │
  └─ Global Mode (true)
      ├─ Windows: %LOCALAPPDATA%\claude\config.json
      └─ macOS/Linux:
          ├─ Check XDG_CONFIG_HOME env var
          ├─ Use XDG_CONFIG_HOME/claude if set
          └─ Fallback: ~/.config/claude (XDG default)
```

**Cache Directory Resolution:**
```
Global Flag Check
  │
  ├─ Local Mode (false)
  │   └─ ~/.claudekit/cache (backward compatible)
  │
  └─ Global Mode (true)
      ├─ Windows: %LOCALAPPDATA%\claude\cache
      └─ macOS/Linux:
          ├─ Check XDG_CACHE_HOME env var
          ├─ Use XDG_CACHE_HOME/claude if set
          └─ Fallback: ~/.cache/claude (XDG default)
```

**New PathResolver Methods (v1.5.1+):**

#### getPathPrefix(global: boolean): string
**Purpose:** Returns directory prefix based on installation mode
- Local mode: Returns ".claude"
- Global mode: Returns "" (empty string)

**Usage Example:**
```typescript
const prefix = PathResolver.getPathPrefix(false); // ".claude"
const prefix = PathResolver.getPathPrefix(true);  // ""
```

#### buildSkillsPath(baseDir: string, global: boolean): string
**Purpose:** Builds skills directory path for both local and global installations
- Local mode: `{baseDir}/.claude/skills`
- Global mode: `{baseDir}/skills`

**Usage Example:**
```typescript
// Local project installation
const localSkills = PathResolver.buildSkillsPath("/my-project", false);
// Result: "/my-project/.claude/skills"

// Global kit installation
const globalSkills = PathResolver.buildSkillsPath(PathResolver.getGlobalKitDir(), true);
// Result: "~/.claude/skills"
```

#### buildComponentPath(baseDir: string, component: string, global: boolean): string
**Purpose:** Builds component directory paths for agents, commands, workflows, hooks
- Local mode: `{baseDir}/.claude/{component}`
- Global mode: `{baseDir}/{component}`

**Usage Example:**
```typescript
// Local project agents
const localAgents = PathResolver.buildComponentPath("/my-project", "agents", false);
// Result: "/my-project/.claude/agents"

// Global kit agents
const globalAgents = PathResolver.buildComponentPath(PathResolver.getGlobalKitDir(), "agents", true);
// Result: "~/.claude/agents"
```

**Global vs Local Directory Structures:**
```
Local Mode (Project Installation):
/project/
├── .claude/
│   ├── agents/
│   ├── commands/
│   ├── workflows/
│   ├── hooks/
│   └── skills/

Global Mode (Kit Installation):
~/.claude/
├── agents/
├── commands/
├── workflows/
├── hooks/
└── skills/
```

**Pattern Matching Integration:**
The new PathResolver methods enable proper pattern matching for directory selection:
- Automatic detection of local vs global mode based on directory structure
- Consistent path building across all CLI commands
- Backward compatibility with existing local installations

#### src/utils/logger.ts - Logger
**Architecture:**
```
┌────────────────────────────────────────────────┐
│              Logger                             │
│                                                 │
│  Input → Sanitize → Format → Output           │
│                                                 │
│  Levels:                                        │
│  • debug   (verbose mode only)                 │
│  • info    (standard messages)                 │
│  • success (completion messages)               │
│  • warning (recoverable issues)                │
│  • error   (failures)                          │
│  • verbose (detailed debugging)                │
└────────────────────────────────────────────────┘
```

**Responsibilities:**
- Provide structured logging
- Sanitize sensitive data (tokens)
- Support verbose mode
- Write to log files
- Format messages consistently

**Token Sanitization:**
```typescript
// Patterns:
ghp_[a-zA-Z0-9]{36} → ghp_***
github_pat_[a-zA-Z0-9_]{82} → github_pat_***
```

**Verbose Mode Activation:**
- Flag: `--verbose` or `-v`
- Environment: `CLAUDEKIT_VERBOSE=1`

#### src/utils/file-scanner.ts - File Scanner
**Responsibilities:**
- Recursively scan directories
- Find custom files (in dest but not source)
- Return relative paths
- Support subdirectory scanning

**Key Methods:**
```typescript
getFiles(dir: string): Promise<string[]>
  → Returns all files with relative paths

findCustomFiles(destDir, sourceDir, subdir): Promise<string[]>
  → Returns files in destDir/subdir but not in sourceDir/subdir
```

**Use Case:**
- Detect custom .claude files during updates
- Preserve user customizations
- Add custom files to protected patterns

#### src/utils/safe-prompts.ts & safe-spinner.ts
**Responsibilities:**
- Wrap interactive components for CI safety
- Detect non-TTY environments
- Provide graceful fallbacks
- Handle prompt cancellation

**CI Detection:**
```typescript
const isNonInteractive =
  !process.stdin.isTTY ||
  process.env.CI === "true" ||
  process.env.NON_INTERACTIVE === "true"
```

### 5. Type System

#### src/types.ts - Type Definitions
**Categories:**

**1. Domain Types:**
```typescript
KitType: "engineer" | "marketing"
ArchiveType: "tar.gz" | "zip"
AuthMethod: "gh-cli" | "env-var" | "keychain" | "prompt"
```

**2. Zod Schemas (Runtime Validation):**
```typescript
ExcludePatternSchema: Validates exclude patterns
NewCommandOptionsSchema: New command validation
UpdateCommandOptionsSchema: Update command validation
VersionCommandOptionsSchema: Version command validation
ConfigSchema: Configuration validation
GitHubReleaseSchema: GitHub API response validation
```

**3. Custom Errors:**
```typescript
ClaudeKitError → Base error
  ├─ AuthenticationError
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
      ┌──────────────────────┐
      │  AuthManager.getToken() │
      └──────────┬───────────┘
                 │
                 ▼
      ┌──────────────────────────────────┐
      │  Try: GitHub CLI (gh auth token)  │
      └──────────┬───────────────────────┘
                 │
           Success?──Yes──► Return Token + Method
                 │
                No
                 │
                 ▼
      ┌──────────────────────────────────┐
      │  Try: Environment Variables       │
      │  (GITHUB_TOKEN, GH_TOKEN)        │
      └──────────┬───────────────────────┘
                 │
           Success?──Yes──► Return Token + Method
                 │
                No
                 │
                 ▼
      ┌──────────────────────────────────┐
      │  Try: Config File                │
      │  (~/.claudekit/config.json)      │
      └──────────┬───────────────────────┘
                 │
           Success?──Yes──► Return Token + Method
                 │
                No
                 │
                 ▼
      ┌──────────────────────────────────┐
      │  Try: OS Keychain (keytar)       │
      └──────────┬───────────────────────┘
                 │
           Success?──Yes──► Return Token + Method
                 │
                No
                 │
                 ▼
      ┌──────────────────────────────────┐
      │  Prompt User for Token           │
      │  • Validate format               │
      │  • Ask to save to keychain       │
      └──────────┬───────────────────────┘
                 │
                 ▼
      ┌──────────────────────────────────┐
      │  Return Token + Method: "prompt" │
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
│  • OS keychain encryption (keytar)              │
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

#### OS Keychain
```typescript
// Operations:
keytar.getPassword(service, account)
keytar.setPassword(service, account, password)
keytar.deletePassword(service, account)

// Service: "claudekit-cli"
// Account: "github-token"
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
