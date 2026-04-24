import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureCodexHooksFeatureFlag } from "../codex-features-flag.js";

const testDir = join(tmpdir(), "ck-codex-features-flag-test");

beforeAll(() => {
	mkdirSync(testDir, { recursive: true });
});

afterAll(() => {
	rmSync(testDir, { recursive: true, force: true });
});

describe("ensureCodexHooksFeatureFlag", () => {
	it("writes managed block to a new (non-existent) config.toml", async () => {
		const configPath = join(testDir, "fresh-config.toml");
		const result = await ensureCodexHooksFeatureFlag(configPath);

		expect(result.status).toBe("written");
		expect(existsSync(configPath)).toBe(true);

		const content = readFileSync(configPath, "utf8");
		expect(content).toContain("[features]");
		expect(content).toContain("codex_hooks = true");
		expect(content).toContain("# --- ck-managed-features-start ---");
		expect(content).toContain("# --- ck-managed-features-end ---");
	});

	it("returns already-set when invoked a second time on an empty file (managed block present)", async () => {
		const configPath = join(testDir, "idempotent-config.toml");
		// First write
		const first = await ensureCodexHooksFeatureFlag(configPath);
		expect(first.status).toBe("written");

		// Second write — should detect managed block and update (not duplicate)
		const second = await ensureCodexHooksFeatureFlag(configPath);
		expect(second.status).toBe("updated");

		const content = readFileSync(configPath, "utf8");
		// Must not have duplicate blocks
		const occurrences = (content.match(/ck-managed-features-start/g) || []).length;
		expect(occurrences).toBe(1);
	});

	it("returns already-set when codex_hooks = true already set outside managed block", async () => {
		const configPath = join(testDir, "manual-config.toml");
		writeFileSync(
			configPath,
			`[model]
name = "o4-mini"

[features]
codex_hooks = true
`,
		);

		const result = await ensureCodexHooksFeatureFlag(configPath);
		expect(result.status).toBe("already-set");

		// File should be unchanged
		const content = readFileSync(configPath, "utf8");
		expect(content).not.toContain("ck-managed-features-start");
	});

	it("appends managed block without disturbing existing unrelated content", async () => {
		const configPath = join(testDir, "existing-config.toml");
		const existingContent = `[model]
name = "o4-mini"
context_length = 128000

[shell]
timeout = 120
`;
		writeFileSync(configPath, existingContent);

		const result = await ensureCodexHooksFeatureFlag(configPath);
		expect(result.status).toBe("written");

		const content = readFileSync(configPath, "utf8");
		// Existing content preserved
		expect(content).toContain("[model]");
		expect(content).toContain('name = "o4-mini"');
		// Feature flag added
		expect(content).toContain("codex_hooks = true");
	});

	it("creates parent directory if it does not exist", async () => {
		const nestedDir = join(testDir, "nested", "dir");
		const configPath = join(nestedDir, "config.toml");

		const result = await ensureCodexHooksFeatureFlag(configPath);
		expect(result.status).toBe("written");
		expect(existsSync(configPath)).toBe(true);
	});

	/**
	 * H2 regression test — project-scoped config inside a ~/projects/ path must succeed.
	 *
	 * Before the fix, `ensureCodexHooksFeatureFlag` used `includes(homedir())` to decide
	 * the boundary, which misclassified ~/projects/myapp/.codex/config.toml as "global"
	 * and then `isCanonicalPathWithinBoundary` would return false (path not under ~/.codex/),
	 * causing a silent "failed" result.
	 */
	it("H2 — project config under home dir succeeds with isGlobal=false", async () => {
		// Simulate a project directory that lives inside the user's home dir
		const projectDir = join(testDir, "projects", "myapp", ".codex");
		mkdirSync(projectDir, { recursive: true });
		const configPath = join(projectDir, "config.toml");

		// Pass isGlobal=false explicitly (project-scoped)
		const result = await ensureCodexHooksFeatureFlag(configPath, false);
		expect(result.status).toBe("written");
		expect(existsSync(configPath)).toBe(true);

		const content = readFileSync(configPath, "utf8");
		expect(content).toContain("codex_hooks = true");
	});

	it("replaces managed block in-place when it already exists (idempotent update)", async () => {
		const configPath = join(testDir, "replace-config.toml");
		// Write an older managed block with slightly different content
		writeFileSync(
			configPath,
			`[model]
name = "o4-mini"

# --- ck-managed-features-start ---
[features]
codex_hooks = false
# --- ck-managed-features-end ---

[shell]
timeout = 120
`,
		);

		const result = await ensureCodexHooksFeatureFlag(configPath);
		expect(result.status).toBe("updated");

		const content = readFileSync(configPath, "utf8");
		// Updated to true
		expect(content).toContain("codex_hooks = true");
		// Surrounding content preserved
		expect(content).toContain("[model]");
		expect(content).toContain("[shell]");
		// No duplicates
		const starts = (content.match(/ck-managed-features-start/g) || []).length;
		expect(starts).toBe(1);
	});
});
