# Code Standards and Conventions
# ClaudeKit CLI

**Version:** 1.0
**Date:** 2025-10-08
**Status:** Active
**Applies to:** TypeScript, Bun runtime

---

## Table of Contents

1. [Core Principles](#core-principles)
2. [TypeScript Standards](#typescript-standards)
3. [File Organization](#file-organization)
4. [Naming Conventions](#naming-conventions)
5. [Error Handling](#error-handling)
6. [Security Standards](#security-standards)
7. [Testing Standards](#testing-standards)
8. [Documentation Standards](#documentation-standards)
9. [Git Workflow](#git-workflow)
10. [Code Review Checklist](#code-review-checklist)

---

## Core Principles

### YAGNI (You Aren't Gonna Need It)

**Principle:** Only implement features when they are actually needed, not when you anticipate they might be needed.

**Examples:**

**❌ Bad - Over-engineering:**
```typescript
// Unnecessary abstraction for simple config
class ConfigStrategy {
  abstract load(): Promise<Config>;
}

class JsonConfigStrategy extends ConfigStrategy { ... }
class YamlConfigStrategy extends ConfigStrategy { ... }
class TomlConfigStrategy extends ConfigStrategy { ... }
```

**✅ Good - Simple and direct:**
```typescript
// Simple, focused implementation
class ConfigManager {
  static async load(): Promise<Config> {
    const data = await Bun.file(CONFIG_PATH).json();
    return ConfigSchema.parse(data);
  }
}
```

---

### KISS (Keep It Simple, Stupid)

**Principle:** Favor simple, straightforward solutions over complex ones.

**Examples:**

**❌ Bad - Overly complex:**
```typescript
const processFiles = pipe(
  filter((f: string) => !ig.ignores(f)),
  map((f: string) => path.resolve(f)),
  tap((f: string) => logger.debug(f)),
  toArray()
);
```

**✅ Good - Clear and simple:**
```typescript
const processFiles = (files: string[]) => {
  return files
    .filter(f => !ig.ignores(f))
    .map(f => path.resolve(f));
};
```

---

### DRY (Don't Repeat Yourself)

**Principle:** Avoid duplicating logic; extract common patterns into reusable functions.

**Examples:**

**❌ Bad - Repeated logic:**
```typescript
// In new.ts
logger.info(pc.cyan('Downloading release...'));
const response = await fetch(url);
// handle response...

// In update.ts
logger.info(pc.cyan('Downloading release...'));
const response = await fetch(url);
// handle response...
```

**✅ Good - Extracted to reusable class:**
```typescript
// In lib/download.ts
class DownloadManager {
  async downloadAsset(asset: GitHubReleaseAsset): Promise<string> {
    logger.info(pc.cyan('Downloading release...'));
    const response = await fetch(asset.browser_download_url);
    // centralized download logic
  }
}
```

---

## TypeScript Standards

### Strict Mode Configuration

**Required `tsconfig.json` settings:**

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

---

### Type Safety

**1. Use Zod for Runtime Validation:**

```typescript
import { z } from 'zod';

// Define schema
export const NewCommandOptionsSchema = z.object({
  dir: z.string().default('.'),
  kit: KitType.optional(),
  version: z.string().optional(),
});

// Infer TypeScript type from schema
export type NewCommandOptions = z.infer<typeof NewCommandOptionsSchema>;

// Validate at runtime
const options = NewCommandOptionsSchema.parse(rawInput);
```

**Benefits:**
- Compile-time type checking
- Runtime validation
- Automatic type inference
- Clear error messages

---

**2. Avoid `any` Type:**

**❌ Bad:**
```typescript
function processData(data: any) {
  return data.map((item: any) => item.value);
}
```

**✅ Good:**
```typescript
interface DataItem {
  value: string;
}

function processData(data: DataItem[]): string[] {
  return data.map(item => item.value);
}
```

**Exceptions:** Only use `any` when:
- Wrapping external untyped libraries
- Type is truly unknown and needs runtime checking
- Always document why `any` is necessary

---

**3. Use Type Guards:**

```typescript
function isGitHubError(error: unknown): error is GitHubError {
  return error instanceof GitHubError;
}

try {
  await client.getRelease();
} catch (error) {
  if (isGitHubError(error)) {
    // TypeScript knows error is GitHubError here
    logger.error(`GitHub API error: ${error.statusCode}`);
  }
}
```

---

### Interface vs Type

**Use `interface` for:**
- Object shapes that might be extended
- Public APIs
- Class contracts

```typescript
interface ConfigManager {
  load(): Promise<Config>;
  save(config: Config): Promise<void>;
}
```

**Use `type` for:**
- Union types
- Intersection types
- Mapped types
- Type inference from Zod

```typescript
type KitType = 'engineer' | 'marketing';
type AuthMethod = 'gh-cli' | 'env-var' | 'keychain' | 'prompt';
type NewCommandOptions = z.infer<typeof NewCommandOptionsSchema>;
```

---

## File Organization

### Directory Structure

```
src/
├── index.ts              # CLI entry point
├── types.ts              # Type definitions and schemas
├── commands/             # Command implementations
│   ├── new.ts
│   └── update.ts
├── lib/                  # Core libraries
│   ├── auth.ts
│   ├── github.ts
│   ├── download.ts
│   ├── merge.ts
│   └── prompts.ts
└── utils/                # Utility functions
    ├── config.ts
    └── logger.ts

tests/                    # Mirror src structure
├── types.test.ts
├── lib/
│   ├── auth.test.ts
│   └── ...
└── utils/
    ├── config.test.ts
    └── logger.test.ts
```

---

### File Size Limits

**Hard Limit:** 500 lines per file
**Recommended:** < 200 lines per file

**Why:** Smaller files are:
- Easier to understand
- Easier to test
- Easier to maintain
- Better for code review

**When to split:**
```typescript
// If auth.ts gets > 200 lines, split into:
auth/
├── index.ts           // Public API
├── manager.ts         // AuthManager class
├── providers/
│   ├── gh-cli.ts     // GitHub CLI provider
│   ├── env.ts        // Environment variable provider
│   └── keychain.ts   // Keychain provider
└── types.ts           // Auth-specific types
```

---

### Import Organization

**Order:**
1. External dependencies
2. Internal absolute imports
3. Internal relative imports
4. Type-only imports

```typescript
// 1. External dependencies
import { z } from 'zod';
import { Octokit } from '@octokit/rest';

// 2. Internal absolute imports
import { logger } from '@/utils/logger';
import { ConfigManager } from '@/utils/config';

// 3. Internal relative imports
import { AuthManager } from './auth';
import { DownloadManager } from './download';

// 4. Type-only imports
import type { GitHubRelease, KitConfig } from '@/types';
```

---

## Naming Conventions

### Variables and Functions

**camelCase for variables and functions:**

```typescript
const targetDirectory = './my-app';
const isValid = true;

function validateToken(token: string): boolean { ... }
async function downloadRelease(url: string): Promise<void> { ... }
```

**Descriptive names over short names:**

**❌ Bad:**
```typescript
const t = 'ghp_token123';
const d = './dir';
const fn = async (x) => { ... };
```

**✅ Good:**
```typescript
const githubToken = 'ghp_token123';
const targetDirectory = './dir';
const downloadAsset = async (asset: GitHubReleaseAsset) => { ... };
```

---

### Classes and Types

**PascalCase for classes, interfaces, types, and enums:**

```typescript
class AuthManager { ... }
class DownloadManager { ... }

interface GitHubClient { ... }
type KitType = 'engineer' | 'marketing';

enum LogLevel {
  Debug,
  Info,
  Warning,
  Error
}
```

---

### Constants

**UPPER_SNAKE_CASE for constants:**

```typescript
const CONFIG_PATH = join(homedir(), '.claudekit', 'config.json');
const GITHUB_API_TIMEOUT = 30_000;
const MAX_RETRY_ATTEMPTS = 3;

// Exception: Zod schemas use PascalCase
const NewCommandOptionsSchema = z.object({ ... });
```

---

### Files and Directories

**kebab-case for files and directories:**

```typescript
// Files
auth-manager.ts
download-manager.ts
file-merger.ts

// Directories
user-commands/
github-client/
```

**Exception:** Test files mirror source file names:
```typescript
src/lib/auth.ts → tests/lib/auth.test.ts
```

---

## Error Handling

### Custom Error Classes

**Define specific error types:**

```typescript
export class ClaudeKitError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'ClaudeKitError';
  }
}

export class AuthenticationError extends ClaudeKitError {
  constructor(message: string) {
    super(message, 'AUTH_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}
```

**Benefits:**
- Type-safe error handling
- Consistent error structure
- Easy to filter and handle specific errors

---

### Error Handling Patterns

**1. Try-Catch with Cleanup:**

```typescript
async function downloadAndExtract(url: string): Promise<void> {
  const tempDir = await createTempDir();

  try {
    const archivePath = await downloadFile(url, tempDir);
    await extractArchive(archivePath, tempDir);
  } catch (error) {
    logger.error('Download failed', error);
    throw new DownloadError('Failed to download release', error);
  } finally {
    // Always clean up
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
```

---

**2. Type Guards for Error Handling:**

```typescript
try {
  await githubClient.getRelease(kit);
} catch (error) {
  if (error instanceof GitHubError && error.statusCode === 404) {
    logger.error('Release not found. Check kit name and version.');
  } else if (error instanceof GitHubError && error.statusCode === 401) {
    logger.error('Authentication failed. Check your GitHub token.');
  } else {
    logger.error('Unexpected error', error);
  }
  throw error;
}
```

---

**3. Result Type Pattern (Future Enhancement):**

```typescript
// Optional: Use for operations that may fail
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

async function tryDownload(url: string): Promise<Result<string>> {
  try {
    const path = await download(url);
    return { ok: true, value: path };
  } catch (error) {
    return { ok: false, error: error as Error };
  }
}
```

---

### User-Friendly Error Messages

**Structure:**
1. What went wrong
2. Why it happened (if known)
3. How to fix it

**Examples:**

**❌ Bad:**
```typescript
throw new Error('Token invalid');
```

**✅ Good:**
```typescript
throw new AuthenticationError(
  'GitHub token is invalid or expired.\n' +
  'Please check your token and try again.\n' +
  'Create a new token at: https://github.com/settings/tokens'
);
```

---

## Security Standards

### Token Security

**1. Never Log Tokens:**

```typescript
// ❌ NEVER do this
logger.debug(`Using token: ${token}`);
logger.error(`Auth failed with token ${token}`);

// ✅ Always sanitize
logger.debug('Using token: ***');
logger.error('Authentication failed. Please check your token.');
```

---

**2. Token Sanitization:**

```typescript
const sanitize = (text: string): string => {
  return text
    .replace(/ghp_[a-zA-Z0-9]{36}/g, 'ghp_***')
    .replace(/github_pat_[a-zA-Z0-9_]{82}/g, 'github_pat_***')
    .replace(/gho_[a-zA-Z0-9]{36}/g, 'gho_***')
    .replace(/ghu_[a-zA-Z0-9]{36}/g, 'ghu_***')
    .replace(/ghs_[a-zA-Z0-9]{36}/g, 'ghs_***')
    .replace(/ghr_[a-zA-Z0-9]{36}/g, 'ghr_***');
};

// Use in all logging
logger.error(sanitize(errorMessage));
```

---

**3. Secure Storage:**

```typescript
import keytar from 'keytar';

const SERVICE_NAME = 'claudekit-cli';
const ACCOUNT_NAME = 'github-token';

// Store token
await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, token);

// Retrieve token
const token = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);

// Delete token
await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
```

---

### Input Validation

**Always validate external input with Zod:**

```typescript
// Command line arguments
const options = NewCommandOptionsSchema.parse(rawOptions);

// API responses
const release = GitHubReleaseSchema.parse(apiResponse);

// User input
const directory = z.string().min(1).parse(userInput);

// Environment variables
const token = GitHubTokenSchema.parse(process.env.GITHUB_TOKEN);
```

---

### Path Security

**Prevent path traversal:**

```typescript
function isSafePath(basePath: string, targetPath: string): boolean {
  const resolvedBase = path.resolve(basePath);
  const resolvedTarget = path.resolve(targetPath);

  // Ensure target is within base
  return resolvedTarget.startsWith(resolvedBase);
}

// Use in file operations
if (!isSafePath(outputDir, filePath)) {
  throw new Error('Path traversal detected');
}
```

---

## Testing Standards

### Test Structure

**Use Bun Test with clear descriptions:**

```typescript
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';

describe('AuthManager', () => {
  beforeEach(async () => {
    // Setup
  });

  afterEach(async () => {
    // Cleanup
  });

  test('should detect GitHub CLI token', async () => {
    // Arrange
    const authManager = new AuthManager();

    // Act
    const { method, token } = await authManager.getToken();

    // Assert
    expect(method).toBe('gh-cli');
    expect(token).toMatch(/^ghp_/);
  });

  test('should fall back to environment variable', async () => {
    // Test implementation
  });
});
```

---

### Test Coverage Requirements

**Minimum Coverage:** 80%
**Target Coverage:** 90%+

**What to test:**
- ✅ All public methods
- ✅ Error scenarios
- ✅ Edge cases
- ✅ Type validation
- ✅ Security features

**What NOT to test:**
- ❌ External libraries (Octokit, etc.)
- ❌ Trivial getters/setters
- ❌ Type definitions only

---

### Mocking Best Practices

```typescript
import { mock } from 'bun:test';

test('should handle network errors', async () => {
  // Mock fetch to simulate network error
  const mockFetch = mock(() => {
    throw new Error('Network error');
  });

  globalThis.fetch = mockFetch;

  await expect(downloadFile(url)).rejects.toThrow('Network error');

  // Restore original fetch
  mockFetch.mockRestore();
});
```

---

## Documentation Standards

### JSDoc Comments

**Required for all public APIs:**

```typescript
/**
 * Downloads a GitHub release asset to the specified directory
 *
 * @param asset - The GitHub release asset to download
 * @param destDir - Destination directory for the downloaded file
 * @returns Path to the downloaded file
 * @throws {DownloadError} If download fails or is interrupted
 *
 * @example
 * ```typescript
 * const path = await downloadManager.downloadAsset(asset, './temp');
 * console.log(`Downloaded to: ${path}`);
 * ```
 */
async downloadAsset(
  asset: GitHubReleaseAsset,
  destDir: string
): Promise<string> {
  // Implementation
}
```

---

### Inline Comments

**When to comment:**
- Complex algorithms
- Non-obvious business logic
- Security considerations
- Performance optimizations
- Workarounds

**When NOT to comment:**
- Self-explanatory code
- Trivial operations
- Repeating what code says

**❌ Bad:**
```typescript
// Increment counter
counter++;

// Loop through files
for (const file of files) { ... }
```

**✅ Good:**
```typescript
// Strip top-level directory from archive to avoid nested structure
// GitHub releases include repo name as root dir
const strippedPath = relativePath.split('/').slice(1).join('/');

// Use exponential backoff to avoid rate limiting
await sleep(Math.pow(2, retryCount) * 1000);
```

---

## Git Workflow

### Commit Messages

**Format:** Conventional Commits

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**

```
feat(auth): add GitHub CLI token detection

Implement automatic token detection from gh CLI when available.
Falls back to environment variables if gh CLI is not found.

Closes #123
```

```
fix(download): handle network timeouts gracefully

Add AbortSignal timeout to prevent hanging on slow connections.
Show clear error message when timeout occurs.
```

```
docs(readme): update authentication setup guide

Add instructions for fine-grained PAT creation.
Include minimum required permissions.
```

---

### Branch Naming

**Format:** `<type>/<short-description>`

**Examples:**
- `feat/github-cli-auth`
- `fix/download-timeout`
- `docs/update-readme`
- `refactor/split-auth-providers`

---

### Pull Request Guidelines

**PR Title:** Same as commit message format

**PR Description:**
```markdown
## Summary
Brief description of changes

## Changes
- Added GitHub CLI token detection
- Updated authentication fallback chain
- Added tests for new auth method

## Testing
- ✅ All tests passing
- ✅ Manual testing with gh CLI
- ✅ Manual testing without gh CLI

## Checklist
- [x] Tests added/updated
- [x] Documentation updated
- [x] Type checking passes
- [x] Linting passes
```

---

## Code Review Checklist

### Functionality
- [ ] Code implements requirements correctly
- [ ] Edge cases handled
- [ ] Error scenarios covered
- [ ] No regressions introduced

### Code Quality
- [ ] Follows YAGNI, KISS, DRY principles
- [ ] Clean, readable code
- [ ] No code duplication
- [ ] Consistent naming conventions
- [ ] Files under 500 lines

### Security
- [ ] No token exposure
- [ ] Input validation present
- [ ] Path validation for file operations
- [ ] No hardcoded secrets

### Performance
- [ ] Efficient algorithms used
- [ ] Streaming for large files
- [ ] No memory leaks
- [ ] Proper async/await usage

### Testing
- [ ] Unit tests added/updated
- [ ] All tests passing
- [ ] Coverage meets requirements
- [ ] Edge cases tested

### Documentation
- [ ] JSDoc for public APIs
- [ ] Inline comments for complex logic
- [ ] README updated if needed
- [ ] CHANGELOG updated

### TypeScript
- [ ] No type errors
- [ ] Strict mode compliant
- [ ] No `any` without justification
- [ ] Zod schemas for validation

---

## Code Quality Tools

### Linting: Biome

**Configuration** (`.biome.json`):
```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "complexity": {
        "noExtraBooleanCast": "error",
        "noMultipleSpacesInRegularExpressionLiterals": "error",
        "noUselessConstructor": "error",
        "noWith": "error"
      },
      "style": {
        "noParameterAssign": "error",
        "useConst": "error",
        "useTemplate": "error"
      },
      "suspicious": {
        "noExplicitAny": "warn",
        "noDebugger": "error",
        "noConsoleLog": "warn"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  }
}
```

---

### Type Checking

**Run before commit:**
```bash
bun run typecheck
```

**Zero tolerance:** No type errors allowed in production code.

---

### Testing

**Run before commit:**
```bash
bun test
```

**Requirements:**
- All tests must pass
- Coverage ≥ 80%
- No skipped tests without reason

---

## Best Practices Summary

### DO ✅

- Use TypeScript strict mode
- Validate all external input with Zod
- Write comprehensive tests
- Handle errors gracefully
- Use descriptive variable names
- Keep files small (< 500 lines)
- Document public APIs with JSDoc
- Sanitize sensitive data in logs
- Use streaming for large files
- Follow conventional commits

### DON'T ❌

- Use `any` type without justification
- Log sensitive data (tokens, etc.)
- Ignore error scenarios
- Write overly complex code
- Duplicate logic across files
- Hardcode configuration values
- Skip input validation
- Leave TODO comments in production
- Commit broken tests
- Push without running tests

---

## Performance Guidelines

### Memory Efficiency

**Use streaming for large operations:**

```typescript
// ✅ Good - Streaming
const stream = createWriteStream(outputPath);
for await (const chunk of downloadStream) {
  stream.write(chunk);
}

// ❌ Bad - Loading into memory
const data = await fetch(url).then(r => r.arrayBuffer());
await writeFile(outputPath, Buffer.from(data));
```

---

### Async Best Practices

**Use Promise.all for parallel operations:**

```typescript
// ✅ Good - Parallel
const [user, repos, stars] = await Promise.all([
  client.getUser(),
  client.getRepos(),
  client.getStars(),
]);

// ❌ Bad - Sequential
const user = await client.getUser();
const repos = await client.getRepos();
const stars = await client.getStars();
```

---

**Proper error handling in async:**

```typescript
async function processFiles(files: string[]): Promise<void> {
  try {
    await Promise.all(files.map(f => processFile(f)));
  } catch (error) {
    logger.error('Failed to process files', error);
    throw new ProcessingError('File processing failed', error);
  }
}
```

---

## Maintenance Guidelines

### Regular Tasks

**Weekly:**
- Review and update dependencies
- Run security audit (`bun audit`)
- Check for deprecated APIs
- Review and close stale issues

**Monthly:**
- Review test coverage
- Update documentation
- Refactor complex code
- Performance profiling

**Quarterly:**
- Major dependency updates
- Architecture review
- Security audit
- Performance benchmarking

---

### Deprecation Process

1. Mark as deprecated with JSDoc
2. Provide migration path
3. Add console warning
4. Update documentation
5. Remove after 2 versions

**Example:**

```typescript
/**
 * @deprecated Use getToken() instead. Will be removed in v2.0.0
 */
async function fetchToken(): Promise<string> {
  logger.warning('fetchToken() is deprecated. Use getToken() instead.');
  return this.getToken();
}
```

---

**Document Version:** 1.0
**Last Updated:** 2025-10-08
**Status:** Active
**Next Review:** 2025-11-08
