# Test Writing Style Guide for ClaudeKit CLI

## Overview
This guide documents the established patterns and conventions for writing tests in the ClaudeKit CLI codebase. Following these patterns ensures consistency and maintainability across the test suite.

## Testing Framework
- **Framework**: Bun test (`bun:test`)
- **Assertions**: Built-in `expect` from Bun
- **Mocking**: Built-in `mock` and `spyOn` from Bun

## File Organization

### Test File Naming
- Test files should be named after the module they test with `.test.ts` suffix
- Location: `tests/` directory mirroring the `src/` structure
  - Example: `src/lib/health-checks/check-runner.ts` → `tests/lib/health-checks/check-runner.test.ts`

### Test Directory Structure
```
tests/
├── lib/                 # Tests for src/lib/
├── utils/               # Tests for src/utils/
├── commands/            # Tests for src/commands/
├── helpers/             # Test utilities and helpers
└── integration/         # Integration tests
```

## Test Structure

### Basic Test Template
```typescript
import { describe, expect, test, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { ModuleUnderTest } from "../../path/to/module.js";

describe("ModuleName", () => {
	// Setup/teardown if needed
	beforeEach(() => {
		// Setup code
	});

	afterEach(() => {
		// Cleanup code
	});

	describe("methodName", () => {
		test("should do something specific", () => {
			// Test implementation
		});
	});
});
```

### Import Patterns
1. Always import from `bun:test` first
2. Use `.js` extension for all imports (even for TypeScript files)
3. Group imports: framework, local modules, type imports

## Test Organization Patterns

### 1. Nested describe blocks for grouping
- Top-level `describe` for the module/class
- Second-level `describe` for methods/features
- Third-level `describe` for specific scenarios if needed

```typescript
describe("CheckRunner", () => {
	describe("registerChecker", () => {
		test("registers a single checker", () => {
			// Test
		});
	});
});
```

### 2. Test Naming Conventions
- Use `test` (not `it`) for consistency
- Tests should start with "should" or describe behavior
- Be descriptive about what is being tested

```typescript
✅ Good:
test("should register a single checker", () => {});
test("returns null when network errors occur", () => {});
test("handles version comparison correctly", () => {});

❌ Avoid:
test("test 1", () => {});
test("works", () => {});
test("registerChecker", () => {});
```

## Mocking Patterns

### 1. Function Mocking
```typescript
import { mock } from "bun:test";

test("should call mocked function", async () => {
	const mockRun = mock(() => Promise.resolve([]));

	const result = await someFunction(mockRun);

	expect(mockRun).toHaveBeenCalled();
});
```

### 2. Module Mocking
```typescript
// Mock at the top level for the entire test file
const mockExec = mock(() => Promise.resolve({ stdout: "v2.20.0" }));

// In tests
test("should parse version output", async () => {
	const result = await getGhVersion();
	expect(result).toBe("2.20.0");
});
```

### 3. Spying on existing methods
```typescript
import { spyOn } from "bun:test";

test("should log to console", () => {
	const consoleSpy = spyOn(console, "log").mockImplementation(() => {});

	logger.info("test");

	expect(consoleSpy).toHaveBeenCalled();
	consoleSpy.mockRestore();
});
```

### 4. Environment Variable Handling
```typescript
describe("environment tests", () => {
	const originalEnv = process.env.TEST_VAR;

	beforeEach(() => {
		// Reset to original state
		if (originalEnv !== undefined) {
			process.env.TEST_VAR = originalEnv;
		} else {
			delete process.env.TEST_VAR;
		}
	});

	afterEach(() => {
		// Clean up
		if (originalEnv !== undefined) {
			process.env.TEST_VAR = originalEnv;
		} else {
			delete process.env.TEST_VAR;
		}
	});
});
```

## Async Testing Patterns

### 1. Promise-based tests
```typescript
test("should handle async operations", async () => {
	const result = await asyncFunction();
	expect(result).toBe(expected);
});
```

### 2. Testing error scenarios
```typescript
test("should throw on invalid input", async () => {
	await expect(asyncFunction(invalidInput)).rejects.toThrow("Error message");
});
```

### 3. Testing timeouts and race conditions
```typescript
test("should execute in parallel", async () => {
	const executionOrder: string[] = [];

	await Promise.all([
		firstFunction().then(() => executionOrder.push("first")),
		secondFunction().then(() => executionOrder.push("second"))
	]);

	// Assert execution pattern
});
```

## Test Data Patterns

### 1. Test-specific constants
```typescript
describe("version comparison", () => {
	const MIN_VERSION = "2.20.0";

	test("should detect older versions", () => {
		expect(compareVersions("2.4.0", MIN_VERSION)).toBe(-1);
	});
});
```

### 2. Inline test data for small sets
```typescript
test("should handle edge cases", () => {
	const edgeCases = [
		{ input: "", expected: false },
		{ input: "v", expected: false },
		{ input: "v1.0.0", expected: true }
	];

	edgeCases.forEach(({ input, expected }) => {
		expect(validateVersion(input)).toBe(expected);
	});
});
```

### 3. Test fixtures for larger data
```typescript
// Can be defined outside tests for reuse
const MOCK_METADATA = {
	version: "1.0.0",
	files: [/* ... */]
} as Metadata;
```

## File System Testing

### 1. Using temp directories
```typescript
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("file operations", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = join(tmpdir(), `ck-test-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});
});
```

### 2. Using test helpers
```typescript
import { setupTestPaths } from "../helpers/test-paths.js";

describe("with test paths", () => {
	const testPaths = setupTestPaths();

	afterEach(() => {
		testPaths.cleanup();
	});
});
```

## Network-Dependent Tests

### 1. Skipping network tests in CI
```typescript
describe.skip("Network dependent tests", () => {
	test("should make real API call", async () => {
		// Test that requires network
	});
});
```

### 2. Mocking network calls
```typescript
test("should handle network response", async () => {
	global.fetch = mock(() =>
		Promise.resolve({
			ok: true,
			json: () => Promise.resolve({ data: "mock" })
		})
	);

	const result = await fetchData();
	expect(result).toEqual({ data: "mock" });
});
```

## Security Testing Patterns

### 1. Input validation
```typescript
describe("security", () => {
	test("should reject malicious input", async () => {
		const maliciousInputs = [
			"package; rm -rf /",
			"package && echo hacked",
			"$(whoami)/package"
		];

		for (const input of maliciousInputs) {
			await expect(processInput(input)).rejects.toThrow();
		}
	});
});
```

### 2. Token sanitization
```typescript
test("should sanitize tokens in logs", () => {
	const textWithToken = "Token: ghp_123456789012345678901234567890123456";
	const sanitized = logger.sanitize(textWithToken);
	expect(sanitized).toBe("Token: ghp_***");
});
```

## Error Handling in Tests

### 1. Testing expected failures
```typescript
test("should fail gracefully", async () => {
	// Test that function doesn't throw but returns error indicator
	const result = await mightFail();
	expect(result.success).toBe(false);
	expect(result.error).toBeDefined();
});
```

### 2. Testing silent failures
```typescript
test("should handle errors without crashing", async () => {
	// Some functions should return null or default on error
	const result = await silentFailure();
	expect(result === null || typeof result === "object").toBe(true);
});
```

## Performance Testing Patterns

### 1. Simple timing tests
```typescript
test("should complete within time limit", async () => {
	const start = Date.now();
	await performOperation();
	const duration = Date.now() - start;
	expect(duration).toBeLessThan(1000); // 1 second
});
```

### 2. Testing parallel execution
```typescript
test("should execute operations in parallel", async () => {
	const startTime = Date.now();

	await Promise.all([
		operation1(), // 100ms
		operation2()  // 100ms
	]);

	const totalTime = Date.now() - startTime;
	// Should be closer to 100ms than 200ms if parallel
	expect(totalTime).toBeLessThan(150);
});
```

## Best Practices

### 1. Keep tests focused
- Each test should verify one behavior
- Use descriptive test names
- Avoid testing multiple unrelated things in one test

### 2. Test setup and teardown
- Use `beforeEach`/`afterEach` for consistent state
- Always clean up resources (temp files, spies, mocks)
- Store original values before modifying globals

### 3. Avoid test pollution
- Don't rely on test order
- Clean up mutations between tests
- Use fresh instances for each test when needed

### 4. Good assertion patterns
```typescript
✅ Good:
expect(result.status).toBe("success");
expect(result.data).toEqual(expectedData);
expect(mockFn).toHaveBeenCalledTimes(1);
expect(mockFn).toHaveBeenCalledWith(expectedArg);

❌ Avoid:
expect(result).toBeTruthy(); // Too generic
expect(JSON.stringify(result)).toBe(JSON.stringify(expected)); // brittle
```

### 5. Testing private methods
- Access via type assertion when necessary: `(module as any).privateMethod`
- Prefer testing public interface when possible
- Document why testing private method is necessary

## Common Pitfalls to Avoid

1. **Don't mock what you don't own** - Avoid mocking built-ins unless necessary
2. **Don't test implementation details** - Test behavior, not how it's implemented
3. **Don't ignore async** - Always await promises and handle rejections
4. **Don't leave cleanup out** - Always restore mocks and clean up resources
5. **Don't use real external services** - Mock all network calls and external dependencies

## Examples from the Codebase

### Example 1: Simple Unit Test
```typescript
test("normalizes version tags", () => {
	expect(normalizeVersion("v1.0.0")).toBe("1.0.0");
	expect(normalizeVersion("1.0.0")).toBe("1.0.0");
});
```

### Example 2: Complex Mocking
```typescript
test("returns update available when newer version exists", async () => {
	global.fetch = mock(() =>
		Promise.resolve({
			ok: true,
			json: () => Promise.resolve({
				name: "claudekit-cli",
				"dist-tags": { latest: "2.0.0" }
			})
		})
	);

	const result = await CliVersionChecker.check("1.0.0");
	expect(result?.updateAvailable).toBe(true);
});
```

### Example 3: File System Testing
```typescript
test("calculates SHA-256 correctly", async () => {
	const testFile = join(tempDir, "test.txt");
	await writeFile(testFile, "hello world");

	const checksum = await calculateChecksum(testFile);
	expect(checksum).toBe(
		"b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"
	);
});
```

This style guide should help maintain consistency and quality in the test suite. When in doubt, look at existing tests in the codebase for patterns to follow.