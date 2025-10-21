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

# Exclude specific files or directories (supports glob patterns)
ck new --kit engineer --exclude "*.log" --exclude "temp/**"
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

# Exclude specific files or directories (supports glob patterns)
ck update --kit engineer --exclude "*.log" --exclude "temp/**"
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

The CLI requires a GitHub Personal Access Token (PAT) to download releases from private repositories. The authentication flow follows a multi-tier fallback:

1. **GitHub CLI**: Uses `gh auth token` if GitHub CLI is installed and authenticated
2. **Environment Variables**: Checks `GITHUB_TOKEN` or `GH_TOKEN`
3. **OS Keychain**: Retrieves stored token from system keychain
4. **User Prompt**: Prompts for token input and offers to save it securely

### Creating a Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token with `repo` scope (for private repositories)
3. Copy the token

### Setting Token via Environment Variable

```bash
export GITHUB_TOKEN=ghp_your_token_here
```

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

### Custom Exclude Patterns

You can exclude additional files or directories using the `--exclude` flag. This flag supports glob patterns and can be used multiple times:

**Examples:**
```bash
# Exclude specific file types
ck new --kit engineer --exclude "*.log" --exclude "*.tmp"

# Exclude directories
ck update --exclude "temp/**" --exclude "cache/**"

# Exclude specific files
ck new --exclude "config.local.json" --exclude ".vscode/**"

# Combine multiple patterns
ck update --exclude "*.test.ts" --exclude "coverage/**" --exclude ".DS_Store"
```

**Supported patterns:**
- `*.ext` - All files with specific extension
- `file.txt` - Specific file name
- `dir/**` - Entire directory and its contents
- `**/pattern` - Pattern in any directory
- `dir/*.ext` - Files in specific directory

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
- **`ck update`**: Update existing project
- **`ck versions`**: List available versions of ClaudeKit repositories
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

## License

MIT
