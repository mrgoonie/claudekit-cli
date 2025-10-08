# Tech Stack - ClaudeKit CLI

## Overview

This document outlines the recommended technology stack for the ClaudeKit CLI package based on comprehensive research of modern CLI development tools and best practices.

## Core Technologies

### Runtime
- **Bun** (v1.x+)
  - Fast package installation (80x faster than npm)
  - Built-in TypeScript support
  - Native bundler and test runner
  - Excellent Node.js API compatibility
  - Standalone executable compilation via `bun --compile`

### Language
- **TypeScript** (v5.x+)
  - Type safety and better IDE support
  - Native support in Bun (no compilation needed)
  - Modern ES2022+ features

## CLI Framework & UX

### Command Parsing
- **CAC** (v6.x+)
  - Lightweight (zero dependencies)
  - TypeScript-native with excellent type inference
  - Clean API with command chaining
  - Built-in help generation
  - Perfect for modern CLI apps

**Why CAC over alternatives:**
- Commander.js: More mature but heavier footprint
- Yargs: Feature-rich but complex for our use case
- CAC: Best balance of simplicity and features

### Interactive Prompts
- **@clack/prompts** (v0.7+)
  - Beautiful, modern UI
  - TypeScript-native
  - Excellent developer experience
  - Wide variety of prompt types (text, select, confirm, multiselect)
  - Built-in loading states and spinners

**Why @clack/prompts:**
- Modern design that matches 2025 standards
- Better UX than traditional prompts
- TypeScript-first approach
- Active maintenance and community

### Progress Indicators
- **ora** (v9.x+)
  - Elegant terminal spinners
  - Promise support
  - Color customization
  - 32M weekly downloads
  - Perfect for async operations

- **cli-progress** (v3.x+)
  - Full-featured progress bars
  - Multi-bar support
  - ETAs and speed indicators
  - Ideal for file downloads

### Colors & Formatting
- **picocolors** (v1.x+)
  - Fastest color library
  - Zero dependencies
  - Tiny footprint (900 bytes)
  - Drop-in replacement for chalk

## GitHub Integration

### GitHub API Client
- **@octokit/rest** (v22+)
  - Official GitHub SDK
  - Complete TypeScript types
  - Automatic rate limit handling
  - Retry logic built-in
  - Supports both REST and GraphQL APIs

### Authentication Strategy
Multi-tier fallback approach:
1. **GitHub CLI** (`gh auth token`) - if available
2. **Environment Variables** (GITHUB_TOKEN, GH_TOKEN)
3. **Stored Credentials** via OS keychain
4. **User Prompt** with optional secure storage

### Credential Storage
- **keytar** (v7.x+)
  - Secure OS-level credential storage
  - Cross-platform (macOS Keychain, Windows Credential Vault, Linux Secret Service)
  - No plain-text token storage

## File Operations

### HTTP Downloads
- **Bun Native fetch()**
  - Zero external dependencies
  - Excellent performance
  - Built-in streaming support
  - Manual progress tracking via ReadableStream

### Archive Extraction
- **tar** (node-tar v7+)
  - For `.tar.gz` files
  - Streaming support
  - 50M weekly downloads
  - Excellent reliability

- **unzipper** (v0.12+)
  - For `.zip` files
  - Memory efficient
  - Stream-based processing
  - 5M weekly downloads

### File System Operations
- **fs-extra** (v11+)
  - Enhanced fs methods with promises
  - Copy, move, remove with ease
  - Recursive operations
  - 70M weekly downloads
  - Battle-tested

### File Filtering
- **ignore** (v5+)
  - gitignore-style pattern matching
  - Skip config files during updates
  - Prevent overwriting sensitive files
  - 45M weekly downloads

### Temporary Files
- **tmp** (v0.2+)
  - Automatic temp directory cleanup
  - Safe temp file creation
  - 20M weekly downloads

## Data Validation

### Runtime Type Validation
- **Zod** (v3.x+)
  - TypeScript-first schema validation
  - Runtime type checking and parsing
  - Automatic type inference
  - Excellent error messages
  - Perfect for validating:
    - CLI arguments and options
    - Config file structure
    - GitHub API responses
    - User input from prompts
    - Environment variables

**Use Cases:**
- Validate command options before execution
- Parse and validate configuration files
- Ensure GitHub API response structure
- Type-safe environment variable parsing
- Input sanitization and validation

## Development Tools

### Testing
- **Bun Test** (built-in)
  - Native test runner
  - Jest-compatible API
  - Fast execution
  - TypeScript support out of the box

### Code Quality
- **Biome** (v1.x+) or **ESLint** (v9+)
  - Fast linting and formatting
  - TypeScript support
  - Modern rule sets

### Build & Distribution
- **bun build --compile**
  - Create standalone executables
  - Cross-platform compilation
  - Zero runtime dependencies for end users
  - Single binary distribution

## Project Structure

```
claudekit-cli/
├── src/
│   ├── commands/         # Command implementations
│   │   ├── new.ts       # 'ck new' command
│   │   └── update.ts    # 'ck update' command
│   ├── lib/             # Core libraries
│   │   ├── auth.ts      # GitHub authentication
│   │   ├── download.ts  # Download & extraction
│   │   ├── github.ts    # GitHub API client
│   │   └── prompts.ts   # Interactive prompts
│   ├── utils/           # Utilities
│   │   ├── config.ts    # Config management
│   │   ├── logger.ts    # Logging
│   │   └── errors.ts    # Error handling
│   └── index.ts         # CLI entry point
├── tests/               # Test files
├── docs/                # Documentation
└── bin/                 # Compiled binaries
```

## Configuration

### Package Configuration
- **package.json**
  - CLI bin entry: `ck`
  - Type: `module` (ESM)
  - Engines: `bun >= 1.0.0`

### Environment Variables
```bash
GITHUB_TOKEN=ghp_xxx        # GitHub PAT
GH_TOKEN=ghp_xxx            # Alternative token env
CLAUDEKIT_CONFIG=~/.claudekit/config.json
```

### Config File Format
```json
{
  "github": {
    "token": "encrypted_or_keychain_ref"
  },
  "defaults": {
    "kit": "engineer",
    "dir": "."
  }
}
```

## Security Considerations

1. **Token Storage**: Use OS keychain (keytar), never plain text
2. **Token Scopes**: Request minimal permissions (repo read for private repos)
3. **Token Rotation**: Encourage 30-90 day expiration
4. **Path Traversal**: Validate all file paths during extraction
5. **HTTPS Only**: All GitHub API calls over HTTPS
6. **Log Sanitization**: Never log tokens or sensitive data

## Installation & Distribution

### NPM Registry (Primary)
```bash
bun add -g claudekit-cli
```

### Standalone Binary (Alternative)
```bash
# Download compiled binary
curl -fsSL https://claudekit.cc/install.sh | bash
```

### From Source
```bash
git clone https://github.com/mrgoonie/claudekit-cli
cd claudekit-cli
bun install
bun link
```

## Performance Targets

- **Installation**: < 2 seconds (with Bun)
- **Command Response**: < 100ms for non-download commands
- **Download Speed**: Limited by network, show real-time progress
- **Extraction**: < 5 seconds for typical project (< 50MB)
- **Bundle Size**: < 5MB for standalone binary

## Future Considerations

- **Auto-updates**: Self-update mechanism
- **Plugin System**: Extensibility for custom kits
- **Templates**: Local template caching
- **Analytics**: Optional usage telemetry (opt-in)
- **Shell Completions**: Bash/Zsh/Fish completion scripts

## Summary

This tech stack prioritizes:
- ✅ **Performance**: Bun runtime, native APIs, minimal dependencies
- ✅ **Security**: Proper token management, OS keychain storage
- ✅ **Type Safety**: TypeScript + Zod for compile-time and runtime validation
- ✅ **UX**: Beautiful prompts, progress indicators, helpful errors
- ✅ **Maintainability**: TypeScript, modular structure, comprehensive tests
- ✅ **Distribution**: Multiple installation methods, standalone binaries

All chosen libraries are actively maintained, well-tested, and follow 2025 best practices.
