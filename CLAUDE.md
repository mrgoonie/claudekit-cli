# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**ClaudeKit CLI** (`ck`) is a command-line tool for bootstrapping and updating projects from private GitHub repository releases. Built with Bun and TypeScript, it provides fast, secure, and user-friendly project setup and maintenance.

**Key Features:**
- Multi-tier GitHub authentication (gh CLI → env vars → keychain → prompt)
- Streaming downloads with progress tracking
- Smart file merging with conflict detection
- Secure credential storage using OS keychain
- Beautiful CLI interface with interactive prompts

**Status:** Production Ready (v0.1.0)
- ✅ 93 tests passing (100% pass rate)
- ✅ Type checking clean (0 errors)
- ✅ Security audit passed (5/5 stars)
- ✅ Code review approved (5/5 stars)

---

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
- **`ck --version`**: Show version
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

---

## Development Commands

```bash
# Setup
bun install                     # Install dependencies

# Development
bun run dev new --kit engineer # Run in development
bun run dev update             # Test update command

# Testing
bun test                        # Run all tests (93 tests)
bun test --watch               # Watch mode
bun test path/to/test.ts       # Run specific test

# Code Quality
bun run typecheck              # Type check (must pass)
bun run lint                    # Lint code
bun run format                  # Format code

# Build
bun run build                   # Build for npm
bun run compile                 # Build standalone binary

# Local Testing
bun link                        # Link globally
ck new --kit engineer          # Test command
bun unlink                      # Unlink when done
```

---

## Architecture Guidelines

### Core Principles

**YAGNI (You Aren't Gonna Need It)**
- Only implement what's needed now
- No speculative features
- Simple, focused solutions

**KISS (Keep It Simple, Stupid)**
- Straightforward logic
- No over-engineering
- Readable code

**DRY (Don't Repeat Yourself)**
- Reusable components
- Extract common patterns
- Centralized logic

### File Organization

**File Size Limit:** 500 lines maximum (recommended: < 200 lines)

**Module Structure:**
- One responsibility per file
- Clear separation of concerns
- Utilities in `utils/`
- Libraries in `lib/`
- Commands in `commands/`

### TypeScript Standards

**Strict Mode Required:**
```typescript
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    // ... all strict options enabled
  }
}
```

**Use Zod for Validation:**
```typescript
import { z } from 'zod';

// Define schema
const OptionsSchema = z.object({
  dir: z.string().default('.'),
  kit: z.enum(['engineer', 'marketing']).optional(),
});

// Infer TypeScript type
type Options = z.infer<typeof OptionsSchema>;

// Validate at runtime
const options = OptionsSchema.parse(rawInput);
```

**Avoid `any` Type:**
- Only use when absolutely necessary
- Document why `any` is needed
- Prefer `unknown` with type guards

---

## Security Standards

### Token Security

**NEVER log tokens:**
```typescript
// ❌ NEVER do this
logger.debug(`Token: ${token}`);

// ✅ Always sanitize
logger.debug(`Using token: ***`);
```

**Token Sanitization:**
```typescript
const sanitize = (text: string): string => {
  return text
    .replace(/ghp_[a-zA-Z0-9]{36}/g, 'ghp_***')
    .replace(/github_pat_[a-zA-Z0-9_]{82}/g, 'github_pat_***')
    .replace(/gho_[a-zA-Z0-9]{36}/g, 'gho_***')
    // ... more patterns
};
```

**Secure Storage:**
```typescript
import keytar from 'keytar';

// Store in OS keychain
await keytar.setPassword('claudekit-cli', 'github-token', token);

// Retrieve from keychain
const token = await keytar.getPassword('claudekit-cli', 'github-token');
```

### Input Validation

**Always validate external input:**
```typescript
// Command options
const options = NewCommandOptionsSchema.parse(rawOptions);

// API responses
const release = GitHubReleaseSchema.parse(apiResponse);

// User input
const directory = z.string().min(1).parse(userInput);
```

### Path Security

**Prevent path traversal:**
```typescript
function isSafePath(basePath: string, targetPath: string): boolean {
  const resolvedBase = path.resolve(basePath);
  const resolvedTarget = path.resolve(targetPath);
  return resolvedTarget.startsWith(resolvedBase);
}
```

---

## Error Handling

### Custom Error Classes

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

export class AuthenticationError extends ClaudeKitError { ... }
export class GitHubError extends ClaudeKitError { ... }
export class DownloadError extends ClaudeKitError { ... }
export class ExtractionError extends ClaudeKitError { ... }
```

### Error Handling Pattern

```typescript
async function operation() {
  const tempDir = await createTempDir();

  try {
    // Operation
    const result = await doWork(tempDir);
    return result;
  } catch (error) {
    logger.error('Operation failed', error);
    throw new OperationError('Descriptive message', error);
  } finally {
    // Always cleanup
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
```

### User-Friendly Errors

**Structure:**
1. What went wrong
2. Why it happened
3. How to fix it

```typescript
throw new AuthenticationError(
  'GitHub token is invalid or expired.\n' +
  'Please check your token and try again.\n' +
  'Create a new token at: https://github.com/settings/tokens'
);
```

---

## Testing Standards

### Test Structure

```typescript
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';

describe('ModuleName', () => {
  beforeEach(async () => {
    // Setup
  });

  afterEach(async () => {
    // Cleanup
  });

  test('should do something correctly', async () => {
    // Arrange
    const input = 'test';

    // Act
    const result = await operation(input);

    // Assert
    expect(result).toBe('expected');
  });
});
```

### Test Coverage Requirements

**Minimum:** 80%
**Target:** 90%+

**What to test:**
- ✅ All public methods
- ✅ Error scenarios
- ✅ Edge cases
- ✅ Type validation
- ✅ Security features

**What NOT to test:**
- ❌ External libraries
- ❌ Trivial getters/setters
- ❌ Type definitions only

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
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code refactoring
- `test`: Tests
- `chore`: Maintenance

**Examples:**
```
feat(auth): add GitHub CLI token detection

Implement automatic token detection from gh CLI.
Falls back to environment variables if unavailable.

Closes #123
```

```
fix(download): handle network timeouts gracefully

Add AbortSignal timeout to prevent hanging.
Show clear error message when timeout occurs.
```

### Branch Naming

**Format:** `<type>/<short-description>`

**Examples:**
- `feat/github-cli-auth`
- `fix/download-timeout`
- `docs/update-readme`
- `refactor/split-auth-providers`

---

## Code Review Checklist

### Before Committing

- [ ] All tests pass (`bun test`)
- [ ] Type checking passes (`bun run typecheck`)
- [ ] Linting passes (`bun run lint`)
- [ ] No console.log statements
- [ ] No commented-out code
- [ ] No TODOs in production code

### Functionality

- [ ] Code implements requirements correctly
- [ ] Edge cases handled
- [ ] Error scenarios covered
- [ ] No regressions

### Code Quality

- [ ] Follows YAGNI, KISS, DRY
- [ ] Clean, readable code
- [ ] No code duplication
- [ ] Consistent naming
- [ ] Files under 500 lines

### Security

- [ ] No token exposure
- [ ] Input validation present
- [ ] Path validation for file ops
- [ ] No hardcoded secrets

### Documentation

- [ ] JSDoc for public APIs
- [ ] Inline comments for complex logic
- [ ] README updated if needed
- [ ] Tests added/updated

---

## Common Tasks

### Adding a New Feature

1. **Plan:** Create implementation plan
2. **Research:** Document findings
3. **Implement:** Write code following standards
4. **Test:** Add comprehensive tests
5. **Review:** Run checklist
6. **Document:** Update docs
7. **Commit:** Use conventional format

### Fixing a Bug

1. **Reproduce:** Write failing test
2. **Diagnose:** Identify root cause
3. **Fix:** Implement solution
4. **Test:** Verify fix with tests
5. **Verify:** Run full test suite
6. **Document:** Update changelog

### Refactoring Code

1. **Tests First:** Ensure tests exist
2. **Refactor:** Make changes
3. **Test:** Verify tests still pass
4. **Review:** Check for improvements
5. **Document:** Update if needed

---

## Important Files

### Configuration

- **`package.json`**: Package manifest, scripts, dependencies
- **`tsconfig.json`**: TypeScript configuration (strict mode)
- **`biome.json`**: Linter and formatter configuration

### Documentation

- **`README.md`**: User documentation (installation, usage)
- **`docs/project-pdr.md`**: Product requirements
- **`docs/code-standards.md`**: Coding standards and best practices
- **`docs/system-architecture.md`**: Architecture with diagrams
- **`docs/codebase-summary.md`**: Codebase overview and structure
- **`docs/tech-stack.md`**: Technology stack details

### Implementation

- **`plans/251008-claudekit-cli-implementation-plan.md`**: Implementation plan
- **`plans/reports/251008-from-tester-to-developer-test-summary-report.md`**: Test report
- **`plans/reports/251008-from-code-reviewer-to-developer-review-report.md`**: Code review

---

## Key Dependencies

### Production

- **`cac`**: Command-line argument parsing
- **`@clack/prompts`**: Interactive prompts
- **`@octokit/rest`**: GitHub REST API
- **`zod`**: Runtime validation
- **`keytar`**: Secure credential storage
- **`ora`**: Spinners
- **`cli-progress`**: Progress bars
- **`picocolors`**: Terminal colors
- **`fs-extra`**: File operations
- **`tar`**: TAR extraction
- **`unzipper`**: ZIP extraction
- **`ignore`**: Pattern matching

### Development

- **`typescript`**: TypeScript compiler
- **`@biomejs/biome`**: Linter and formatter
- **`@types/*`**: Type definitions

---

## Best Practices Summary

### DO ✅

- Use TypeScript strict mode
- Validate all external input with Zod
- Write comprehensive tests (≥80% coverage)
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

## Troubleshooting

### Common Issues

**Issue: Tests failing**
- Run `bun test` to see which tests fail
- Check test output for error messages
- Verify all dependencies installed
- Ensure Bun version ≥ 1.0.0

**Issue: Type errors**
- Run `bun run typecheck` to see errors
- Check `tsconfig.json` is configured correctly
- Verify all type dependencies installed

**Issue: Linting errors**
- Run `bun run lint` to see issues
- Run `bun run format` to auto-fix
- Check `biome.json` configuration

**Issue: Authentication not working**
- Check GitHub token is valid
- Verify token has correct permissions (repo scope)
- Try `gh auth token` to test GitHub CLI
- Check `~/.claudekit/config.json` for stored token

---

## Quick Reference

### File Locations

- **Source:** `src/`
- **Tests:** `tests/`
- **Docs:** `docs/`
- **Build:** `dist/` (gitignored)
- **Binary:** `bin/` (gitignored)
- **User Config:** `~/.claudekit/config.json`

### Environment Variables

```bash
GITHUB_TOKEN=ghp_xxx           # GitHub PAT
GH_TOKEN=ghp_xxx               # Alternative
DEBUG=1                         # Enable debug logging
```

### Useful Commands

```bash
# Quick start
bun install && bun link
ck new --kit engineer

# Run tests
bun test

# Type check
bun run typecheck

# Build
bun run build
bun run compile
```

---

## Additional Resources

- **Implementation Plan:** `./plans/251008-claudekit-cli-implementation-plan.md`
- **Test Report:** `./plans/reports/251008-from-tester-to-developer-test-summary-report.md`
- **Code Review:** `./plans/reports/251008-from-code-reviewer-to-developer-review-report.md`
- **Tech Stack:** `./docs/tech-stack.md`
- **Architecture:** `./docs/system-architecture.md`
- **Code Standards:** `./docs/code-standards.md`
- **Codebase Summary:** `./docs/codebase-summary.md`
- **Product Requirements:** `./docs/project-pdr.md`

---

## Contact & Support

- **Repository:** https://github.com/mrgoonie/claudekit-cli
- **Issues:** https://github.com/mrgoonie/claudekit-cli/issues
- **Documentation:** See `./docs/` directory

---

**Document Version:** 2.0
**Last Updated:** 2025-10-08
**Project Status:** Production Ready (v0.1.0)
**Code Quality:** 5/5 stars
**Test Coverage:** 93 tests passing (100% pass rate)
