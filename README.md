# ClaudeKit CLI

Command-line tool for bootstrapping and updating ClaudeKit projects.

## Project Overview

**ClaudeKit CLI** (`ck`) is a command-line tool for bootstrapping and updating projects from private GitHub repository releases. Built with Bun and TypeScript, it provides fast, secure, and user-friendly project setup and maintenance.

**Key Features:**
- Multi-tier GitHub authentication (`gh` CLI → env vars → keychain → prompt)
- Streaming downloads with progress tracking
- Smart file merging with conflict detection
- Automatic skills directory migration (flat → categorized)
- Secure credential storage using OS keychain
- Beautiful CLI interface with interactive prompts

## Documentation

Comprehensive documentation is available in the `/docs` directory:

- **[Project Overview & PDR](./docs/project-overview-pdr.md)** - Product requirements, features, roadmap, and success metrics
- **[Codebase Summary](./docs/codebase-summary.md)** - High-level overview, structure, key components, and metrics
- **[Code Standards](./docs/code-standards.md)** - Coding conventions, best practices, and quality guidelines
- **[System Architecture](./docs/system-architecture.md)** - Architecture diagrams, data flow, and integration points
- **[Binary Distribution](./docs/binary-distribution.md)** - Platform-specific binary compilation and distribution

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

### From Source

```bash
git clone https://github.com/mrgoonie/claudekit-cli
cd claudekit-cli
bun install
bun link
```

After installation, verify it's working:

```bash
ck --version
```

## Usage

### Create a New Project

```bash
# Interactive mode
ck new

# With options
ck new --dir my-project --kit engineer

# Specific version
ck new --kit engineer --version v1.0.0

# With exclude patterns
ck new --kit engineer --exclude "*.log" --exclude "temp/**"

# Multiple patterns
ck new --exclude "*.log" --exclude "*.tmp" --exclude "cache/**"

# With optional package installations (interactive)
ck new

# With optional package installations (non-interactive)
ck new --opencode --gemini
ck new --opencode
ck new --gemini
```

### Initialize or Update Project

**Note:** this command should be run from the root directory of your project.

**⚠️ Deprecation Notice:** The `update` command has been renamed to `init`. The `update` command still works but will show a deprecation warning. Please use `init` instead.

```bash
# Interactive mode (recommended)
ck init

# With options
ck init --kit engineer

# Specific version
ck init --kit engineer --version v1.0.0

# With exclude patterns
ck init --exclude "local-config/**" --exclude "*.local"

# Global mode - use platform-specific user configuration
ck init --global
ck init -g --kit engineer

# Legacy (deprecated - use 'init' instead)
ck update  # Shows deprecation warning
```

**Global vs Local Configuration:**

By default, ClaudeKit will be installed in the current directory (`.claude` directory), or we used to call it project-scoped. 

For platform-specific user-scoped (global) settings:
- **macOS/Linux**: `~/.claude`
- **Windows**: `%USERPROFILE%\.claude`

Global mode uses user-scoped directories (no sudo required), allowing separate configurations for different projects.

**Automatic Skills Migration:**
- Detects structure changes (flat → categorized)
- Preserves all customizations via SHA-256 hashing
- Creates backup before migration
- Rollback on failure
- Interactive prompts for confirmation

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
ck diagnose         # Check auth, access, releases
ck doctor           # Show setup overview, component counts
ck diagnose --verbose  # Detailed diagnostics
```

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

Run diagnostics to check for common issues:

```bash
ck diagnose              # Check authentication, access, releases
ck new --verbose         # Enable detailed logging
ck doctor                # Show setup overview
```

**Common Issues:**
- **"Access denied"**: Accept GitHub repo invitation, verify `repo` scope
- **"Authentication failed"**: Check token format (ghp_*), verify env var
- **Token not persisting (Windows)**: Use `SetEnvironmentVariable` or `gh auth login`
- **Need help**: Run `ck diagnose`, check logs, report at GitHub issues

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
