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

---

## Related Documentation

- **System Architecture**: `./system-architecture.md` - Detailed component design
- **Code Standards**: `./code-standards.md` - Development patterns and conventions
- **Project Overview**: `./project-overview-pdr.md` - Product requirements
- **Codebase Summary**: `./codebase-summary.md` - File organization and dependencies
