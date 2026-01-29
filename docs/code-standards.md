# Code Standards & Conventions

## Version 3.32.0-dev.3

**Core Principles**: YAGNI | KISS | DRY

**Code Goals**: Readability > cleverness | Type safety | Explicit | Maintainability | Testability

## TypeScript Standards

### Strict Mode
tsconfig.json: `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `noImplicitReturns: true`

### Type Annotations
- Explicit return types for public functions
- Type inference for simple variables
- Use `unknown` instead of `any`
- Types for unions; interfaces for extensible shapes
- Zod schemas for runtime validation

### Null Safety
Use optional chaining (`?.`), nullish coalescing (`??`), explicit `=== null || === undefined` checks. Avoid implicit falsy checks.

## File Organization

### Directory Structure
```
src/
├── cli/          # CLI infrastructure
├── commands/     # Commands (init, new, skills, etc) + phase handlers
├── domains/      # Business logic by domain (facade pattern)
├── services/     # Cross-domain services
├── shared/       # Pure utilities (no domain logic)
├── types/        # Domain-specific types & Zod schemas
└── index.ts      # Entry point
```

### Modularization Standards
- **Target**: <100 LOC per submodule
- **Maximum**: 200 LOC (hard limit)
- **Facades**: 50-150 LOC (orchestration only)
- **Split if exceeding**: Extract to smaller focused modules

### Facade Pattern
Each domain exposes facade that re-exports public API, provides backward-compatible interface, hides implementation.

### Phase Handler Pattern
Complex commands: orchestrator (~100 LOC) + phase handlers (~50-100 LOC each). Each phase handles one responsibility, independently testable.

### File Naming
- Use **kebab-case**: `file-scanner.ts`, `hash-calculator.ts`
- **Self-documenting**: Name describes purpose without reading content
- **LLM-friendly**: Grep/Glob tools understand filename purpose
- **Test structure**: Mirrors source (`src/domains/config/settings-merger.ts` → `tests/domains/config/settings-merger.test.ts`)

### Module Organization
```typescript
// 1. Node.js built-in imports
import { resolve } from "node:path";

// 2. Internal imports (@/ aliases, sorted)
import { AuthManager } from "@/domains/github/github-auth.js";
import { logger } from "@/shared/logger.js";

// 3. External dependencies (sorted)
import { Octokit } from "@octokit/rest";

// 4. Constants, types, implementation
```

### Path Aliases
Use `@/` for all internal imports (defined in tsconfig.json):
- `@/*` → `src/*`
- `@/domains/*` → `src/domains/*`
- `@/shared/*` → `src/shared/*`
- `@/types` → `src/types`

Always include `.js` extension for ESM compatibility.

## Naming Conventions

### Variables & Functions
- **camelCase**: `targetDirectory`, `downloadFile()`
- **Descriptive**: `customClaudeFiles` not `cf`, `tmpDir` not `t`

### Classes & Types
- **PascalCase**: `AuthManager`, `DownloadProgress`, `ArchiveType`

### Constants
- **UPPER_SNAKE_CASE**: `MAX_EXTRACTION_SIZE`, `SERVICE_NAME`
- **Readonly arrays**: `as const` for immutability

### Booleans
- **Prefix with is/has/should**: `isNonInteractive`, `hasAccess`, `shouldExclude`

## Function Standards

### Size & Design
- **Target**: <50 LOC per function
- **Maximum**: <100 LOC per function
- **Single Responsibility Principle**: One clear purpose
- **Early returns**: Reduce nesting

### Parameter Handling
- Use **options object** for >3 parameters
- Destructure at function start: `const { url, name, destDir } = options;`

### Error Handling
- Explicit error types with messages
- Validate inputs early (fail fast)
- Try-catch for async/fallible operations
- Use `finally` for cleanup
- **Never swallow errors silently**

### Process Locks
**Critical**: Inside `withProcessLock()`, throw errors instead of `process.exit(1)`. Exit handler will perform graceful cleanup.

```typescript
await withProcessLock("lock-name", async () => {
  if (error) throw new Error("User message"); // ✅ Throw, not process.exit()
});
```

## Class Standards

### Structure
1. Static constants
2. Instance properties
3. Constructor
4. Public methods
5. Private methods

### Access Modifiers
- **private**: Internal implementation details
- **public**: Public API
- **static**: Utilities with no instance state

## Error Handling

### Custom Error Classes
```typescript
export class ClaudeKitError extends Error {
  constructor(message: string, public code?: string, public statusCode?: number) {
    super(message);
    this.name = "ClaudeKitError";
  }
}

export class AuthenticationError extends ClaudeKitError {
  constructor(message: string) {
    super(message, "AUTH_ERROR", 401);
  }
}
```

### Error Handling Patterns
- Try-catch with specific error handling (check error.status, error.code)
- Cleanup in `finally` blocks
- Always provide context in error messages

## Async/Await Standards

### Promise Handling
- Always `await` promises
- Use `Promise.all()` for parallel operations
- Never fire-and-forget promises

### Async Function Design
- Top-level async for commands
- Return promises explicitly when needed
- Avoid nested callbacks

## Validation & Schemas

### Zod Schema Usage
```typescript
export const NewCommandOptionsSchema = z.object({
  dir: z.string().default("."),
  kit: KitType.optional(),
  force: z.boolean().default(false),
});

export type NewCommandOptions = z.infer<typeof NewCommandOptionsSchema>;
```

### Input Validation
- Define schemas for all external inputs
- Validate at boundaries (commands, API)
- Use `refine()` for custom validation rules

## Security Standards

### Token Handling
- **Never log tokens directly**: `logger.debug("Token method:", method);` ✅
- **Sanitize in logger**: Replace patterns like `ghp_[...]/g` with `ghp_***`
- Keychain integration for secure storage
- Format validation: `ghp_*`, `github_pat_*`

### Path Validation
- Resolve to canonical paths
- Reject relative paths with ".."
- Verify target within base: `!relativePath.startsWith("..")`

### Protected Files
Always skip: `.env`, `.env.local`, `*.key`, `*.pem`, `node_modules/`, `.git/`, `dist/`, `build/`, `.gitignore`, `CLAUDE.md`, `.mcp.json`

## Testing

### Test Coverage
- Unit tests for all core libraries
- Command integration tests
- Authentication/download/extraction tests
- Skills migration tests
- Doctor command tests

### Test Structure
- Mirrors source structure
- Uses Bun test runner
- Temporary directories for filesystem isolation
- No fake data or mocks (real implementations)

## Quality Checks

**Before every commit, run:**
```bash
bun run typecheck && bun run lint:fix && bun test && bun run build
```

All must pass. No exceptions.

## Recent Standards Updates

- **#346 Process-lock safety**: Throw errors instead of `process.exit(1)` inside `withProcessLock()`
- **#344 Installation detection**: Fallback support for installs without metadata.json
- **Skills rename**: Command renamed from `skill` to `skills`
- **Deletion handling**: Glob pattern support via picomatch, cross-platform path.sep
