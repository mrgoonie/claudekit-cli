# ClaudeKit Config UI

Command-line tool and web dashboard for managing ClaudeKit projects.

**Version**: 1.17.0

## Overview

ClaudeKit Config UI (`ck`) provides both CLI and web dashboard for managing ClaudeKit projects. Built with Bun, TypeScript, and React, enables fast, secure project setup and comprehensive configuration management.

**Key Features:**
- **CLI Commands (14)**: new, init, config, projects, setup, skills, agents, commands, migrate, doctor, versions, update, uninstall, easter-egg
- **Web Dashboard**: Interactive React UI via `ck config ui` for configuration and project management
- **Projects Registry**: Centralized registry at `~/.claudekit/projects.json` with file locking
- **Skill Installation**: Install ClaudeKit skills to other coding agents (Cursor, Codex, etc.)
- **Multi-tier Authentication**: gh CLI → env vars → keychain → prompt fallback
- **Smart Merging**: Conflict detection with user customization preservation
- **Skills Migration**: Auto-detects and migrates skills structure changes
- **Offline Installation**: From local archives or directories
- **Security**: Path traversal protection, symlink validation, UNC path protection
- **Cross-Platform**: macOS, Linux, Windows with platform-specific optimizations
- **Update Notifications**: Intelligent 7-day cache for version checks

## Documentation

Comprehensive documentation in `/docs`:

- **[Codebase Summary](./docs/codebase-summary.md)** - Overview, structure, key components
- **[Project Overview & PDR](./docs/project-overview-pdr.md)** - Requirements, features, roadmap
- **[System Architecture](./docs/system-architecture.md)** - Architecture diagrams, data flow
- **[Reconciliation Architecture](./docs/reconciliation-architecture.md)** - `ck migrate` RECONCILE → EXECUTE → REPORT design
- **[Code Standards](./docs/code-standards.md)** - Coding conventions, best practices
- **[Project Roadmap](./docs/project-roadmap.md)** - Release timeline, feature status
- **[Deployment Guide](./docs/deployment-guide.md)** - Release procedures

## Prerequisites

Before using ClaudeKit CLI, you need to:

1. **Purchase a ClaudeKit Starter Kit** from [ClaudeKit.cc](https://claudekit.cc)
2. **Get Repository Access**: After purchase, you'll receive access to the private GitHub repository containing your kit
3. **Create a GitHub Personal Access Token** (PAT) with `repo` scope to download releases

Without a purchased kit and repository access, the CLI will not be able to download any project templates.

## Installation

The ClaudeKit CLI is published on npm at [npmjs.com/package/claudekit-cli](https://www.npmjs.com/package/claudekit-cli).

### Using npm (Recommended)

```bash
npm install -g claudekit-cli
```

### Using Bun

```bash
bun add -g claudekit-cli
```

### Using Yarn

```bash
yarn global add claudekit-cli
```

### Using pnpm

```bash
pnpm add -g claudekit-cli
```

After installation, verify it's working:

```bash
ck --version
```

## Usage

### Discoverability Quick Start

```bash
# Top-level command discovery
ck --help

# Open config dashboard immediately
ck config

# Command-level help (recommended)
ck config --help
ck skills --help
ck agents --help
ck commands --help
ck migrate --help
```

### Create New Project

```bash
# Interactive mode
ck new

# With options
ck new --dir my-project --kit engineer

# Show beta versions
ck new --beta

# With exclude patterns
ck new --exclude "*.log" --exclude "temp/**"

# Optional packages (OpenCode, Gemini)
ck new --opencode --gemini

# Install skills dependencies (Python, Node packages, system tools)
ck new --install-skills

# Command prefix (/ck: namespace to avoid conflicts)
ck new --prefix

# Offline installation (from local archive or directory)
ck new --archive ~/downloads/engineer-v1.16.0.zip
ck new --kit-path ~/extracted-kit/
```

**Flags:**
- `--install-skills`: Auto-install Python packages, system tools (FFmpeg, ImageMagick), Node.js packages
- `--prefix`: Move commands to /ck: namespace (/plan → /ck:plan)
- `--beta`: Show pre-release versions in selection
- `--opencode/--gemini`: Install optional packages
- `--archive <path>`: Use local archive (zip/tar.gz) instead of downloading
- `--kit-path <path>`: Use local kit directory instead of downloading

### Initialize or Update Project

**Note:** Run from project root.

```bash
# Interactive mode
ck init

# Non-interactive mode with sensible defaults
ck init --yes
ck init -y

# Combine with other flags
ck init -g --kit engineer -y

# With options
ck init --kit engineer --beta

# Global mode (platform-specific paths)
ck init --global

# Fresh installation (⚠️ DESTRUCTIVE - removes ALL customizations)
ck init --fresh

# With exclude patterns and prefix
ck init --exclude "*.local" --prefix

# Offline installation (from local archive or directory)
ck init --archive ~/downloads/engineer-v1.16.0.zip
ck init --kit-path ~/extracted-kit/
```

**Flags:**
- `--yes/-y`: Non-interactive mode with sensible defaults (skip all prompts)
- `--global/-g`: Use platform-specific config (macOS/Linux: ~/.claude, Windows: %USERPROFILE%\.claude)
- `--fresh`: Clean reinstall, removes .claude directory (requires "yes" confirmation)
- `--beta`: Show pre-release versions
- `--prefix`: Apply /ck: namespace to commands
- `--archive <path>`: Use local archive (zip/tar.gz) instead of downloading
- `--kit-path <path>`: Use local kit directory instead of downloading

**Default Behavior with `-y` Flag:**

| Prompt | Default |
|--------|---------|
| Select ClaudeKit | engineer (first option) |
| Target directory | Current directory (`.`) |
| Version selection | Latest stable release |
| Google Gemini setup | Skip |
| Other optional features | Skip |

### Update CLI

Keep the ClaudeKit CLI up to date:

```bash
# Check for CLI updates
ck update --check

# Update to latest version
ck update

# Update to specific version
ck update --version 1.17.0

# Update to beta / skip confirmation
ck update --beta
ck update --yes
```

The CLI notifies you when updates are available via `ck --version`.

**Skills Migration:**
- Auto-detects structure changes (flat → categorized)
- Preserves customizations (SHA-256 hashing)
- Creates backup before migration
- Rollback on failure

### List Available Versions

```bash
# Show all available versions for all kits
ck versions

# Filter by specific kit
ck versions --kit engineer
ck versions --kit marketing

# Show more versions (default: 30)
ck versions --limit 50

# Include prereleases and drafts
ck versions --all
```

### Diagnostics & Doctor

```bash
# Full health check (default)
ck doctor

# Verbose mode with execution timing and command details
ck doctor --verbose

# Generate shareable diagnostic report (prompts for gist upload)
ck doctor --report

# Auto-fix all fixable issues
ck doctor --fix

# CI mode: no prompts, exit 1 on failures
ck doctor --check-only

# Machine-readable JSON output
ck doctor --json

# Combine flags
ck doctor --verbose --check-only --json
ck doctor --verbose --fix
```

**Health Checks:**
- **System**: Node.js, npm, Python, pip, Claude CLI, git, gh CLI
- **ClaudeKit**: Global/project installation, versions, skills
- **Auth**: GitHub CLI authentication, repository access
- **Project**: package.json, node_modules, lock files
- **Modules**: Dynamic skill dependency resolution

**Auto-Fix Capabilities:**
| Issue | Fix Action |
|-------|------------|
| Missing dependencies | Install via package manager |
| Missing gh auth | Run `gh auth login` |
| Corrupted node_modules | Reinstall dependencies |
| Missing global install | Run `ck init --global` |
| Missing skill deps | Install in skill directory |

**Exit Codes:**
- `0`: All checks pass or issues fixed
- `1`: Failures detected (only with `--check-only`)

> **Note:** `ck diagnose` is deprecated. Use `ck doctor` instead.

### Uninstall

Remove ClaudeKit installations from your system:

```bash
ck uninstall              # Interactive mode - prompts for scope and confirmation
ck uninstall --local      # Uninstall only local installation (current project)
ck uninstall --global     # Uninstall only global installation (~/.claude/)
ck uninstall -l -y        # Local only, skip confirmation
ck uninstall -g -y        # Global only, skip confirmation
ck uninstall --yes        # Non-interactive - skip confirmation (for scripts)
```

**Scope Selection:**
- When both local and global installations exist, you'll be prompted to choose:
  - **Local only**: Remove from current project (`.claude/`)
  - **Global only**: Remove from user directory (`~/.claude/`)
  - **Both**: Remove all ClaudeKit installations
- Use `--local` or `--global` flags to skip the prompt

**What it does:**
- Detects local `.claude` directory in current project
- Detects global `~/.claude` ClaudeKit installation
- Shows paths before deletion
- Requires confirmation (unless `--yes` flag)
- Removes ClaudeKit subdirectories (`commands/`, `agents/`, `skills/`, `workflows/`, `hooks/`, `metadata.json`)
- **Preserves user configs** like `settings.json`, `settings.local.json`, and `CLAUDE.md`

**Note:** Only removes valid ClaudeKit installations (with metadata.json). Regular `.claude` directories from Claude Desktop are not affected.

### Other Commands

```bash
# Show CLI version (shows local + global kit versions)
ck --version

# Show help
ck --help
ck -h

# Command-specific help
ck new --help
ck init --help
ck config --help
ck skills --help
ck versions --help
```

### Debugging

```bash
ck new --verbose              # Enable verbose logging
ck new --verbose --log-file debug.log  # Save to file
CLAUDEKIT_VERBOSE=1 ck new   # Via environment variable
```

### Cache Configuration

Release data is cached locally to improve performance. You can configure the cache TTL:

```bash
# Set custom cache TTL (in seconds, default: 3600 = 1 hour)
CK_CACHE_TTL=7200 ck versions    # Cache for 2 hours
CK_CACHE_TTL=0 ck versions       # Disable caching (always fetch fresh)

# Permanent configuration (add to ~/.bashrc or ~/.zshrc)
export CK_CACHE_TTL=1800         # 30 minutes
```

**Cache Location:** `~/.claudekit/cache/releases/`

### Update Notifications

The `ck --version` command checks for newer versions of your installed ClaudeKit and displays a notification if an update is available. The check is cached for 7 days to minimize API calls.

**Disable Update Notifications:**
```bash
# Set environment variable to disable
NO_UPDATE_NOTIFIER=1 ck --version

# Windows (permanent)
[System.Environment]::SetEnvironmentVariable("NO_UPDATE_NOTIFIER", "1", [System.EnvironmentVariableTarget]::User)

# macOS/Linux (add to ~/.bashrc or ~/.zshrc)
export NO_UPDATE_NOTIFIER=1
```

**Cache Location:** `~/.claudekit/cache/version-check.json` (Windows: `%USERPROFILE%\.claudekit\cache\`)

## Authentication

The CLI requires GitHub authentication to download releases from private repositories.

### Authentication Flow

```
┌─────────────────────────────────────────────────┐
│          Multi-Tier Authentication               │
│                                                  │
│  1. GitHub CLI (gh auth token)                  │
│       ↓ (if not available)                       │
│  2. Environment Variables (GITHUB_TOKEN)        │
│       ↓ (if not set)                             │
│  3. Config File (~/.claudekit/config.json)      │
│       ↓ (if not found)                           │
│  4. OS Keychain (secure storage)                │
│       ↓ (if not stored)                          │
│  5. User Prompt (with save option)              │
└─────────────────────────────────────────────────┘
```

### Quick Setup

**Step 1: Install GitHub CLI**
```bash
# Windows
winget install GitHub.cli

# macOS
brew install gh

# Linux
sudo apt install gh
```

**Step 2: Authenticate with GitHub CLI**
```bash
gh auth login
```

When prompted, follow these steps:
1. Select **GitHub.com**
2. Select **HTTPS** (or SSH if preferred)
3. Authenticate Git? → **Yes**
4. Select **Login with a web browser** (⚠️ recommended)
5. Copy the one-time code shown
6. Press Enter to open browser and paste the code
7. Authorize GitHub CLI

> **⚠️ Important**: Select "Login with a web browser" - do NOT use "Paste an authentication token" as PAT authentication is no longer supported for accessing private repositories.

## Troubleshooting

Run the doctor command to diagnose issues:

```bash
# Interactive diagnostics
ck doctor

# Generate report for support
ck doctor --report

# CI/automation
ck doctor --check-only --json

# Verbose logging
ck new --verbose
ck init --verbose
```

**Common Issues:**
- **"Access denied"**: Run `ck doctor` to check auth, use `--fix` to auto-repair
- **"Authentication failed"**: Run `ck doctor --fix` to re-authenticate, or manually run `gh auth login` (select 'Login with a web browser')
- **"GitHub CLI not authenticated"**: Run `gh auth login` and select 'Login with a web browser' (NOT 'Paste token')
- **Module errors**: Run `ck doctor --fix` to reinstall skill dependencies
- **Need help**: Run `ck doctor --report` and share the gist URL

## Available Kits

ClaudeKit offers premium starter kits available for purchase at [ClaudeKit.cc](https://claudekit.cc):

- **engineer**: ClaudeKit Engineer - Engineering toolkit for building with Claude (v1.0.0+)
- **marketing**: ClaudeKit Marketing - Content automation toolkit (v1.0.0 available)

Each kit provides a comprehensive project template with best practices, tooling, and workflows optimized for Claude Code development.

## Configuration

Configuration is stored in `~/.claudekit/config.json`:

```json
{
  "github": {
    "token": "stored_in_keychain"
  },
  "defaults": {
    "kit": "engineer",
    "dir": "."
  }
}
```

## Protected Files

The following file patterns are protected and will not be overwritten during updates:

- `.env`, `.env.local`, `.env.*.local`
- `*.key`, `*.pem`, `*.p12`
- `node_modules/**`, `.git/**`
- `dist/**`, `build/**`

## Excluding Files

Use `--exclude` flag with glob patterns to skip files:

```bash
ck new --exclude "*.log" --exclude "temp/**"
ck update --exclude "node_modules/**" --exclude "dist/**"
```

**Patterns:** `*` (any chars), `**` (recursive), `?` (single char), `[abc]`, `{a,b}`
**Restrictions:** No absolute paths, no path traversal (..), 1-500 chars
**Note:** User patterns are ADDED to default protected patterns

### Custom .claude Files & Skills Migration

**Custom File Preservation:**
The CLI automatically preserves your custom `.claude/` files during updates:

- Custom slash commands
- Personal workflows
- Project-specific configurations
- Any other custom files in `.claude/` directory

**Skills Directory Migration:**
Automatic migration when structure changes (flat → categorized):

- **Detection**: Manifest-based + heuristic fallback
- **Customizations**: SHA-256 hash comparison detects modifications
- **Safety**: Backup before migration, rollback on failure
- **Preservation**: All customizations preserved during migration
- **Interactive**: Prompts for confirmation (can skip in CI/CD)

**Example Migration:**
```
Before (flat):
  .claude/skills/
    ├── gemini-vision/
    ├── postgresql-psql/
    └── cloudflare-dns/

After (categorized):
  .claude/skills/
    ├── ai-multimodal/
    │   └── gemini-vision/
    ├── databases/
    │   └── postgresql-psql/
    └── devops/
        └── cloudflare-dns/
```

Customizations in any skill are detected and preserved automatically.

## Development

See [Development Guide](./docs/codebase-summary.md) for:
- Project structure (modular domain-driven architecture)
- Build & compilation (`bun run build`, `bun run compile`)
- Testing & type checking
- Code standards & linting

**Architecture Highlights:**
- **Modular design**: 122 focused modules (target: <100 lines each)
- **Facade pattern**: Each domain exposes public API via facade
- **Phase handlers**: Complex commands use orchestrator + phase handlers
- **Self-documenting names**: kebab-case file names describe purpose

**Quick Start:**
```bash
bun install
bun run dev new --kit engineer
bun test
# Optional: run expensive CLI integration tests explicitly
bun run test:integration
```

## FAQ

**Q: Do I need GitHub CLI?**
A: Yes, GitHub CLI is required. ClaudeKit uses it exclusively for authentication with private repositories.

**Q: How do I authenticate?**
A: Run `gh auth login`, select 'Login with a web browser', complete OAuth in browser. Do NOT use 'Paste an authentication token'.

**Q: "Access denied" error?**
A: Accept GitHub repo invitation, re-run `gh auth login` with web browser login, wait 2-5min for permissions.

**Q: "GitHub CLI not authenticated" error?**
A: Run `gh auth login` and select 'Login with a web browser' (NOT 'Paste token'). PAT authentication is no longer supported.

**Q: Is my token secure?**
A: Yes. GitHub CLI manages tokens securely via OAuth, stored encrypted in OS keychain.

## License

MIT
