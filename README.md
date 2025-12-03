# ClaudeKit CLI

Command-line tool for bootstrapping and updating ClaudeKit projects.

**Version**: 1.16.0

## Overview

ClaudeKit CLI (`ck`) is a command-line tool for bootstrapping and updating projects from private GitHub releases. Built with Bun and TypeScript, provides fast, secure project setup and maintenance.

**Key Features:**
- Multi-tier GitHub authentication (gh CLI → env vars → keychain → prompt)
- Streaming downloads with progress tracking and platform optimizations
- Smart file merging with conflict detection
- Automatic skills directory migration with parallel processing
- Secure credential storage using OS keychain
- Beautiful CLI interface with interactive prompts
- Optional package installation (OpenCode, Gemini)
- System dependency auto-installation
- Platform-specific optimizations (macOS native unzip, adaptive concurrency)
- Intelligent update notifications with 7-day cache

## Documentation

Comprehensive documentation in `/docs`:

- **[Codebase Summary](./docs/codebase-summary.md)** - Overview, structure, key components
- **[Project Overview & PDR](./docs/project-overview-pdr.md)** - Requirements, features, roadmap
- **[System Architecture](./docs/system-architecture.md)** - Architecture diagrams, data flow
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
```

**Flags:**
- `--install-skills`: Auto-install Python packages, system tools (FFmpeg, ImageMagick), Node.js packages
- `--prefix`: Move commands to /ck: namespace (/plan → /ck:plan)
- `--beta`: Show pre-release versions in selection
- `--opencode/--gemini`: Install optional packages

### Initialize or Update Project

**Note:** Run from project root.

```bash
# Interactive mode
ck init

# With options
ck init --kit engineer --beta

# Global mode (platform-specific paths)
ck init --global

# Fresh installation (⚠️ DESTRUCTIVE - removes ALL customizations)
ck init --fresh

# With exclude patterns and prefix
ck init --exclude "*.local" --prefix
```

**Flags:**
- `--global/-g`: Use platform-specific config (macOS/Linux: ~/.claude, Windows: %USERPROFILE%\.claude)
- `--fresh`: Clean reinstall, removes .claude directory (requires "yes" confirmation)
- `--beta`: Show pre-release versions
- `--prefix`: Apply /ck: namespace to commands

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

# Generate shareable diagnostic report (prompts for gist upload)
ck doctor --report

# Auto-fix all fixable issues
ck doctor --fix

# CI mode: no prompts, exit 1 on failures
ck doctor --check-only

# Machine-readable JSON output
ck doctor --json

# Global installation check only
ck doctor --global

# Combine flags
ck doctor --check-only --json
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

**Recommended: GitHub CLI**
```bash
# Install & authenticate
gh auth login

# Windows
winget install GitHub.cli

# macOS
brew install gh

# Linux
sudo apt install gh
```

**Alternative: Personal Access Token**
1. Create token at [github.com/settings/tokens/new](https://github.com/settings/tokens/new?scopes=repo)
2. Set environment variable:
   ```bash
   # Windows (permanent)
   [System.Environment]::SetEnvironmentVariable("GITHUB_TOKEN", "ghp_TOKEN", [System.EnvironmentVariableTarget]::User)

   # macOS/Linux (add to ~/.bashrc or ~/.zshrc)
   export GITHUB_TOKEN=ghp_your_token_here
   ```

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
- **"Authentication failed"**: Run `ck doctor --fix` to re-authenticate
- **Module errors**: Run `ck doctor --fix` to reinstall skill dependencies
- **Token not persisting (Windows)**: Use `SetEnvironmentVariable` or `gh auth login`
- **Need help**: Run `ck doctor --report` and share the gist URL

## Available Kits

ClaudeKit offers premium starter kits available for purchase at [ClaudeKit.cc](https://claudekit.cc):

- **engineer**: ClaudeKit Engineer - Engineering toolkit for building with Claude
- **marketing**: ClaudeKit Marketing - [Coming Soon]

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
- Project structure (commands, lib, utils, tests)
- Build & compilation (`bun run build`, `bun run compile`)
- Testing & type checking
- Code standards & linting

**Quick Start:**
```bash
bun install
bun run dev new --kit engineer
bun test
```

## FAQ

**Q: Do I need GitHub CLI?**
A: No, but recommended. Provides auto token management, OAuth security, one-time setup.

**Q: What token scope needed?**
A: `repo` scope for private repositories. Create at [github.com/settings/tokens/new](https://github.com/settings/tokens/new?scopes=repo).

**Q: "Access denied" error?**
A: Accept GitHub repo invitation, verify `repo` scope, wait 2-5min for permissions.

**Q: Token not persisting (Windows)?**
A: Use `SetEnvironmentVariable` with `User` target, or `gh auth login`.

**Q: Is my token secure?**
A: Yes. Tokens sanitized in logs, stored encrypted in OS keychain, never in plaintext.

## License

MIT
