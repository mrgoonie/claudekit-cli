# Code Standards & Conventions

## Overview

This document defines the coding standards, conventions, and best practices for the ClaudeKit CLI codebase. All contributors must follow these guidelines to maintain code quality, consistency, and maintainability.

## General Principles

### Core Philosophy
- **YAGNI** (You Aren't Gonna Need It): Don't implement features until they're actually needed
- **KISS** (Keep It Simple, Stupid): Favor simplicity over complexity
- **DRY** (Don't Repeat Yourself): Avoid code duplication through abstraction

### Code Quality Goals
- Readability over cleverness
- Type safety over dynamic typing
- Explicit over implicit
- Maintainability over micro-optimization
- Testability built-in from the start

## TypeScript Standards

### Strict Mode Configuration
```typescript
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### Type Annotations
```typescript
// ✅ Good - Explicit return types for public functions
export async function getToken(): Promise<{ token: string; method: AuthMethod }> {
  // ...
}

// ✅ Good - Type inference for simple variables
const files = await readdir(dir);

// ❌ Bad - Any type usage
function processData(data: any) {
  // ...
}

// ✅ Good - Use unknown for truly unknown types
function processData(data: unknown) {
  if (typeof data === 'string') {
    // ...
  }
}
```

### Interfaces vs Types
```typescript
// ✅ Good - Use types for unions, intersections, and mapped types
export type ArchiveType = "tar.gz" | "zip";
export type AuthMethod = "gh-cli" | "env-var" | "keychain" | "prompt";

// ✅ Good - Use interfaces for object shapes that may be extended
export interface DownloadProgress {
  total: number;
  current: number;
  percentage: number;
}

// ✅ Good - Use Zod schemas for runtime validation
export const KitType = z.enum(["engineer", "marketing"]);
export type KitType = z.infer<typeof KitType>;
```

### Null Safety
```typescript
// ✅ Good - Use optional chaining and nullish coalescing
const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
const ghToken = execSync("gh auth token -h github.com", { encoding: "utf-8" }).trim();

// ✅ Good - Explicit null checks
if (token === null || token === undefined) {
  throw new Error("Token is required");
}

// ❌ Bad - Implicit falsy checks
if (!token) { // Could match empty string
  throw new Error("Token is required");
}
```

## File Organization

### Directory Structure
```
src/
├── cli/             # CLI infrastructure (config, registry, version display)
├── commands/        # Command implementations with phase handlers
│   ├── init/        # Orchestrator + phases/ subdirectory
│   ├── new/         # Orchestrator + phases/ subdirectory
│   └── uninstall/   # Command + handler modules
├── domains/         # Business logic by domain (facade pattern)
│   ├── config/      # Configuration management + merger/ submodules
│   ├── github/      # GitHub API + client/ submodules
│   ├── health-checks/  # Doctor command + checkers/, platform/, utils/
│   ├── help/        # Help system + commands/ submodules
│   ├── installation/   # Download/extraction + download/, extraction/, merger/, package-managers/, utils/
│   ├── skills/      # Skills management + customization/, detection/, migrator/
│   ├── ui/          # User interface + prompts/
│   └── versioning/  # Version management + checking/, selection/
├── services/        # Cross-domain services
│   ├── file-operations/  # File ops + manifest/
│   ├── package-installer/  # Package install + dependencies/, gemini-mcp/
│   └── transformers/     # Path transforms + commands-prefix/, folder-transform/
├── shared/          # Pure utilities (no domain logic)
├── types/           # Domain-specific types & Zod schemas
└── index.ts         # Entry point
```

### Modularization Standards

#### File Size Limits
- **Target**: <100 lines per submodule
- **Maximum**: 200 lines (hard limit)
- **Facades**: 50-150 lines (orchestration only)
- If exceeding, split into smaller focused modules

#### Facade Pattern
Each domain exposes a facade file that:
- Re-exports public API from submodules
- Provides backward-compatible interface
- Hides internal implementation details

```typescript
// Example: domains/config/settings-merger.ts (Facade)
export { mergeSettings, validateMerge } from "./merger/merge-engine.js";
export { resolveConflicts } from "./merger/conflict-resolver.js";
export type { MergeResult, MergeOptions } from "./merger/types.js";
```

#### Phase Handler Pattern
Complex commands use orchestrator + phase handlers:
- Orchestrator coordinates phases (~100 lines)
- Each phase handles one responsibility (~50-100 lines)
- Phases are independently testable

```typescript
// commands/init/
├── index.ts              # Public exports (facade)
├── init-command.ts       # Orchestrator
├── types.ts              # Command-specific types
└── phases/               # Phase handlers
    ├── options-resolver.ts
    ├── selection-handler.ts
    ├── download-handler.ts
    ├── migration-handler.ts
    ├── merge-handler.ts
    ├── conflict-handler.ts
    ├── transform-handler.ts
    └── post-install-handler.ts
```

### File Naming Conventions
- Use **kebab-case** for file names: `file-scanner.ts`, `safe-prompts.ts`
- Use **self-documenting names** that describe purpose without reading content
- Names should tell LLMs what the file does when using Grep/Glob tools
- Test files mirror source structure: `src/domains/config/settings-merger.ts` → `tests/lib/settings-merger.test.ts`

**Good Examples:**
- `conflict-resolver.ts` - Resolves merge conflicts
- `hash-calculator.ts` - Calculates file hashes
- `prefix-applier.ts` - Applies command prefixes
- `migration-validator.ts` - Validates migrations

**Bad Examples:**
- `utils.ts` - Too generic
- `helpers.ts` - Doesn't describe what it helps with
- `index.ts` (for logic) - Should only re-export

### Module Organization
```typescript
// 1. Node.js built-in imports
import { resolve } from "node:path";
import { createWriteStream } from "node:fs";

// 2. Internal imports (path aliases - sorted first by Biome)
import { AuthManager } from "@/domains/github/github-auth.js";
import { logger } from "@/shared/logger.js";
import type { GitHubRelease, KitConfig } from "@/types";

// 3. External dependencies (sorted after internal by Biome)
import { Octokit } from "@octokit/rest";
import * as clack from "@clack/prompts";

// 4. Constants
const SERVICE_NAME = "claudekit-cli";
const MAX_RETRIES = 3;

// 5. Types and interfaces
interface DownloadOptions {
  url: string;
  destDir: string;
}

// 6. Implementation
export class DownloadManager {
  // ...
}
```

### Path Aliases

Use TypeScript path aliases (`@/`) for all internal imports instead of relative paths:

```typescript
// ✅ Good - Path aliases
import { logger } from "@/shared/logger.js";
import { ConfigManager } from "@/domains/config/config-manager.js";
import type { GitHubRelease } from "@/types";

// ❌ Bad - Relative paths (fragile, hard to read)
import { logger } from "../../../shared/logger.js";
import { ConfigManager } from "../../domains/config/config-manager.js";
```

**Available Aliases** (defined in `tsconfig.json`):
- `@/*` → `src/*`
- `@/domains/*` → `src/domains/*`
- `@/services/*` → `src/services/*`
- `@/shared/*` → `src/shared/*`
- `@/types` → `src/types`

**Import Order** (enforced by Biome linter):
1. Node.js built-in imports (`node:*`)
2. Internal imports (`@/*`) - sorted alphabetically
3. External dependencies - sorted alphabetically

**Note**: Always include `.js` extension for ESM compatibility.

## Naming Conventions

### Variables and Functions
```typescript
// ✅ Good - camelCase for variables and functions
const targetDirectory = resolve(dir);
async function downloadFile(url: string): Promise<string> {}

// ✅ Good - Descriptive names
const customClaudeFiles = await FileScanner.findCustomFiles(destDir, extractDir, ".claude");

// ❌ Bad - Abbreviations and short names
const tgtDir = resolve(d);
async function dl(u: string): Promise<string> {}
```

### Classes and Types
```typescript
// ✅ Good - PascalCase for classes, interfaces, types
export class AuthManager {}
export interface DownloadProgress {}
export type ArchiveType = "tar.gz" | "zip";

// ✅ Good - Descriptive class names
export class GitHubClient {}
export class DownloadManager {}
export class FileMerger {}
```

### Constants
```typescript
// ✅ Good - UPPER_SNAKE_CASE for constants
const MAX_EXTRACTION_SIZE = 500 * 1024 * 1024;
const SERVICE_NAME = "claudekit-cli";
const ACCOUNT_NAME = "github-token";

// ✅ Good - Readonly arrays
export const PROTECTED_PATTERNS = [
  ".env",
  ".env.local",
  "*.key",
] as const;
```

### Boolean Variables
```typescript
// ✅ Good - Use is/has/should prefix
const isNonInteractive = !process.stdin.isTTY;
const hasAccess = await github.checkAccess(kitConfig);
const shouldExclude = this.ig.ignores(filePath);

// ❌ Bad - Ambiguous boolean names
const interactive = !process.stdin.isTTY;
const access = await github.checkAccess(kitConfig);
```

## Function Standards

### Function Size
- Target: **<50 lines** per function
- Maximum: **<100 lines** per function
- Extract complex logic into helper functions
- Use early returns to reduce nesting

### Function Design
```typescript
// ✅ Good - Single Responsibility Principle
async function downloadFile(url: string, destPath: string): Promise<void> {
  const response = await fetch(url);
  const stream = createWriteStream(destPath);
  await pipeline(response.body, stream);
}

async function extractArchive(archivePath: string, destDir: string): Promise<void> {
  if (archivePath.endsWith('.tar.gz')) {
    await this.extractTarGz(archivePath, destDir);
  } else {
    await this.extractZip(archivePath, destDir);
  }
}

// ❌ Bad - Multiple responsibilities
async function downloadAndExtract(url: string, destDir: string): Promise<void> {
  // Downloads, extracts, validates, and merges - too much!
}
```

### Parameter Handling
```typescript
// ✅ Good - Use options object for >3 parameters
interface DownloadOptions {
  url: string;
  name: string;
  size?: number;
  destDir: string;
  token?: string;
}

async function downloadFile(options: DownloadOptions): Promise<string> {
  const { url, name, size, destDir, token } = options;
  // ...
}

// ❌ Bad - Too many positional parameters
async function downloadFile(
  url: string,
  name: string,
  size: number,
  destDir: string,
  token: string,
  retries: number
): Promise<string> {}
```

### Error Handling
```typescript
// ✅ Good - Explicit error types and messages
try {
  await downloadFile(options);
} catch (error) {
  throw new DownloadError(
    `Failed to download ${name}: ${error instanceof Error ? error.message : "Unknown error"}`
  );
}

// ✅ Good - Validate inputs early
function isPathSafe(basePath: string, targetPath: string): boolean {
  if (!basePath || !targetPath) {
    throw new Error("Base path and target path are required");
  }
  // ...
}

// ❌ Bad - Swallowing errors
try {
  await someOperation();
} catch (error) {
  // Silent failure
}
```

## Class Standards

### Class Structure
```typescript
export class DownloadManager {
  // 1. Static constants
  private static MAX_EXTRACTION_SIZE = 500 * 1024 * 1024;
  private static EXCLUDE_PATTERNS = [".git", "node_modules"];

  // 2. Instance properties
  private totalExtractedSize = 0;
  private ig: ReturnType<typeof ignore>;

  // 3. Constructor
  constructor() {
    this.ig = ignore().add(DownloadManager.EXCLUDE_PATTERNS);
  }

  // 4. Public methods
  async downloadFile(options: DownloadOptions): Promise<string> {
    // ...
  }

  // 5. Private methods
  private isPathSafe(basePath: string, targetPath: string): boolean {
    // ...
  }
}
```

### Static vs Instance Methods
```typescript
// ✅ Good - Static for utilities that don't need instance state
export class GitHubClient {
  static getDownloadableAsset(release: GitHubRelease): AssetInfo {
    // Pure function, no instance state needed
  }

  async getLatestRelease(kit: KitConfig): Promise<GitHubRelease> {
    // Needs instance state (octokit client)
  }
}
```

### Access Modifiers
```typescript
// ✅ Good - Use private for internal methods
class DownloadManager {
  private async extractTarGz(archivePath: string, destDir: string): Promise<void> {
    // Internal implementation detail
  }

  public async extractArchive(archivePath: string, destDir: string): Promise<void> {
    // Public API
  }
}
```

## Error Handling

### Custom Error Classes
```typescript
// ✅ Good - Structured error hierarchy
export class ClaudeKitError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = "ClaudeKitError";
  }
}

export class AuthenticationError extends ClaudeKitError {
  constructor(message: string) {
    super(message, "AUTH_ERROR", 401);
    this.name = "AuthenticationError";
  }
}

export class DownloadError extends ClaudeKitError {
  constructor(message: string) {
    super(message, "DOWNLOAD_ERROR");
    this.name = "DownloadError";
  }
}
```

### Error Handling Patterns
```typescript
// ✅ Good - Try-catch with specific error handling
try {
  const release = await github.getLatestRelease(kitConfig);
} catch (error: any) {
  if (error?.status === 404) {
    throw new GitHubError(`No releases found for ${kit.name}`, 404);
  }
  if (error?.status === 401) {
    throw new GitHubError("Authentication failed", 401);
  }
  throw new GitHubError(`Failed to fetch release: ${error?.message}`, error?.status);
}

// ✅ Good - Cleanup in finally
let fileStream: WriteStream | null = null;
try {
  fileStream = createWriteStream(destPath);
  // ... operations
} catch (error) {
  throw new DownloadError(`Download failed: ${error.message}`);
} finally {
  fileStream?.close();
}
```

## Async/Await Standards

### Promise Handling
```typescript
// ✅ Good - Always await promises
const release = await github.getLatestRelease(kitConfig);
const files = await readdir(dir);

// ✅ Good - Parallel operations when possible
const [release, hasAccess] = await Promise.all([
  github.getLatestRelease(kitConfig),
  github.checkAccess(kitConfig),
]);

// ❌ Bad - Unhandled promise
github.getLatestRelease(kitConfig); // Fire and forget
```

### Async Function Design
```typescript
// ✅ Good - Top-level async for commands
export async function newCommand(options: NewCommandOptions): Promise<void> {
  try {
    // ... async operations
  } catch (error) {
    logger.error(error.message);
    process.exit(1);
  }
}

// ✅ Good - Return promises explicitly when needed
function downloadFile(url: string): Promise<string> {
  return fetch(url).then(res => res.text());
}
```

## Validation & Schemas

### Zod Schema Usage
```typescript
// ✅ Good - Define schemas for all external inputs
export const NewCommandOptionsSchema = z.object({
  dir: z.string().default("."),
  kit: KitType.optional(),
  version: z.string().optional(),
  force: z.boolean().default(false),
  exclude: z.array(ExcludePatternSchema).optional().default([]),
});

export type NewCommandOptions = z.infer<typeof NewCommandOptionsSchema>;

// ✅ Good - Validate at boundaries
export async function newCommand(options: NewCommandOptions): Promise<void> {
  const validOptions = NewCommandOptionsSchema.parse(options);
  // ... proceed with validated options
}
```

### Input Validation
```typescript
// ✅ Good - Custom validation with Zod refine
export const ExcludePatternSchema = z
  .string()
  .trim()
  .min(1, "Exclude pattern cannot be empty")
  .max(500, "Exclude pattern too long")
  .refine((val) => !val.startsWith("/"), "Absolute paths not allowed")
  .refine((val) => !val.includes(".."), "Path traversal not allowed");
```

## Security Standards

### Token Handling
```typescript
// ✅ Good - Never log tokens directly
logger.debug(`Token method: ${method}`); // Safe
logger.debug(`Token: ${token}`); // ❌ NEVER

// ✅ Good - Sanitize in logger
class Logger {
  private sanitizeMessage(message: string): string {
    return message
      .replace(/ghp_[a-zA-Z0-9]{36}/g, "ghp_***")
      .replace(/github_pat_[a-zA-Z0-9_]{82}/g, "github_pat_***");
  }
}
```

### Path Validation
```typescript
// ✅ Good - Validate paths before operations
private isPathSafe(basePath: string, targetPath: string): boolean {
  const resolvedBase = resolve(basePath);
  const resolvedTarget = resolve(targetPath);
  const relativePath = relative(resolvedBase, resolvedTarget);

  return (
    !relativePath.startsWith("..") &&
    !relativePath.startsWith("/") &&
    resolvedTarget.startsWith(resolvedBase)
  );
}

// ✅ Good - Check before extraction
if (!this.isPathSafe(destDir, destPath)) {
  throw new ExtractionError(`Path traversal attempt: ${relativePath}`);
}
```

### Size Limits
```typescript
// ✅ Good - Enforce extraction limits
private static MAX_EXTRACTION_SIZE = 500 * 1024 * 1024;

private checkExtractionSize(fileSize: number): void {
  this.totalExtractedSize += fileSize;
  if (this.totalExtractedSize > DownloadManager.MAX_EXTRACTION_SIZE) {
    throw new ExtractionError(`Archive exceeds maximum size. Possible archive bomb.`);
  }
}
```

### Platform-Specific Path Handling

#### Global Path Resolution (v1.5.1+)
```typescript
// ✅ Good - Use centralized PathResolver for all path operations
import { PathResolver } from "../utils/path-resolver.js";

// Configuration paths
const configDir = PathResolver.getConfigDir(global);
const configFile = PathResolver.getConfigFile(global);
const cacheDir = PathResolver.getCacheDir(global);

// Component paths (agents, commands, workflows, hooks, skills)
const skillsPath = PathResolver.buildSkillsPath(baseDir, global);
const agentsPath = PathResolver.buildComponentPath(baseDir, "agents", global);
const commandsPath = PathResolver.buildComponentPath(baseDir, "commands", global);

// Directory prefix for pattern matching
const prefix = PathResolver.getPathPrefix(global);

// Global kit installation directory
const globalKitDir = PathResolver.getGlobalKitDir();
```

#### Installation Mode Detection
```typescript
// ✅ Good - Detect installation mode from directory structure
function detectInstallationMode(baseDir: string): boolean {
  // Check if .claude directory exists (local mode)
  const localClaudeDir = join(baseDir, ".claude");
  if (existsSync(localClaudeDir)) {
    return false; // Local mode
  }

  // Check if components exist directly (global mode)
  const agentsDir = join(baseDir, "agents");
  if (existsSync(agentsDir)) {
    return true; // Global mode
  }

  // Default to local mode for new installations
  return false;
}

// ✅ Good - Use detected mode for path operations
const isGlobal = detectInstallationMode(projectDir);
const skillsPath = PathResolver.buildSkillsPath(projectDir, isGlobal);
```

#### Cross-Platform Path Building
```typescript
// ✅ Good - Respect XDG environment variables on Unix
const xdgConfigHome = process.env.XDG_CONFIG_HOME;
if (xdgConfigHome) {
  return join(xdgConfigHome, "claude");
}

// ✅ Good - Windows-specific path handling with fallback
if (platform() === "win32") {
  const localAppData = process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local");
  return join(localAppData, "claude");
}

// ✅ Good - Secure directory permissions on Unix
if (platform() !== "win32") {
  await chmod(configDir, 0o700);  // drwx------
  await chmod(configFile, 0o600); // -rw-------
}
```

#### Path Validation and Security
```typescript
// ✅ Good - Validate paths before operations
function validateComponentPath(baseDir: string, component: string, global: boolean): boolean {
  const componentPath = PathResolver.buildComponentPath(baseDir, component, global);
  return isPathSafe(baseDir, componentPath);
}

// ✅ Good - Pattern matching for directory structures
function validateDirectoryStructure(baseDir: string, global: boolean): boolean {
  const expectedStructure = global
    ? ["agents", "commands", "workflows", "hooks", "skills"]
    : [".claude/agents", ".claude/commands", ".claude/workflows", ".claude/hooks", ".claude/skills"];

  return expectedStructure.every(path => {
    const fullPath = join(baseDir, path);
    return existsSync(fullPath);
  });
}
```

#### Migration and Backward Compatibility
```typescript
// ✅ Good - Handle migration from local to global paths
async function migrateToGlobalPaths(baseDir: string): Promise<void> {
  const localDir = join(baseDir, ".claude");
  const globalBaseDir = PathResolver.getGlobalKitDir();

  // Move components from local to global structure
  const components = ["agents", "commands", "workflows", "hooks", "skills"];
  for (const component of components) {
    const localComponentPath = join(localDir, component);
    const globalComponentPath = PathResolver.buildComponentPath(globalBaseDir, component, true);

    if (existsSync(localComponentPath)) {
      await rename(localComponentPath, globalComponentPath);
    }
  }
}

// ✅ Good - Backward compatibility checks
function isLegacyLocalInstallation(baseDir: string): boolean {
  const legacyPaths = [
    join(baseDir, ".claude"),
    join(baseDir, ".claude", "skills"),
    join(baseDir, ".claude", "agents")
  ];

  return legacyPaths.some(path => existsSync(path));
}
```

**XDG Base Directory Specification:**
- Configuration: `XDG_CONFIG_HOME` (default: `~/.config`)
- Cache: `XDG_CACHE_HOME` (default: `~/.cache`)
- Data: `XDG_DATA_HOME` (default: `~/.local/share`)

**Windows Standard Paths:**
- Configuration: `%LOCALAPPDATA%` (typically `C:\Users\<user>\AppData\Local`)
- Temp: `%TEMP%`

**Path Resolution Priority:**
1. **Global flag**: Use platform-specific global paths
2. **Local mode** (default): Use `~/.claudekit/` for backward compatibility
3. **Detection**: Auto-detect mode from existing directory structure
4. **Fallback**: Default to local mode for new installations

**❌ Anti-Patterns:**
```typescript
// ❌ Bad - Hardcoded platform-specific paths
const configDir = "/home/user/.config/claude"; // Won't work on Windows
const configDir = "C:\\Users\\user\\AppData\\Local\\claude"; // Won't work on Unix

// ❌ Bad - Manual path construction
const skillsPath = global ? `${baseDir}/skills` : `${baseDir}/.claude/skills`;
// Use PathResolver.buildSkillsPath() instead

// ❌ Bad - No validation
const targetPath = join(baseDir, userInput); // Security risk
// Use PathResolver methods and validate paths
```

### Dependency Installation Security

```typescript
// ✅ Good - User confirmation before installation
const shouldInstall = await clack.confirm({
  message: "Would you like to install missing dependencies automatically?",
  initialValue: true,
});

// ✅ Good - Skip auto-installation in non-interactive environments
const isNonInteractive = !process.stdin.isTTY ||
  process.env.CI === "true" ||
  process.env.NON_INTERACTIVE === "true";

if (isNonInteractive) {
  logger.info("Running in non-interactive mode. Skipping automatic installation.");
  // Provide manual instructions instead
}

// ✅ Good - Clear installation method descriptions
const methods: InstallationMethod[] = [
  {
    name: "Homebrew (macOS)",
    command: "brew install python@3.11",
    requiresSudo: false,
    platform: "darwin",
    priority: 1,
    description: "Install via Homebrew (recommended for macOS)",
  },
];

// ✅ Good - Provide manual fallback instructions
if (result.success === false) {
  logger.info("Manual installation required:");
  const instructions = getManualInstructions(dep.name, osInfo);
  for (const instruction of instructions) {
    logger.info(`  ${instruction}`);
  }
}

// ❌ Bad - Automatic sudo/admin elevation without user consent
execAsync("sudo apt install python3"); // Never do this

// ❌ Bad - Running scripts without showing users what they do
execAsync("curl -fsSL https://example.com/install.sh | bash"); // Risky without user knowledge
```

**Installation Safety Rules:**
1. Always require user confirmation in interactive mode
2. Never elevate privileges automatically
3. Provide clear descriptions of what will be installed
4. Show manual instructions as fallback
5. Skip automatic installation in CI/CD environments
6. Validate installation success after execution

## Testing Standards

### Test Organization
```typescript
// ✅ Good - Describe blocks for grouping
describe("AuthManager", () => {
  describe("getToken", () => {
    test("should return token from GitHub CLI", async () => {
      // ...
    });

    test("should fallback to environment variable", async () => {
      // ...
    });
  });
});
```

### Test Naming
```typescript
// ✅ Good - Descriptive test names
test("should exclude files matching user patterns", async () => {
  // ...
});

test("should preserve custom .claude files during update", async () => {
  // ...
});

// ❌ Bad - Vague test names
test("works", async () => {
  // ...
});
```

### Test Structure (AAA Pattern)
```typescript
// ✅ Good - Arrange, Act, Assert
test("should merge files correctly", async () => {
  // Arrange
  await writeFile(join(sourceDir, "file.txt"), "content");
  const merger = new FileMerger();

  // Act
  await merger.merge(sourceDir, destDir, true);

  // Assert
  const content = await readFile(join(destDir, "file.txt"), "utf-8");
  expect(content).toBe("content");
});
```

## Logging Standards

### Log Levels
```typescript
// ✅ Good - Appropriate log levels
logger.debug("Fetching release from GitHub API"); // Development info
logger.info("Downloading package.zip (5.2 MB)"); // User-facing info
logger.success("Project created successfully"); // Success messages
logger.warning("Asset download failed, falling back to tarball"); // Recoverable issues
logger.error("Authentication failed. Check your token."); // Errors
```

### Verbose Mode
```typescript
// ✅ Good - Use verbose for detailed logging
logger.verbose("GitHub API request", {
  url: sanitizedUrl,
  method: "GET",
  headers: sanitizedHeaders,
});

// Enable with --verbose or CLAUDEKIT_VERBOSE=1
```

## Documentation Standards

### JSDoc Comments
```typescript
// ✅ Good - Document public APIs
/**
 * Download file from URL with progress tracking
 * Supports both asset downloads and GitHub API URLs with authentication
 *
 * @param params Download parameters
 * @param params.url URL to download from
 * @param params.name File name for destination
 * @param params.size Expected file size (optional, for progress bar)
 * @param params.destDir Destination directory
 * @param params.token Authentication token (optional, for private repos)
 * @returns Path to downloaded file
 * @throws {DownloadError} If download fails
 */
async downloadFile(params: DownloadOptions): Promise<string> {
  // ...
}
```

### Code Comments
```typescript
// ✅ Good - Explain WHY, not WHAT
// Reset extraction size to prevent accumulation across multiple archives
this.resetExtractionSize();

// Apply user patterns after defaults to ensure they take precedence
this.ig = ignore().add([...DownloadManager.EXCLUDE_PATTERNS, ...userPatterns]);

// ❌ Bad - State the obvious
// Set the token
this.token = token;
```

## Performance Standards

### Memory Efficiency
```typescript
// ✅ Good - Stream large files
const fileStream = createWriteStream(destPath);
const reader = response.body?.getReader();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  fileStream.write(value);
}

// ❌ Bad - Load entire file in memory
const buffer = await response.arrayBuffer();
await writeFile(destPath, Buffer.from(buffer));
```

### Parallel Operations
```typescript
// ✅ Good - Parallel independent operations
const [release, hasAccess] = await Promise.all([
  github.getLatestRelease(kitConfig),
  github.checkAccess(kitConfig),
]);

// ✅ Good - Sequential when dependencies exist
const release = await github.getLatestRelease(kitConfig);
const asset = GitHubClient.getDownloadableAsset(release);
const archivePath = await downloadManager.downloadFile(asset);
```

## Import/Export Standards

### ESM Imports
```typescript
// ✅ Good - Use path aliases with .js extension (ESM requirement)
import { AuthManager } from "@/domains/github/github-auth.js";
import { logger } from "@/shared/logger.js";

// ✅ Good - Use type imports when only importing types
import type { GitHubRelease, KitConfig } from "@/types";
```

### Exports
```typescript
// ✅ Good - Named exports for most cases
export class AuthManager {}
export function downloadFile() {}
export const PROTECTED_PATTERNS = [];

// ✅ Good - Default exports only for entry points
export default function main() {}
```

## Git Commit Standards

### Commit Message Format
```
type(scope): subject

body (optional)

footer (optional)
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tool changes

### Examples
```
feat(commands): add version listing command

Implement new 'ck versions' command to list all available releases
for ClaudeKit kits with filtering and pagination support.

Closes #42
```

```
fix(download): handle percent-encoded paths in tarballs

GitHub tarballs may contain percent-encoded file paths that need
to be decoded to prevent character encoding issues.
```

## Code Review Checklist

### Before Submitting
- [ ] Code follows TypeScript strict mode
- [ ] All functions have appropriate error handling
- [ ] Security validations in place (path safety, size limits)
- [ ] Tests written and passing
- [ ] No sensitive data in logs
- [ ] Documentation updated
- [ ] Commit messages follow conventional format

### During Review
- [ ] Code is readable and maintainable
- [ ] No unnecessary complexity
- [ ] Performance considerations addressed
- [ ] Edge cases handled
- [ ] Type safety maintained
- [ ] Security best practices followed

## Tools & Automation

### Linting
```bash
bun run lint        # Check code quality
bun run format      # Auto-format code
```

### Type Checking
```bash
bun run typecheck   # Verify TypeScript types
```

### Testing
```bash
bun test           # Run all tests
bun test --watch   # Watch mode
```

## Continuous Improvement

### Regular Reviews
- Weekly code quality reviews
- Monthly documentation updates
- Quarterly standards revision
- Annual architecture assessment

### Metrics
- Maintain >80% test coverage
- Keep average file size <500 lines
- Maintain <10% code duplication
- Track and reduce cyclomatic complexity
