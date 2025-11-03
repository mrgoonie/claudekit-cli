# ClaudeKit CLI

Command-line tool for bootstrapping and updating ClaudeKit projects.

## Project Overview

**ClaudeKit CLI** (`ck`) is a command-line tool for bootstrapping and updating projects from private GitHub repository releases. Built with Bun and TypeScript, it provides fast, secure, and user-friendly project setup and maintenance.

**Key Features:**
- Multi-tier GitHub authentication (gh CLI → env vars → keychain → prompt)
- Streaming downloads with progress tracking
- Smart file merging with conflict detection
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
```

### Update Existing Project

**Note:** this command should be run from the root directory of your project.

```bash
# Interactive mode
ck update

# With options
ck update --kit engineer

# Specific version
ck update --kit engineer --version v1.0.0

# With exclude patterns
ck update --exclude "local-config/**" --exclude "*.local"
```

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

### Diagnose Issues

Run diagnostics to troubleshoot authentication and repository access problems:

```bash
# Run comprehensive diagnostics
ck diagnose

# Check specific kit
ck diagnose --kit engineer

# Get detailed output
ck diagnose --verbose
```

### Doctor Command

Check your current ClaudeKit setup and available components:

```bash
# Show ClaudeKit setup overview
ck doctor
```

**What the doctor command shows:**
- **Global Setup**: Installation status, version, and component counts
- **Project Setup**: Current project information and available components
- **Summary**: Overall setup status and total available components
- **Helpful Tips**: Next steps and related commands

**Example output:**
```
CK Global Setup
Location: /Users/user/.claude
Version: 1.0.0
Components: 0 agents, 0 commands, 0 workflows, 0 skills

CK Project Setup
Location: ./my-project/.claude
Version: 1.10.4
Name: claudekit-engineer
Components: 15 agents, 11 commands, 4 workflows, 31 skills

Total Available Components:
🤖 Agents: 15
⚡ Commands: 11
🔄 Workflows: 4
🛠️ Skills: 31
```

**What it checks:**
- ✅ GitHub CLI installation and authentication status
- ✅ Environment variables (GITHUB_TOKEN, GH_TOKEN)
- ✅ Token format validation
- ✅ Authentication method being used
- ✅ Repository access for each kit
- ✅ Release availability
- ✅ System information

**Example output:**
```
🔍 ClaudeKit CLI Diagnostics

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Diagnostic Results:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ GitHub CLI
   GitHub CLI is installed and authenticated
   This is the recommended authentication method

✅ Environment Variables
   GITHUB_TOKEN is set and has valid format
   Token: ghp_xxx...

✅ Authentication
   Successfully authenticated via Environment Variable
   Token: ghp_xxx...

✅ Repository Access (engineer)
   You have access to owner/claudekit-engineer

✅ Releases (engineer)
   Found 12 release(s)
   Latest: v1.5.0 (1/15/2025)

ℹ️ System Information
   Windows x64
   Node.js: v20.11.0
   Working directory: C:\Projects\my-app
   ClaudeKit CLI: v1.5.1

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Summary: 6 passed, 0 failed, 0 warnings
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

All checks passed! 🎉
```

### Other Commands

```bash
# Show CLI version
ck --version

# Show help
ck --help
ck -h
```

### Debugging and Verbose Mode

Enable detailed logging for debugging or troubleshooting:

```bash
# Enable verbose logging with flag
ck new --verbose
ck update -v  # Short form

# Using environment variable
CLAUDEKIT_VERBOSE=1 ck new

# Save logs to file for sharing
ck new --verbose --log-file debug.log
```

**Verbose mode shows:**
- HTTP request/response details (with sanitized tokens)
- File operations (downloads, extractions, copies)
- Command execution steps and timing
- Error stack traces with full context
- Authentication flow details

**Note:** All sensitive data (tokens, credentials) is automatically sanitized in verbose logs for security.

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

### Quick Setup by Platform

<details>
<summary><strong>🪟 Windows (PowerShell) - Recommended Setup</strong></summary>

**Option 1: GitHub CLI (Easiest & Recommended)**

```powershell
# Install GitHub CLI
winget install GitHub.cli

# Authenticate with GitHub
gh auth login
# Select: "Login with a web browser"
# Follow the browser prompts

# Verify authentication
gh auth status

# You're ready! Use ClaudeKit CLI
ck new --kit engineer
```

**Option 2: Personal Access Token**

1. **Accept Repository Invitation**: Check your email for the GitHub repository invitation and accept it
2. **Create Token**: Go to [GitHub Token Settings](https://github.com/settings/tokens/new?scopes=repo&description=ClaudeKit%20CLI)
   - Description: "ClaudeKit CLI"
   - Scopes: Check `repo` (Full control of private repositories)
   - Click "Generate token" and copy it
3. **Set Environment Variable Permanently**:
   ```powershell
   # Set for current user (persists across sessions)
   [System.Environment]::SetEnvironmentVariable(
       "GITHUB_TOKEN",
       "ghp_YOUR_TOKEN_HERE",
       [System.EnvironmentVariableTarget]::User
   )

   # Restart PowerShell to apply changes
   ```
4. **Verify**:
   ```powershell
   # Check if token is set
   $env:GITHUB_TOKEN
   ```

**Note**: Setting via `$env:GITHUB_TOKEN = "ghp_xxx"` only works for the current session. Use the method above for permanent setup.

</details>

<details>
<summary><strong>🍎 macOS / 🐧 Linux - Setup</strong></summary>

**Option 1: GitHub CLI (Recommended)**

```bash
# macOS
brew install gh

# Linux (Debian/Ubuntu)
sudo apt install gh

# Authenticate
gh auth login

# Verify
gh auth status
```

**Option 2: Environment Variable**

```bash
# Add to ~/.bashrc, ~/.zshrc, or ~/.profile
export GITHUB_TOKEN=ghp_your_token_here

# Reload shell
source ~/.bashrc  # or ~/.zshrc
```

</details>

### Why Use GitHub CLI?

```
GitHub CLI Benefits:
├─ ✅ Automatic token management
├─ ✅ Secure storage in OS credential manager
├─ ✅ Proper OAuth scopes (no manual setup)
├─ ✅ Token auto-refresh
├─ ✅ Works across all ClaudeKit commands
└─ ✅ One-time setup
```

## Troubleshooting

### Quick Diagnostic Tool

Before diving into manual troubleshooting, run the diagnostic tool to automatically check for common issues:

```bash
ck diagnose
```

This will check:
- GitHub CLI status
- Environment variables
- Token validity and format
- Repository access
- Release availability

### Common Issues & Solutions

<details>
<summary><strong>❌ "Access denied to repository" or "Cannot access ClaudeKit"</strong></summary>

**This error means authentication is working, but you don't have access to the repository.**

```
Possible Causes:
├─ 1. Haven't accepted GitHub repository invitation
├─ 2. Token lacks 'repo' scope
├─ 3. Token expired or revoked
└─ 4. Not added as collaborator yet
```

**Solutions:**

1. **Check Email for Repository Invitation**
   - Look for email from GitHub with subject "You've been invited to join..."
   - Click "Accept invitation"
   - Wait a few minutes for permissions to propagate

2. **Use GitHub CLI (Recommended)**
   ```bash
   gh auth login
   # This handles scopes automatically
   ```

3. **Verify Token Scopes**
   - Go to: https://github.com/settings/tokens
   - Find your token
   - Ensure `repo` scope is checked (not just `public_repo`)
   - If missing, create a new token with proper scopes

4. **Test Repository Access**
   ```bash
   # Try cloning the repository
   git clone https://github.com/[owner]/claudekit-engineer.git

   # If this fails, you don't have access yet
   ```

</details>

<details>
<summary><strong>❌ "Authentication failed" (401 Error)</strong></summary>

**This means the token is invalid or not being read.**

**Solutions:**

1. **Verify Token is Set**
   ```powershell
   # Windows PowerShell
   $env:GITHUB_TOKEN

   # macOS/Linux
   echo $GITHUB_TOKEN
   ```

2. **Check Token Format**
   - Classic tokens start with `ghp_`
   - Fine-grained tokens start with `github_pat_`
   - Token should be 40+ characters

3. **Use GitHub CLI Instead**
   ```bash
   gh auth login
   ```

4. **Restart Terminal**
   - Environment variables may not be loaded
   - Close and reopen terminal/PowerShell

</details>

<details>
<summary><strong>🪟 Windows: Token Not Persisting Between Sessions</strong></summary>

**Problem**: Setting `$env:GITHUB_TOKEN = "ghp_xxx"` doesn't work after closing PowerShell.

**Solution**: Use permanent environment variable:

```powershell
# Set for current user (permanent)
[System.Environment]::SetEnvironmentVariable(
    "GITHUB_TOKEN",
    "ghp_YOUR_TOKEN_HERE",
    [System.EnvironmentVariableTarget]::User
)

# Restart PowerShell
```

Or use GitHub CLI for automatic management:
```powershell
winget install GitHub.cli
gh auth login
```

</details>

<details>
<summary><strong>❌ "No releases found" Error</strong></summary>

**Possible Causes:**
- Repository has no releases yet
- Token doesn't have access to releases

**Solutions:**
1. Contact support to verify releases exist
2. Check repository directly on GitHub
3. Use `ck versions --kit engineer` to list available versions

</details>

<details>
<summary><strong>🐛 Enable Verbose Mode for Debugging</strong></summary>

Get detailed logs to diagnose issues:

```bash
# Enable verbose output
ck new --verbose

# Save logs to file
ck new --verbose --log-file debug.log

# Or use environment variable
CLAUDEKIT_VERBOSE=1 ck new
```

This shows:
- Authentication method used
- API requests/responses
- Token validation (sanitized)
- File operations
- Error stack traces

</details>

### Getting Help

If you're still having issues:

1. **Run with verbose mode**: `ck new --verbose --log-file debug.log`
2. **Check the log file**: Review `debug.log` for detailed errors
3. **Report issue**: https://github.com/mrgoonie/claudekit-cli/issues
4. **Include**:
   - Operating system (Windows/macOS/Linux)
   - CLI version: `ck --version`
   - Error message (with tokens removed)
   - Steps to reproduce

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

Use the `--exclude` flag to skip specific files or directories during download and extraction. This is useful for:

- Excluding temporary or cache directories
- Skipping log files or debug output
- Omitting files you want to manage manually
- Avoiding unnecessary large files

### Basic Usage

```bash
# Exclude log files
ck new --exclude "*.log"

# Exclude multiple patterns
ck new --exclude "*.log" --exclude "temp/**" --exclude "cache/**"

# Common exclude patterns for updates
ck update --exclude "node_modules/**" --exclude "dist/**" --exclude ".env.*"
```

### Supported Glob Patterns

The `--exclude` flag accepts standard glob patterns:

- `*` - Match any characters except `/` (e.g., `*.log` matches all log files)
- `**` - Match any characters including `/` (e.g., `temp/**` matches all files in temp directory)
- `?` - Match single character (e.g., `file?.txt` matches `file1.txt`, `file2.txt`)
- `[abc]` - Match characters in brackets (e.g., `[Tt]emp` matches `Temp` or `temp`)
- `{a,b}` - Match alternatives (e.g., `*.{log,tmp}` matches `*.log` and `*.tmp`)

### Common Exclude Patterns

```bash
# Exclude all log files
--exclude "*.log" --exclude "**/*.log"

# Exclude temporary directories
--exclude "tmp/**" --exclude "temp/**" --exclude ".tmp/**"

# Exclude cache directories
--exclude "cache/**" --exclude ".cache/**" --exclude "**/.cache/**"

# Exclude build artifacts
--exclude "dist/**" --exclude "build/**" --exclude "out/**"

# Exclude local configuration
--exclude "*.local" --exclude "local/**" --exclude ".env.local"

# Exclude IDE/editor files
--exclude ".vscode/**" --exclude ".idea/**" --exclude "*.swp"
```

### Important Notes

**Additive Behavior:**
- User exclude patterns are ADDED to the default protected patterns
- They do not replace the built-in protections
- All patterns work together to determine which files to skip

**Security Restrictions:**
- Absolute paths (starting with `/`) are not allowed
- Path traversal patterns (containing `..`) are not allowed
- Patterns must be between 1-500 characters
- These restrictions prevent accidental or malicious file system access

**Pattern Matching:**
- Patterns are case-sensitive on Linux/macOS
- Patterns are case-insensitive on Windows
- Patterns are applied during both extraction and merge phases
- Excluded files are never written to disk, saving time and space

**Examples of Invalid Patterns:**

```bash
# ❌ Absolute paths not allowed
ck new --exclude "/etc/passwd"

# ❌ Path traversal not allowed
ck new --exclude "../../secret"

# ❌ Empty patterns not allowed
ck new --exclude ""

# ✅ Correct way to exclude root-level files
ck new --exclude "secret.txt" --exclude "config.local.json"
```

### Custom .claude Files

When updating a project, the CLI automatically preserves your custom `.claude/` files that don't exist in the new release package. This allows you to maintain:

- Custom slash commands
- Personal workflows
- Project-specific configurations
- Any other custom files in `.claude/` directory

**How it works:**
1. Before updating, the CLI scans your project's `.claude/` directory
2. Compares it with the new release's `.claude/` directory
3. Identifies custom files (files in your project but not in the release)
4. Automatically protects these custom files during the update

**Example:**
```
Your project:
  .claude/
    ├── commands/standard.md  (from ClaudeKit)
    └── commands/my-custom.md (your custom command)

After update:
  .claude/
    ├── commands/standard.md  (updated from new release)
    └── commands/my-custom.md (preserved - your custom file)
```

## Development

```bash
# Install dependencies
bun install

# Run in development
bun run dev new --kit engineer

# Build
bun run build

# Compile standalone binary
bun run compile

# Run tests
bun test

# Type check
bun run typecheck

# Lint & Format
bun run lint
bun run format
```

## Project Structure

```
claudekit-cli/
├── docs/                       # Documentation
│   ├── project-pdr.md         # Product requirements
│   ├── code-standards.md      # Coding standards
│   ├── system-architecture.md # Architecture diagrams
│   ├── codebase-summary.md    # Codebase overview
│   └── tech-stack.md          # Technology stack
├── plans/                      # Implementation plans & reports
│   ├── 251008-claudekit-cli-implementation-plan.md
│   ├── reports/               # Agent reports
│   ├── research/              # Research documents
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
│   ├── utils/                 # Utilities
│   │   ├── config.ts         # Configuration manager
│   │   └── logger.ts         # Logger with sanitization
│   ├── index.ts               # CLI entry point
│   └── types.ts               # Type definitions
├── tests/                      # Test files (mirrors src/)
│   ├── lib/
│   ├── utils/
│   └── types.test.ts
├── README.md                   # User documentation
├── package.json                # Package manifest
└── tsconfig.json              # TypeScript config
```

---

## Key Features & Components

### 1. Commands
- **`ck new`**: Create new project from release
- **`ck update`**: Update existing project or install globally with `--global` flag
- **`ck versions`**: List available versions of ClaudeKit repositories
- **`ck doctor`**: Show current ClaudeKit setup and component overview
- **`ck diagnose`**: Run diagnostics to troubleshoot authentication and access issues
- **`ck --version`**: Show CLI version
- **`ck --help`**: Show help

### 2. Authentication (Multi-Tier Fallback)
1. GitHub CLI (`gh auth token`)
2. Environment variables (GITHUB_TOKEN, GH_TOKEN)
3. Configuration file (~/.claudekit/config.json)
4. OS Keychain (via keytar)
5. User prompt (with optional secure storage)

### 3. Core Operations
- **Download**: Streaming downloads with progress bars
- **Extract**: TAR.GZ and ZIP support with path traversal protection
- **Merge**: Smart file merging with conflict detection
- **Protected Files**: .env, *.key, *.pem, node_modules/, .git/, etc.

## Frequently Asked Questions (FAQ)

<details>
<summary><strong>Q: Do I need to install the `gh` CLI to use ClaudeKit CLI?</strong></summary>

**A:** No, but it's highly recommended for the best experience.

**Without gh CLI:**
- Must manually create Personal Access Token
- Must set environment variable or enter token each time
- Must manage token renewal manually

**With gh CLI:**
- One-time `gh auth login` setup
- Automatic token management
- Better security (OAuth vs static token)
- Works seamlessly across all tools

</details>

<details>
<summary><strong>Q: Can I use the CLI if I'm already added to the repository?</strong></summary>

**A:** Yes! If you're added as a collaborator:

1. **Using CLI** (with gh or token):
   ```bash
   ck new --kit engineer
   ```

2. **Direct git clone** (alternative):
   ```bash
   git clone https://github.com/owner/claudekit-engineer.git
   ```

3. **Manual download** (from GitHub UI):
   - Go to repository → Releases
   - Download latest release zip
   - Extract manually

The CLI provides additional benefits like smart merging, exclude patterns, and automatic updates.

</details>

<details>
<summary><strong>Q: What GitHub token scopes do I need?</strong></summary>

**A:** For private repositories, you need the **`repo`** scope.

```
Required Scope:
└─ repo (Full control of private repositories)
   ├─ repo:status
   ├─ repo_deployment
   ├─ public_repo
   ├─ repo:invite
   └─ security_events
```

**Creating token with correct scope:**
1. Go to: https://github.com/settings/tokens/new?scopes=repo&description=ClaudeKit%20CLI
2. The `repo` scope will be pre-selected
3. Click "Generate token"

**Common mistake:** Using `public_repo` scope only - this doesn't work for private repositories.

</details>

<details>
<summary><strong>Q: Why am I getting "Access denied" even though I set GITHUB_TOKEN?</strong></summary>

**A:** "Access denied" with a valid token means you don't have repository access, not that authentication failed.

**Checklist:**
- ✅ Token is being read correctly (you'd get "Authentication failed" otherwise)
- ❌ You haven't accepted the GitHub repository invitation
- ❌ Token lacks `repo` scope (has `public_repo` only)
- ❌ You're not added as a collaborator yet

**Solution:**
1. Check email for GitHub invitation
2. Accept invitation
3. Wait 2-5 minutes for permissions to sync
4. Try again: `ck new --kit engineer`

</details>

<details>
<summary><strong>Q: How do I make my token persist in PowerShell?</strong></summary>

**A:** Use permanent environment variable:

```powershell
[System.Environment]::SetEnvironmentVariable(
    "GITHUB_TOKEN",
    "ghp_YOUR_TOKEN",
    [System.EnvironmentVariableTarget]::User
)
```

Then restart PowerShell.

**Or use GitHub CLI** (no manual token management needed):
```powershell
winget install GitHub.cli
gh auth login
```

</details>

<details>
<summary><strong>Q: Can I download releases without using the CLI?</strong></summary>

**A:** Yes, if you're a collaborator:

1. **Via Browser:**
   - Go to repository on GitHub
   - Click "Releases"
   - Download the release zip/tarball

2. **Via Git:**
   ```bash
   git clone https://github.com/owner/claudekit-engineer.git
   ```

3. **Via gh CLI:**
   ```bash
   gh release download latest --repo owner/claudekit-engineer
   ```

However, the ClaudeKit CLI provides:
- Smart file merging during updates
- Protected file preservation
- Exclude pattern support
- Automatic wrapper directory detection
- Progress tracking

</details>

<details>
<summary><strong>Q: What's the difference between 401, 403, and 404 errors?</strong></summary>

**A:** Different errors mean different things:

```
401 Unauthorized:
└─ Token is invalid, expired, or not provided
   Solution: Check token format, regenerate if needed

403 Forbidden:
└─ Token is valid but lacks required scopes
   Solution: Recreate token with 'repo' scope

404 Not Found (on private repos):
└─ Token is valid but you don't have repository access
   Solution: Accept GitHub invitation, wait for permissions
```

</details>

<details>
<summary><strong>Q: How do I know which authentication method is being used?</strong></summary>

**A:** Run with verbose mode:

```bash
ck new --verbose
```

You'll see output like:
```
[DEBUG] Using GitHub CLI authentication
# or
[DEBUG] Using environment variable authentication
# or
[DEBUG] Using keychain authentication
```

</details>

<details>
<summary><strong>Q: Is my GitHub token secure when using this CLI?</strong></summary>

**A:** Yes, multiple security measures are in place:

- ✅ Tokens are sanitized in all logs (replaced with `***`)
- ✅ Tokens stored in OS keychain are encrypted
- ✅ Tokens are never written to files in plain text
- ✅ Config file references keychain storage only
- ✅ HTTPS used for all GitHub API requests
- ✅ No telemetry or external logging

**Token storage locations:**
- **gh CLI**: Windows Credential Manager / macOS Keychain / Linux Secret Service
- **Keychain**: OS-encrypted secure storage
- **Environment**: Session memory only
- **Config file**: Reference only ("`stored_in_keychain`")

</details>

## License

MIT
