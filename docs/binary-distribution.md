# Binary Distribution

## Overview

As of v1.4.0, `claudekit-cli` is distributed as pre-compiled platform-specific binaries instead of JavaScript source code. This provides:

- **Consistent behavior** across all platforms
- **Better performance** (no JIT compilation needed)
- **Fixed encoding issues** (Mojibake) that occurred with Node.js runtime
- **Standalone execution** (no Node.js/Bun required)

## Supported Platforms

| Platform | Architecture | Binary Name |
|----------|-------------|-------------|
| macOS | ARM64 (Apple Silicon) | `ck-darwin-arm64` |
| macOS | x64 (Intel) | `ck-darwin-x64` |
| Linux | x64 | `ck-linux-x64` |
| Windows | x64 | `ck-win32-x64.exe` |

## How It Works

### Installation

When you run `npm install -g claudekit-cli`:

1. NPM downloads the package containing all platform-specific binaries
2. NPM creates a symlink to `bin/ck.js` in your global bin directory
3. When you run `ck`, the wrapper script (`bin/ck.js`) automatically:
   - Detects your platform and architecture
   - Selects the correct binary (e.g., `ck-darwin-arm64`)
   - Executes it with all your arguments

### File Structure

```
claudekit-cli/
├── bin/
│   ├── ck.js                 # Wrapper script (entry point)
│   ├── ck-darwin-arm64       # macOS ARM64 binary
│   ├── ck-darwin-x64         # macOS Intel binary
│   ├── ck-linux-x64          # Linux x64 binary
│   └── ck-win32-x64.exe      # Windows x64 binary
└── package.json
```

## Building Binaries

### Local Build

```bash
# Build for current platform
bun run compile:binary

# This creates bin/ck-{platform}-{arch}
```

### CI/CD Build

The GitHub Actions workflow (`.github/workflows/build-binaries.yml`) builds binaries for all supported platforms:

1. **Matrix Build**: Runs on macOS, Linux, and Windows runners
2. **Compile**: Uses `bun build --compile` on each platform
3. **Upload**: Stores binaries as artifacts
4. **Release**: Downloads all binaries and packages them in NPM release

## Troubleshooting

### Binary Not Found

If you see "Binary not found" error:

```bash
# Check your platform
node -e "console.log(process.platform, process.arch)"

# Expected output: darwin arm64, linux x64, etc.
```

If your platform isn't supported, please [open an issue](https://github.com/claudekit/claudekit-cli/issues).

### Permission Denied (Unix)

If you can't execute the binary:

```bash
chmod +x ~/.npm/_npx/*/bin/ck
```

### Encoding Issues

If you still see character encoding issues:

1. Verify you're using the binary (not JavaScript source):
   ```bash
   which ck
   file $(which ck)  # Should show "Mach-O" or "ELF executable"
   ```

2. Check the version:
   ```bash
   ck --version  # Should show "ck/1.4.0 {platform}-{arch}"
   ```

## Migration from v1.3.x

If you're upgrading from v1.3.x or earlier:

```bash
# Uninstall old version
npm uninstall -g claudekit-cli

# Install new binary version
npm install -g claudekit-cli@latest

# Verify binary installation
ck --version
```

## Development

For local development, the compiled binary approach doesn't affect the workflow:

```bash
# Run directly with Bun (recommended for development)
bun run src/index.ts new --dir test-project

# Or compile and test the binary
bun run compile:binary
./bin/ck new --dir test-project
```

## Why This Change?

The previous JavaScript distribution had character encoding issues (Mojibake) when handling file paths with special characters or Unicode. The issue manifested as:

- Files with corrupted names like `â'0%9()` instead of proper UTF-8
- Different behavior between NPM-installed version and compiled binary
- Platform-dependent encoding handling in Node.js

By distributing pre-compiled binaries with Bun's runtime embedded, we ensure:

1. **Consistent UTF-8 handling** across all platforms
2. **Proper percent-encoding decoding** for GitHub tarballs
3. **Reliable file operations** regardless of system locale

## Future Plans

- **Linux ARM64 support**: Add cross-compilation or QEMU builds
- **Package size optimization**: Use compression or platform-specific packages
- **Auto-update**: Implement binary auto-update mechanism
