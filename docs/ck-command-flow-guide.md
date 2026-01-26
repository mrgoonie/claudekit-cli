# ClaudeKit CLI (`ck`) Command Flow Guide

## Overview

ClaudeKit CLI (`ck`) is the primary user interface for bootstrapping and managing ClaudeKit projects. It uses the **cac framework** for command parsing and follows a **phase-based execution model** for all major operations.

### Available Commands

| Command | Purpose | Key Flags |
|---------|---------|-----------|
| `new` | Bootstrap new ClaudeKit project | `--kit`, `--release`, `--force`, `--yes` |
| `init` | Initialize/update existing project | `--fresh`, `--sync`, `--dry-run`, `--yes` |
| `doctor` | Health check of ClaudeKit setup | `--fix`, `--json`, `--report`, `--full` |
| `update` | Update CLI to latest version | `--check`, `--yes`, `--beta` |
| `versions` | List available ClaudeKit versions | `--kit`, `--limit`, `--all` |
| `uninstall` | Remove ClaudeKit installations | `--local`, `--global`, `--yes`, `--dry-run` |
| `easter-egg` | Code Hunt 2025 discount generator | None |

### Global Flags

- `--verbose` - Enable debug logging
- `--json` - Machine-readable output
- `--log-file <path>` - Write logs to file
- `-V, --version` - Show version
- `-h, --help` - Show help

---

## 1. CLI Entry Flow

```mermaid
flowchart TD
    A["User: ck command --flags"] --> B["src/index.ts<br/>Main Entry Point"]
    B --> C["createCliInstance()<br/>+ registerCommands()"]
    B --> D["registerGlobalFlags()"]
    C --> E["cli.parse argv<br/>run: false"]
    D --> E
    E --> F{"Check Flags"}
    F -->|--version| G["displayVersion()"]
    F -->|--help or no cmd| H["handleHelp()"]
    F -->|command| I["Configure Output<br/>verbose/json/logFile"]
    G --> J["Exit"]
    H --> J
    I --> K["cli.runMatchedCommand()"]
    K --> L["Matched Command Handler"]
    L --> J
```

### Entry Point Details

**File**: `src/index.ts`

- Creates CLI instance with `cac('ck')`
- Registers all commands via `command-registry.ts`
- Sets up three-stage initialization:
  1. Command registration and global flags
  2. Parse argv with `run: false` (prevents auto-execution)
  3. Check for version/help/command before execution
- Graceful shutdown handlers for SIGINT/SIGTERM
- JSON buffer flushed on exit to prevent data loss

---

## 2. `ck new` Command Flow

```mermaid
flowchart TD
    A["User: ck new [options]"] --> B["Validate Options<br/>Zod Schema"]
    B --> C{"Mutual<br/>Exclusivity<br/>OK?"}
    C -->|No| D["Show Error Message"]
    D --> E["Exit 1"]
    C -->|Yes| F["Intro: Display Banner"]
    F --> G["Phase 1: Directory Setup"]
    G --> H{"Target Dir<br/>Exists?"}
    H -->|No| I["Create Directory"]
    H -->|Yes| J{"--force?"}
    J -->|No| K["Confirm Overwrite"]
    J -->|Yes| L["Continue"]
    I --> M["Phase 2: Project Creation"]
    K --> N{"User<br/>Agrees?"}
    N -->|No| E
    N -->|Yes| M
    L --> M
    M --> O["selectVersion()"]
    O --> P["downloadKit<br/>GitHub Release"]
    P --> Q["extractArchive<br/>zip/tar.gz"]
    Q --> R["mergeFiles<br/>Ownership Checks"]
    R --> S["Phase 3: Post-Setup"]
    S --> T{"Post-Install<br/>Tasks?"}
    T -->|--install-skills| U["installSkills()"]
    T -->|--gemini| V["installGemini()"]
    T -->|--opencode| W["installOpenCode()"]
    U --> X["Outro: Success Message"]
    V --> X
    W --> X
    T -->|None| X
    X --> Y["Show Update Hint"]
    Y --> Z["Exit 0"]
```

### `ck new` Phases

**Phase 1: Directory Setup** (`handleDirectorySetup`)
- Validate/create target directory
- Check for ownership conflicts
- Confirm overwrite if directory exists

**Phase 2: Project Creation** (`handleProjectCreation`)
- Select version (interactive or `--release`)
- Download kit from GitHub release
- Extract archive (zip or tar.gz)
- Merge files with ownership protection
- Install npm dependencies

**Phase 3: Post-Setup** (`handlePostSetup`)
- Optional: Install skills
- Optional: Install Gemini MCP
- Optional: Open in code editor
- Setup wizard: Prompts for required env keys (e.g., `GEMINI_API_KEY`) if missing

---

## 3. `ck init` Command Flow

```mermaid
flowchart TD
    A["User: ck init [options]"] --> B["Validate Options<br/>Zod Schema"]
    B --> C["Check Directory<br/>Exists"]
    C --> D{"Project<br/>Valid?"}
    D -->|No| E["Show Error"]
    E --> F["Exit 1"]
    D -->|Yes| G["Run Preflight Checks"]
    G --> H{"Checks<br/>Pass?"}
    H -->|No| I["Suggest Fixes"]
    I --> F
    H -->|Yes| J["Phase 1: Directory Validation"]
    J --> K{"--fresh?"}
    K -->|Yes| L["Remove .claude dir"]
    K -->|No| M["Phase 2: Installation"]
    L --> N{"--dry-run?"}
    M --> N
    N -->|Yes| O["Show Changes<br/>No Apply"]
    N -->|No| P["Download Kit Release"]
    O --> Q["Phase 3: Completion"]
    P --> R["Extract Archive"]
    R --> S{"--sync?"}
    S -->|Yes| T["Interactive Merge<br/>Conflict Resolution"]
    S -->|No| U["Auto Merge<br/>Preserve User Files"]
    T --> V["Merge Files"]
    U --> V
    V --> W["Update Settings"]
    W --> Q
    Q --> X["Success Message"]
    X --> Y["Exit 0"]
```

### `ck init` Features

- Handles merge conflicts interactively via `--sync`
- Ownership protection prevents overwriting user files
- Fresh install option (`--fresh`) removes `.claude` dir
- Settings merge preserves customizations
- Dry-run mode shows changes without applying
- Setup wizard: Checks required env keys exist (not just `.env` file), prompts if missing

---

## 4. `ck doctor` Command Flow

```mermaid
flowchart TD
    A["User: ck doctor [options]"] --> B["Create CheckRunner"]
    B --> C["Register Checkers"]
    C --> D["System Checker"]
    C --> E["GitHub Checker"]
    C --> F["Auth Checker"]
    C --> G["Installation Checker"]
    C --> H["Skills Checker"]
    D --> I["Execute All<br/>in Parallel"]
    E --> I
    F --> I
    G --> I
    H --> I
    I --> J["Collect Results"]
    J --> K{"Output<br/>Mode?"}
    K -->|--json| L["JSON Report"]
    K -->|--report| M["Text Report"]
    K -->|Default| N["Interactive UI"]
    L --> O["Exit 0"]
    M --> P["Upload to Gist"]
    P --> O
    N --> Q{"User Action?"}
    Q -->|View Details| R["Show Detailed Info"]
    Q -->|Fix Issues| S["--fix Applied?"]
    R --> Q
    S -->|Yes| T["Apply Auto-Fixes"]
    S -->|No| U["Show Suggestions"]
    T --> V["Re-run Checks"]
    U --> Q
    V --> Q
    Q -->|Done| O
```

### `ck doctor` Checkers

**Installation Checks**
- Global/project install detection
- CLI installation method (npm, bun, yarn)

**Configuration Checks**
- Settings file validity
- Required fields present
- Path references valid

**System Checks**
- Node.js, npm, Python, git, gh CLI versions
- OS detection (macOS/Windows/Linux)
- Shell detection (Bash, zsh, PowerShell)
- Environment PATH and HOME

**Auth Checks**
- GitHub CLI authentication status
- API connectivity and rate limits

**Project Checks**
- Skill components and dependencies
- Slash command hooks present
- Active CLAUDE.md file
- Required environment keys (e.g., `GEMINI_API_KEY`) in `.env`

---

## 5. Error Handling Flow

```mermaid
flowchart TD
    A["Error Occurs<br/>in Domain"] --> B["Catch Error"]
    B --> C["ErrorClassifier<br/>Analyze Error"]
    C --> D{"Error<br/>Type?"}
    D -->|HTTP 401| E["AUTH_MISSING"]
    D -->|HTTP 403<br/>Rate Limit| F["RATE_LIMIT"]
    D -->|HTTP 403| G["AUTH_SCOPE"]
    D -->|HTTP 404| H["REPO_NOT_FOUND"]
    D -->|Network| I["NETWORK"]
    D -->|SSH Key| J["SSH_KEY"]
    D -->|Other| K["UNKNOWN"]
    E --> L["ActionSuggester<br/>Map Category"]
    F --> L
    G --> L
    H --> L
    I --> L
    J --> L
    K --> L
    L --> M["Return Actions<br/>+ Commands"]
    M --> N["Logger Output<br/>to User"]
    N --> O{"--verbose?"}
    O -->|Yes| P["Show Debug Info<br/>Stack Trace"]
    O -->|No| Q["Show User-Friendly<br/>Message"]
    P --> R["Exit 1"]
    Q --> R
```

### Error Categories

| Category | Cause | Example | Action |
|----------|-------|---------|--------|
| `RATE_LIMIT` | API rate limit exceeded | 403 with rate-limit header | Wait or re-authenticate |
| `AUTH_MISSING` | GitHub token invalid/expired | 401 Unauthorized | `gh auth login` |
| `AUTH_SCOPE` | Insufficient permissions | 403 without rate-limit | Check scope via `gh auth status` |
| `REPO_NOT_FOUND` | Repository not accessible | 404 Not Found | Check GitHub notifications |
| `NETWORK` | Network connectivity issue | ECONNREFUSED, ETIMEDOUT | `ping github.com` |
| `SSH_KEY` | SSH authentication failed | SSH key errors | Generate key or add to GitHub |
| `UNKNOWN` | Unclassified error | Generic error | Run with `--verbose` |

---

## 6. GitHub Authentication Flow

```mermaid
flowchart TD
    A["Need GitHub Token"] --> B["Check Token Cache"]
    B --> C{"Token<br/>Cached?"}
    C -->|Yes| D["Return Cached<br/>Token"]
    C -->|No| E["Priority Chain"]
    E --> F["Try: GITHUB_TOKEN<br/>env var"]
    F --> G{"Token<br/>Found?"}
    G -->|Yes| H["Cache Token"]
    G -->|No| I["Try: GH_TOKEN<br/>env var"]
    I --> J{"Token<br/>Found?"}
    J -->|Yes| H
    J -->|No| K["Try: gh CLI<br/>gh auth token"]
    K --> L{"gh CLI<br/>Installed?"}
    L -->|Yes| M{"Token<br/>Retrieved?"}
    L -->|No| N["Token Fetch Failed"]
    M -->|Yes| H
    M -->|No| N
    H --> O["Return Token"]
    N --> P["Gather Diagnostics"]
    P --> Q["gh --version"]
    Q --> R["gh auth status"]
    R --> S["Token Scopes"]
    S --> T["Show Error Message<br/>+ Guidance"]
    T --> U["Exit 1"]
```

### GitHub Auth Strategy

**Token Priority**:
1. `GITHUB_TOKEN` environment variable (fastest)
2. `GH_TOKEN` environment variable
3. `gh CLI` (with `-h github.com` for multi-host)
4. Detailed error with diagnostics

**Token Caching**:
- Single token per CLI session
- Mutex prevents race conditions
- Cleared after 401 errors

**Fallback Chain**:
- Tries with `-h github.com` flag first
- Falls back to without flag for older `gh` versions
- 5-second timeout per command to prevent hangs

---

## 7. Ownership Tracking System

ClaudeKit uses file ownership tracking to protect user-modified files and prevent unintended overwrites during installations and updates. This system implements the Python packaging standards (pip RECORD pattern) adapted for ClaudeKit's multi-kit environment.

### TrackedFile Interface

Every file in the `.claude` directory is tracked with ownership metadata:

```typescript
interface TrackedFile {
  path: string;                    // Relative path from .claude (e.g., "rules/development-rules.md")
  checksum: string;                // SHA-256 hash of file content (hex format, 64 chars)
  ownership: FileOwnership;        // "ck" | "user" | "ck-modified"
  installedVersion: string;        // ClaudeKit version that installed it
  baseChecksum?: string;           // Original checksum at install (for sync detection)
  sourceTimestamp?: string;        // Git commit timestamp from kit repo (ISO 8601)
  installedAt?: string;            // When file was installed locally (ISO 8601)
}

type FileOwnership = "ck" | "user" | "ck-modified";
```

### metadata.json Structure

The `.claude/metadata.json` file tracks all installed files with multi-kit support:

```json
{
  "kits": {
    "engineer": {
      "version": "0.5.0",
      "installedAt": "2025-01-21T10:30:00.000Z",
      "files": [
        {
          "path": "CLAUDE.md",
          "checksum": "abc123def456...",
          "ownership": "ck",
          "installedVersion": "0.5.0"
        },
        {
          "path": "rules/development-rules.md",
          "checksum": "fed789abc456...",
          "ownership": "ck-modified",
          "installedVersion": "0.5.0",
          "baseChecksum": "fed789abc457..."
        }
      ],
      "installedSettings": {
        "hooks": ["/cook"],
        "mcpServers": ["gemini-mcp"]
      }
    }
  },
  "scope": "local"
}
```

### Ownership Determination

The `OwnershipChecker` class determines file ownership through this logic:

```mermaid
flowchart TD
    A["File Path"] --> B["Stat File"]
    B --> C{"File<br/>Exists?"}
    C -->|No| D["ownership: user<br/>exists: false"]
    C -->|Yes| E{"Metadata<br/>Present?"}
    E -->|No| F["Legacy Install"]
    E -->|Yes| G["Check Files Array"]
    F --> H["ownership: user"]
    G --> I{"File in<br/>Tracked Files?"}
    I -->|No| J["ownership: user"]
    I -->|Yes| K["Calculate<br/>File Checksum"]
    K --> L{"Checksum<br/>Match?"}
    L -->|Yes| M["ownership: ck<br/>Pristine CK file"]
    L -->|No| N["ownership: ck-modified<br/>User edited CK file"]
    D --> O["Result"]
    H --> O
    J --> O
    M --> O
    N --> O
```

**Ownership Classes:**
- **`"ck"`** - ClaudeKit-owned file, unchanged since install (pristine)
- **`"ck-modified"`** - ClaudeKit-owned file, user has modified
- **`"user"`** - User-created file, not from ClaudeKit

---

## 8. File Merge & Migration Flow

When installing or updating ClaudeKit, the system must merge new files with existing installations while preserving user modifications. This section covers legacy migration and modern merge logic.

### Legacy Installation Detection

```mermaid
flowchart TD
    A["Installation Exists"] --> B["Read .claude/metadata.json"]
    B --> C{"File<br/>Found?"}
    C -->|No| D["Legacy: no-metadata<br/>Confidence: high"]
    C -->|Yes| E{"files Array<br/>Present?"}
    E -->|No| F["Legacy: old-format<br/>Confidence: high"]
    E -->|Yes| G["Current: already migrated<br/>Confidence: high"]
    D --> H["Return Detection Result"]
    F --> H
    G --> H
```

### File Classification During Migration

When migrating a legacy install, files are classified by comparing against the release manifest:

```typescript
interface MigrationPreview {
  ckPristine: string[];     // CK files, unmodified
  ckModified: string[];     // CK files, user edited
  userCreated: string[];    // User's custom files
  totalFiles: number;
}
```

**Classification Steps:**
1. Scan all files in `.claude` directory recursively
2. For each file, compute relative path (normalized to forward slashes)
3. Look up file in release manifest by path
4. If not in manifest → `userCreated` (no checksum calculation)
5. If in manifest → calculate SHA-256 checksum
6. Compare checksum:
   - Match → `ckPristine`
   - Mismatch → `ckModified`

### Checksum Calculation

Checksums use **streaming SHA-256** for memory efficiency:

```typescript
async calculateChecksum(filePath: string): Promise<string> {
  // Returns hex string (64 characters)
  // Example: "abc123def456789..." (lowercase hex digits)
}
```

**Important for Global Installs:** When generating the release manifest (`bun scripts/generate-release-manifest.ts`), checksums are calculated AFTER applying path transformation. This ensures manifest checksums match files after `ck init -g` transforms `.claude/` paths to `$HOME/.claude/`.

### Migration Execution

```mermaid
flowchart TD
    A["ck new/init"] --> B["Load Release Manifest"]
    B --> C["Run Legacy Detection"]
    C --> D{"Legacy<br/>Install?"}
    D -->|No| E["Skip Migration"]
    D -->|Yes| F["Classify Files"]
    F --> G["Generate Preview"]
    G --> H["Log Migration Summary"]
    H --> I["Batch Calculate Checksums"]
    I --> J["Build TrackedFile Array"]
    J --> K["Write metadata.json"]
    K --> L["Success"]
    E --> L
```

**Concurrency:** File checksums are calculated with concurrency limiting (mapWithLimit) to prevent EMFILE errors on Windows with large file sets.

---

## 9. Release Manifest Generation

The release manifest (`release-manifest.json`) is the source of truth for file ownership verification. It tracks all ClaudeKit-owned files with checksums computed AFTER path transformation.

### Purpose

- **Ownership verification**: Compare installed file checksums against manifest to determine ownership
- **Path transformation compensation**: Manifest includes post-transformation checksums so global installs work correctly
- **File integrity**: Detect user modifications vs pristine CK files
- **Multi-kit support**: Enables reliable file tracking across kit updates

### Generation Process

```bash
# From kit repository root
bun scripts/generate-release-manifest.ts /path/to/.claude
```

**Script Workflow:**

```mermaid
flowchart TD
    A["Scan .claude directory"] --> B["Collect all files"]
    B --> C["Filter skip directories"]
    C --> D["For each file"]
    D --> E{"Transformable?<br/>md, js, ts,<br/>json, sh, etc."}
    E -->|Yes| F["Read content"]
    F --> G["Apply path transformation<br/>.claude → $HOME/.claude"]
    G --> H["Calculate SHA-256<br/>of transformed content"]
    H --> I["Add to manifest<br/>with path, checksum, size"]
    E -->|No| J["Read file as binary"]
    J --> K["Calculate SHA-256<br/>of raw bytes"]
    K --> I
    I --> L["More files?"]
    L -->|Yes| D
    L -->|No| M["Write release-manifest.json"]
    M --> N["Output statistics"]
```

### Manifest Structure

```json
{
  "version": "0.5.0",
  "generatedAt": "2025-01-21T10:30:00.000Z",
  "files": [
    {
      "path": "CLAUDE.md",
      "checksum": "abc123def456789abc123def456789abc123def456789abc123def456789abc1",
      "size": 2048
    },
    {
      "path": "rules/development-rules.md",
      "checksum": "fed789abc456def789abc456def789abc456def789abc456def789abc456def78",
      "size": 5120
    }
  ]
}
```

### File Type Handling

**Transformable Extensions:**
```
.md, .js, .ts, .json, .sh, .ps1, .yaml, .yml, .toml
```

**Always Transformed (regardless of extension):**
```
CLAUDE.md, claude.md
```

**Non-transformable Files:**
- Binary files (.png, .jpg, .pdf, etc.) - checksummed as-is
- Directories with excluded names (node_modules, .git, __pycache__, etc.) - skipped entirely

---

## 10. Global Path Transformation

When installing ClaudeKit globally (with `-g` flag), file paths must be transformed from relative `.claude/` references to platform-appropriate home directory paths. This enables kit files to work correctly regardless of installation scope.

### Transformation Trigger

```mermaid
flowchart TD
    A["User: ck new/init -g<br/>Global Install"] --> B["Extract Kit Archive"]
    B --> C["Check Installation Scope"]
    C --> D{"Global<br/>Install?"}
    D -->|Yes| E["Transform Paths"]
    D -->|No| F["Skip Transformation"]
    E --> F --> G["Merge Files"]
    G --> H["Install Complete"]
```

### Platform-Specific Home Directory

| Platform | Env Variable | Transformed To | Example |
|----------|----------------|---|---------|
| Unix/Linux/macOS | `$HOME` | `./.claude/` → `$HOME/.claude/` | `/home/user/.claude/` |
| Windows (PowerShell) | `%USERPROFILE%` | `./.claude/` → `%USERPROFILE%/.claude/` | `C:\Users\User\.claude\` |

**Critical:** Use environment variable syntax, not literal paths:
- ✓ Correct: `$HOME/.claude/` (works everywhere)
- ✗ Wrong: `/home/user/.claude/` (hardcoded path)

### Path Transformation Patterns

The `GlobalPathTransformer` detects and transforms multiple patterns:

```typescript
// Unix-style patterns
./.claude/          → $HOME/.claude/
@.claude/           → @$HOME/.claude/
".claude/           → "$HOME/.claude/
`.claude/           → `$HOME/.claude/

// Windows patterns (when on Windows platform)
$HOME/.claude/      → %USERPROFILE%/.claude/
${HOME}/.claude/    → %USERPROFILE%/.claude/

// Project-relative (during global install)
$CLAUDE_PROJECT_DIR/.claude/     → $HOME/.claude/
${CLAUDE_PROJECT_DIR}/.claude/   → ${HOME}/.claude/
%CLAUDE_PROJECT_DIR%/.claude/    → %USERPROFILE%/.claude/

// Context patterns
: .claude/          → : $HOME/.claude/ (YAML/JSON colons)
(.claude/           → ($HOME/.claude/ (markdown links)
```

### Transformation Examples

**Before (global install):**
```markdown
# Configure Claude
Add your key to `./.claude/settings.json`
```

**After (Unix - $HOME used):**
```markdown
# Configure Claude
Add your key to `$HOME/.claude/settings.json`
```

**After (Windows - %USERPROFILE% used):**
```markdown
# Configure Claude
Add your key to `%USERPROFILE%/.claude/settings.json`
```

### Transformation Flow

```mermaid
flowchart TD
    A["File in Kit Archive"] --> B["Check File Extension"]
    B --> C{"Transformable?<br/>.md, .js, .ts,<br/>.json, .sh, etc."}
    C -->|No| D["Skip - Binary or<br/>non-transformable"]
    C -->|Yes| E["Read File Content"]
    E --> F["Apply Regex Patterns"]
    F --> G["Replace .claude/ paths<br/>with $HOME/.claude/"]
    G --> H{"Windows<br/>Platform?"}
    H -->|Yes| I["Convert $HOME<br/>to %USERPROFILE%"]
    H -->|No| J["Keep $HOME as-is"]
    I --> K["Write Transformed File"]
    J --> K
    D --> K
    K --> L["File Ready for Install"]
```

### Directory Skip Rules

During path transformation, these directories are **skipped** to avoid unintended transformations:

- `node_modules/` - Package dependencies
- `.git/` - Version control history
- `__pycache__/` - Python cache
- `.venv/`, `venv/` - Virtual environments
- Hidden directories (except `.claude/` itself) - To skip example projects with nested `.claude/`

**Design Note:** Archive source content should not contain nested `.claude` directories (e.g., example projects). If archives do contain nested `.claude` dirs, they're skipped to avoid unintended path transformations in template/example code.

### Transformation Statistics

After transformation, stats are reported:

```typescript
{
  filesTransformed: number;  // Files that had 1+ path replacements
  totalChanges: number;      // Total number of path patterns replaced
  filesSkipped: number;      // Files that couldn't be read
  skippedFiles: Array<{
    path: string;
    reason: string;         // "Permission denied", encoding error, etc.
  }>;
}
```

---

## Key Components

### Installation Domain (`src/domains/installation/`)

**DownloadManager**
- Fetch releases from GitHub API
- Stream-based downloads with progress tracking
- Automatic retry logic
- Temp directory fallback (OS tmp → `~/.claudekit/tmp`)

**Extractors**
- `TarExtractor` - Handle .tar.gz files
- `ZipExtractor` - Handle .zip files
- Both support exclusion patterns
- Extraction size tracking with warnings

**SelectiveMerger**
- Hybrid file comparison (size → checksum)
- Multi-kit awareness (detect shared files)
- Timestamp-based resolution for conflicts
- Manifest integration for ownership tracking

### GitHub Domain (`src/domains/github/`)

**AuthManager**
- Multi-tier token retrieval with caching
- Environment variable priority
- gh CLI integration
- Detailed error diagnostics

**GitHubClient**
- REST API endpoints (repos, releases)
- Release listing and asset downloads
- Repository metadata and access checks
- Error classification and handling

### Health Checks Domain (`src/domains/health-checks/`)

**CheckRunner**
- Orchestrates parallel checker execution
- Filters by group and priority
- Aggregates results into CheckSummary

**Checkers** (15+ specialized checkers)
- Installation, configuration, system checks
- Authentication and API connectivity
- Project setup and permissions validation

**AutoHealer**
- Automatic remediation for common issues
- Suggests or applies fixes based on check results

### Error Domain (`src/domains/error/`)

**ErrorClassifier**
- Maps HTTP errors to user-friendly categories
- Pattern matching on error messages
- Rate limit countdown calculation

**ActionSuggester**
- Category → actionable fix commands
- Provides clear step-by-step guidance
- Includes diagnostic information

### Migration Domain (`src/domains/migration/`)

**LegacyMigration**
- Detect legacy (pre-metadata) installations
- Scan directory recursively, filtering skip patterns
- Classify files as ckPristine, ckModified, or userCreated
- Batch checksum calculation with concurrency limiting
- Generate and persist migration preview
- Located in: `src/domains/migration/legacy-migration.ts`

**ReleaseManifestLoader**
- Load and validate release manifest from kit archives
- Query file checksums by relative path
- Support multi-kit installations
- Located in: `src/domains/migration/release-manifest.ts`

### File Operations Services (`src/services/file-operations/`)

**OwnershipChecker**
- Calculate SHA-256 checksums via streaming (memory efficient)
- Determine file ownership: ck, ck-modified, or user
- Batch check with concurrency limiting for EMFILE prevention
- Support multi-kit metadata format
- Located in: `src/services/file-operations/ownership-checker.ts`

**ManifestWriter & ManifestReader**
- Read/write metadata.json with schema validation
- Support both legacy single-kit and modern multi-kit formats
- Atomic writes to prevent partial updates
- Located in: `src/services/file-operations/manifest/`

### Path Transformers (`src/services/transformers/`)

**GlobalPathTransformer**
- Transform `.claude/` references to `$HOME/.claude/` (Unix) or `%USERPROFILE%/.claude/` (Windows)
- Apply transformation during global installs (`-g` flag)
- Support 10+ path patterns (relative, quoted, YAML/JSON, etc.)
- Process directories recursively with skip patterns
- Track transformation statistics (files transformed, total changes, skipped)
- Located in: `src/services/transformers/global-path-transformer.ts`

---

## Related Documentation

- **System Architecture**: `./system-architecture.md` - Detailed component design
- **Code Standards**: `./code-standards.md` - Development patterns and conventions
- **Project Overview**: `./project-overview-pdr.md` - Product requirements
- **Codebase Summary**: `./codebase-summary.md` - File organization and dependencies
