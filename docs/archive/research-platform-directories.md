# Platform-Specific Global Installation Directories Research

**Research Date:** 2025-11-11
**Focus:** Cross-platform CLI configuration storage for TypeScript/Bun

---

## Executive Summary

- **macOS:** CLI tools commonly use `~/.config` (XDG-style) despite native `~/Library` conventions
- **Windows:** Use `%LOCALAPPDATA%` for user configs, `%ProgramData%` for global configs
- **Linux:** Follow XDG Base Directory specification strictly
- **Best Practice:** Use `env-paths` npm package for cross-platform detection
- **Security:** Windows auto-protects user directories; Unix requires explicit `chmod 700`

---

## 1. macOS Directory Patterns

### Current State (2025)
CLI tools on macOS split between two conventions:

**XDG-Style (Preferred for CLI):**
- Config: `~/.config/<app-name>`
- Data: `~/.local/share/<app-name>`
- Cache: `~/.cache/<app-name>`
- State: `~/.local/state/<app-name>`

**Native Apple Conventions:**
- Config: `~/Library/Preferences/<app-name>`
- Data: `~/Library/Application Support/<app-name>`
- Cache: `~/Library/Caches/<app-name>`
- Logs: `~/Library/Logs/<app-name>`

### Consensus
Most CLI tools (bash, git, npm) use XDG-style paths on macOS for consistency with Linux. Native `~/Library` is reserved for GUI apps.

### ~/.claude/ Usage Pattern
Using `~/.claude/` directly is valid but non-standard. Consider:
- Pros: Simple, memorable, single location
- Cons: Doesn't separate config/data/cache, pollutes home directory
- Alternative: Use `~/.config/claude/` for better organization

---

## 2. Windows Directories

### Directory Hierarchy

**%LOCALAPPDATA% (Recommended for CLI):**
- Path: `C:\Users\{username}\AppData\Local`
- Purpose: User-specific, machine-local data
- Access: No admin privileges required
- Best for: Config files, caches, logs

**%APPDATA% (Roaming):**
- Path: `C:\Users\{username}\AppData\Roaming`
- Purpose: User-specific, roams with user profile
- Use case: Settings that sync across machines

**%ProgramData% (Global):**
- Path: `C:\ProgramData`
- Purpose: Shared across all users
- Access: Requires admin privileges to write
- Use case: System-wide configs

### Best Practices
- Use `%LOCALAPPDATA%` for user-specific CLI configs
- Never write to `%ProgramFiles%`
- User installs default to `%LOCALAPPDATA%\Programs`

---

## 3. Linux XDG Base Directory Specification

### Standard Paths (2025)

**Environment Variables:**
```bash
$XDG_CONFIG_HOME  # Default: ~/.config
$XDG_DATA_HOME    # Default: ~/.local/share
$XDG_STATE_HOME   # Default: ~/.local/state
$XDG_CACHE_HOME   # Default: ~/.cache
$XDG_RUNTIME_DIR  # Set by pam_systemd
```

### Directory Purpose

**Config:** User-specific configurations (analogous to `/etc`)
**Data:** User-specific data files (analogous to `/usr/share`)
**State:** User-specific state files (analogous to `/var/lib`)
**Cache:** Non-essential cached data (analogous to `/var/cache`)

### Implementation
Apps MUST check environment variables first, fall back to defaults if unset/empty.

---

## 4. TypeScript/Bun Implementation

### Using env-paths Package

**Installation:**
```bash
bun add env-paths
```

**TypeScript Usage:**
```typescript
import envPaths from 'env-paths';

const paths = envPaths('claudekit');

console.log(paths.data);    // Data directory
console.log(paths.config);  // Config directory
console.log(paths.cache);   // Cache directory
console.log(paths.log);     // Log directory
console.log(paths.temp);    // Temp directory

// Disable 'nodejs' suffix
const cleanPaths = envPaths('claudekit', { suffix: '' });
```

**Output by Platform:**

| Platform | Config Path |
|----------|------------|
| macOS    | `~/Library/Preferences/claudekit-nodejs` |
| Windows  | `%APPDATA%\claudekit-nodejs\Config` |
| Linux    | `~/.config/claudekit-nodejs` |

| Platform | Data Path |
|----------|-----------|
| macOS    | `~/Library/Application Support/claudekit-nodejs` |
| Windows  | `%LOCALAPPDATA%\claudekit-nodejs\Data` |
| Linux    | `~/.local/share/claudekit-nodejs` |

**Note:** `env-paths` generates path strings only—does not create directories.

### Creating Directories with Bun

```typescript
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import envPaths from 'env-paths';

async function ensureConfigDir(appName: string): Promise<string> {
  const paths = envPaths(appName, { suffix: '' });
  const configPath = paths.config;

  try {
    await mkdir(configPath, {
      recursive: true,
      mode: 0o700  // Unix: owner-only permissions (rwx------)
    });
    return configPath;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
    return configPath;
  }
}

// Usage
const configDir = await ensureConfigDir('claudekit');
console.log(`Config directory: ${configDir}`);
```

### Cross-Platform Directory Creation

```typescript
import { mkdir, access, chmod } from 'node:fs/promises';
import { constants } from 'node:fs';

async function createSecureDirectory(path: string): Promise<void> {
  try {
    // Check if directory exists
    await access(path, constants.F_OK);
    console.log(`Directory already exists: ${path}`);
  } catch {
    // Directory doesn't exist, create it
    await mkdir(path, { recursive: true, mode: 0o700 });

    // On Unix-like systems, ensure permissions are strict
    if (process.platform !== 'win32') {
      await chmod(path, 0o700);
    }

    console.log(`Created directory: ${path}`);
  }
}
```

---

## 5. File Permissions & Security

### Unix-like Systems (macOS, Linux)

**Permission Modes:**
```typescript
0o700  // rwx------ (owner only, most secure)
0o755  // rwxr-xr-x (owner writes, all read/execute)
0o644  // rw-r--r-- (owner writes, all read)
```

**Best Practices:**
- Config directories: `0o700` (owner-only access)
- Config files: `0o600` (owner read/write only)
- Cache directories: `0o755` (readable by all)
- Executable files: `0o755` (executable by all)

**Security Implementation:**
```typescript
import { chmod, writeFile } from 'node:fs/promises';

async function writeSecureConfig(filePath: string, data: string): Promise<void> {
  await writeFile(filePath, data, { mode: 0o600 });
  // Explicitly set permissions after write
  await chmod(filePath, 0o600);
}
```

### Windows

**Key Differences:**
- User directories protected by default (only user + SYSTEM can access)
- No Unix-style permission modes (`chmod` has limited effect)
- `mode` parameter in `mkdir`/`writeFile` ignored on Windows
- Manual ACL configuration rarely needed for user directories

**Windows-Compatible Code:**
```typescript
async function createConfigDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true, mode: 0o700 });
  // mode parameter ignored on Windows, but doesn't cause errors
  // Windows auto-applies user-only permissions to %LOCALAPPDATA%
}
```

### Cross-Platform Security Pattern

```typescript
import { mkdir, writeFile, chmod } from 'node:fs/promises';
import { platform } from 'node:os';

async function setupSecureConfig(configPath: string): Promise<void> {
  // Create directory with restricted permissions
  await mkdir(configPath, { recursive: true, mode: 0o700 });

  // On Unix, explicitly enforce permissions
  if (platform() !== 'win32') {
    await chmod(configPath, 0o700);
  }

  // Write config file
  const configFile = join(configPath, 'config.json');
  await writeFile(configFile, JSON.stringify({ /* ... */ }), {
    mode: 0o600
  });

  // Enforce file permissions on Unix
  if (platform() !== 'win32') {
    await chmod(configFile, 0o600);
  }
}
```

---

## 6. Recommendations for ClaudeKit CLI

### Option A: Use env-paths (Recommended)
```typescript
import envPaths from 'env-paths';

const paths = envPaths('claudekit', { suffix: '' });
// macOS: ~/Library/Preferences/claudekit
// Windows: %APPDATA%\claudekit\Config
// Linux: ~/.config/claudekit
```

**Pros:**
- Industry standard (used by npm, yarn, etc.)
- Respects platform conventions
- TypeScript support included
- Separates config/data/cache

**Cons:**
- macOS uses `~/Library` (not `~/.config`)
- Adds dependency

### Option B: Manual XDG-First Implementation
```typescript
import { homedir, platform } from 'node:os';
import { join } from 'node:path';

function getConfigPath(appName: string): string {
  const plat = platform();

  if (plat === 'win32') {
    return join(process.env.LOCALAPPDATA!, appName);
  }

  // macOS + Linux: prefer XDG-style
  if (process.env.XDG_CONFIG_HOME) {
    return join(process.env.XDG_CONFIG_HOME, appName);
  }

  return join(homedir(), '.config', appName);
}

const configPath = getConfigPath('claudekit');
// macOS: ~/.config/claudekit
// Windows: C:\Users\{user}\AppData\Local\claudekit
// Linux: ~/.config/claudekit
```

**Pros:**
- No dependencies
- Consistent XDG-style paths on macOS
- Simple implementation

**Cons:**
- Non-standard for macOS
- Manual maintenance required

### Option C: Hybrid Approach
```typescript
function getClaudeKitPaths() {
  const paths = envPaths('claudekit', { suffix: '' });

  // Override macOS to use XDG-style for CLI consistency
  if (platform() === 'darwin') {
    const home = homedir();
    const xdgConfig = process.env.XDG_CONFIG_HOME || join(home, '.config');

    return {
      config: join(xdgConfig, 'claudekit'),
      data: join(home, '.local', 'share', 'claudekit'),
      cache: join(home, '.cache', 'claudekit'),
      log: join(home, '.local', 'state', 'claudekit'),
    };
  }

  return paths;
}
```

**Pros:**
- XDG-style on macOS for CLI consistency
- Native conventions on Windows
- Best of both worlds

**Cons:**
- More complex logic
- Deviates from `env-paths` on macOS

---

## Unresolved Questions

1. Should CLI preserve existing `~/.claude/` for backward compatibility or migrate to standard paths?
2. How to handle migration if users have existing configs in `~/.claude/`?
3. Should macOS follow native conventions (`~/Library`) or XDG-style (`~/.config`) for CLI?
4. Need to verify Bun-specific quirks with file permissions on Windows (search results show some permission issues)

---

## Sources

1. XDG Base Directory Specification: https://specifications.freedesktop.org/basedir/latest/
2. ArchWiki XDG: https://wiki.archlinux.org/title/XDG_Base_Directory
3. env-paths GitHub: https://github.com/sindresorhus/env-paths
4. Windows AppData Guidelines: Microsoft Learn / Stack Overflow consensus
5. macOS CLI Directory Debate: Stack Overflow / GitHub discussions (2025)
