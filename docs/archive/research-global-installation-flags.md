# Global Installation Flags Implementation Research

**Research Date:** 2025-11-11
**Focus:** Cross-platform global installation patterns for Node.js/Bun CLIs
**Token Budget:** Optimized for concision

---

## 1. Cross-Platform Directory Locations

### Standard Paths by Platform

**Linux (XDG Base Directory Spec)**
- Config: `$XDG_CONFIG_HOME` → `~/.config` (default)
- Data: `$XDG_DATA_HOME` → `~/.local/share`
- Cache: `$XDG_CACHE_HOME` → `~/.cache`
- State: `$XDG_STATE_HOME` → `~/.local/state`

**macOS**
- Native: `~/Library/Application Support`, `~/Library/Preferences`, `~/Library/Caches`
- CLI Tools Exception: Many CLI tools use XDG spec even on macOS for portability
- Hybrid Approach: `XDG_CONFIG_HOME="$HOME/.config"` + `XDG_CACHE_HOME="$HOME/Library/Caches"`

**Windows**
- Config/Data: `%APPDATA%` (Roaming)
- Cache: `%LOCALAPPDATA%` (Local)
- Some tools follow XDG spec via environment variables

### Implementation Pattern

```typescript
// Based on @folder/xdg library approach
function getConfigDir(platform: string): string {
  switch (platform) {
    case 'darwin':
      return process.env.XDG_CONFIG_HOME || `${HOME}/.config` // CLI tools prefer XDG
    case 'linux':
      return process.env.XDG_CONFIG_HOME || `${HOME}/.config`
    case 'win32':
      return process.env.APPDATA || `${HOME}/AppData/Roaming`
  }
}
```

**Key Insight:** CLI tools increasingly use XDG spec across all platforms for consistency. GUI apps use native macOS/Windows locations. [Source: ArchWiki XDG Base Directory, GitHub @folder/xdg]

---

## 2. Popular CLI Global Flag Implementations

### npm
**Current Pattern (2025):**
- Deprecated: `--global` / `-g`
- Recommended: `--location=global`
- Config: `.npmrc` in global dir or `npm config set`
- Global dir: `npm config get prefix` → typically `/usr/local` or `~/.npm-global`

**Key Change:** npm moved from boolean flags to location-based flags for clarity.

### Yarn
**Pattern:**
- Command-based: `yarn global add <pkg>` (NOT `yarn add --global`)
- Global dir: `yarn global dir` → default `~/.config/yarn/global`
- Config: `~/.yarnrc`

**Key Difference:** `global` is a command, not a flag—prevents user confusion about flag order.

### pnpm
**Pattern:**
- Flag-based: `pnpm add -g` or `pnpm add --global`
- Config: `.npmrc` (project) or global config via `pnpm config`
- Global dir: `pnpm root -g` to show location

**Consistency:** Maintains traditional `-g` flag for familiarity.

### Bun
**Pattern:**
- Flag-based: `bun install -g`
- Global dir: `~/.bun/install/global` (configurable via `bunfig.toml`)
- Bin dir: `~/.bun/bin` (must be in `$PATH`)
- Config file: `bunfig.toml`

```toml
[install]
globalDir = "~/.bun/install/global"
globalBinDir = "~/.bun/bin"
```

**Advantage:** Dedicated config file format, user-scoped by default (no sudo needed).

[Sources: npm docs, Yarn Classic docs, pnpm.io, Bun docs]

---

## 3. Node.js/Bun CLI Framework Patterns

### Framework Comparison

| Framework | Complexity | Global Config Support | Best For |
|-----------|------------|----------------------|----------|
| **Commander** | Low | Manual implementation | Simple CLIs with few commands |
| **Yargs** | Medium | Built-in middleware | Feature-rich CLIs with validation |
| **oclif** | High | Plugin-based config | Enterprise CLIs with subcommands |

### Implementation Recommendations

**package.json Configuration:**
```json
{
  "bin": {
    "mycli": "./dist/index.js"
  },
  "preferGlobal": true  // Signals intended global usage
}
```

**Flag Implementation Pattern (Commander.js):**
```typescript
program
  .option('-g, --global', 'use global configuration')
  .hook('preAction', (thisCommand) => {
    if (thisCommand.opts().global) {
      // Set config path to global location
      configPath = getGlobalConfigPath();
    }
  });
```

**Flag Implementation Pattern (Yargs):**
```typescript
yargs
  .option('global', {
    alias: 'g',
    type: 'boolean',
    description: 'Use global configuration',
    global: true  // Makes flag available to all commands
  })
  .middleware((argv) => {
    if (argv.global) {
      argv.configPath = getGlobalConfigPath();
    }
  });
```

**Key Insight:** Use framework hooks/middleware to resolve paths early in execution pipeline.

[Sources: Commander docs, Yargs docs, oclif.io]

---

## 4. Security & Permission Considerations

### Core Principles

**Avoid Sudo Requirements**
- User-scoped installations preferred: `~/.local`, `~/.bun`, `~/.config`
- System-wide (`/usr/local`) requires root—creates security risk
- Modern pattern: User manages own tools without elevated privileges

**Bun Security Model (Best Practice Example):**
- No lifecycle scripts by default
- Explicit trust required: Add to `trustedDependencies` in `package.json`
- Prevents malicious postinstall scripts

**Sudo Anti-Patterns:**
```bash
# ❌ Avoid - requires root, security risk
sudo npm install -g package

# ✅ Prefer - user-scoped
npm config set prefix ~/.npm-global
npm install -g package
```

### Permission Best Practices

1. **Principle of Least Privilege**
   - Users should only access what they need
   - CLI tools shouldn't require admin rights for basic operations

2. **Config File Permissions**
   ```bash
   chmod 600 ~/.config/mycli/config.toml  # User read/write only
   ```

3. **Environment Variables Over Sudo**
   ```bash
   export PATH="$HOME/.local/bin:$PATH"
   ```

4. **Multi-User Servers**
   - Place binaries in system PATH (`/usr/local/bin`)
   - Set execute permissions: `chmod +x`
   - Avoid setuid—use dedicated service accounts

5. **Validation & Auditing**
   - Log configuration changes
   - Validate file integrity before execution
   - Regular security audits of global configs

**Key Risk:** Sudo with global installs can execute arbitrary code as root during install scripts.

[Sources: Bun docs security section, Linux Magazine sudo security, DigitalOcean sudoers guide]

---

## 5. Actionable Implementation Patterns

### Pattern A: Simple Boolean Flag (Recommended for Most CLIs)

```typescript
import { Command } from 'commander';
import { homedir } from 'os';
import { join } from 'path';

function getConfigPath(isGlobal: boolean): string {
  if (isGlobal) {
    const platform = process.platform;
    const home = homedir();

    if (platform === 'win32') {
      return join(process.env.APPDATA || join(home, 'AppData/Roaming'), 'mycli');
    }
    // Use XDG spec for macOS/Linux CLI tools
    return join(process.env.XDG_CONFIG_HOME || join(home, '.config'), 'mycli');
  }

  // Local: current working directory
  return join(process.cwd(), '.mycli');
}

const program = new Command();

program
  .option('-g, --global', 'use global configuration directory')
  .action((options) => {
    const configPath = getConfigPath(options.global);
    console.log(`Using config at: ${configPath}`);
  });

program.parse();
```

### Pattern B: Config Hierarchy (Enterprise CLIs)

```typescript
// Priority: CLI flag > ENV var > Config file > Default
function resolveConfigPath(cliFlag?: boolean): string {
  // 1. Explicit flag
  if (cliFlag !== undefined) {
    return getConfigPath(cliFlag);
  }

  // 2. Environment variable
  if (process.env.MYCLI_GLOBAL_CONFIG) {
    return process.env.MYCLI_GLOBAL_CONFIG;
  }

  // 3. Config file setting
  const metaConfig = readMetaConfig(); // from ~/.config/mycli/settings
  if (metaConfig?.useGlobal) {
    return getConfigPath(true);
  }

  // 4. Default to local
  return getConfigPath(false);
}
```

### Pattern C: Bun-Style Config File

```toml
# ~/.config/mycli/config.toml
[locations]
globalConfig = "~/.config/mycli"
localConfig = ".mycli"

[behavior]
preferGlobal = false
```

```typescript
import { parse } from '@iarna/toml';
import { readFileSync } from 'fs';

function loadConfig() {
  const configFile = join(
    process.env.XDG_CONFIG_HOME || join(homedir(), '.config'),
    'mycli/config.toml'
  );

  try {
    return parse(readFileSync(configFile, 'utf-8'));
  } catch {
    return getDefaults();
  }
}
```

### Testing Pattern

```typescript
import { describe, it, expect, beforeEach } from 'bun:test';

describe('global flag', () => {
  beforeEach(() => {
    delete process.env.XDG_CONFIG_HOME;
  });

  it('resolves to XDG_CONFIG_HOME when set', () => {
    process.env.XDG_CONFIG_HOME = '/tmp/config';
    expect(getConfigPath(true)).toBe('/tmp/config/mycli');
  });

  it('falls back to ~/.config on Linux', () => {
    const original = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux' });
    expect(getConfigPath(true)).toMatch(/\.config\/mycli$/);
    Object.defineProperty(process, 'platform', { value: original });
  });
});
```

---

## Implementation Checklist

- [ ] Choose flag pattern: `-g`/`--global` (npm/pnpm style) vs command (yarn style)
- [ ] Implement cross-platform directory resolution (XDG spec)
- [ ] Support environment variable overrides (`XDG_CONFIG_HOME`, `APPDATA`)
- [ ] Default to user-scoped paths (avoid sudo requirements)
- [ ] Document PATH setup for global binaries
- [ ] Set appropriate file permissions (600 for configs)
- [ ] Add config hierarchy: CLI flag > ENV > Config file > Default
- [ ] Write tests for each platform (macOS, Linux, Windows)
- [ ] Document security model in README
- [ ] Consider config file format (TOML/JSON/YAML)

---

## Unresolved Questions

None—research covered all requested areas with actionable patterns.

---

## Citations

1. XDG Base Directory Specification - https://wiki.archlinux.org/title/XDG_Base_Directory
2. Cross-platform XDG implementation - https://github.com/folder/xdg
3. npm location flag documentation - https://stackoverflow.com/questions/npm-warn-config
4. Yarn global command - https://classic.yarnpkg.com/lang/en/docs/cli/global/
5. pnpm configuration - https://pnpm.io/npmrc
6. Bun install documentation - https://bun.com/docs/pm/cli/install
7. oclif CLI framework - https://oclif.io/
8. Node.js CLI frameworks comparison - https://npm-compare.com/commander,oclif,yargs
9. Sudo security best practices - https://www.linux-magazine.com/Online/Features/Using-Sudo-Options-to-Enhance-Security
10. Linux privilege management - https://www.beyondtrust.com/blog/entry/unix-linux-privileged-management-should-you-sudo
