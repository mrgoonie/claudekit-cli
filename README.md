# ClaudeKit CLI

Command-line tool for bootstrapping and updating ClaudeKit projects.

## Installation

### From npm (Recommended)

```bash
bun add -g claudekit-cli
```

### From Source

```bash
git clone https://github.com/mrgoonie/claudekit-cli
cd claudekit-cli
bun install
bun link
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
```

### Update Existing Project

```bash
# Interactive mode
ck update

# With options
ck update --kit engineer

# Specific version
ck update --kit engineer --version v1.0.0
```

### Other Commands

```bash
# Show version
ck --version
ck -v

# Show help
ck --help
ck -h
```

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

- **engineer**: ClaudeKit Engineer - Engineering toolkit for building with Claude
- **marketing**: ClaudeKit Marketing - [Coming Soon]

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

## License

MIT
