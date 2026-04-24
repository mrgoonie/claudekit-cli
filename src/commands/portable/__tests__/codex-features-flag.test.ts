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

	it("returns updated when invoked a second time on a file containing only a managed block", async () => {
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

	/**
	 * Regression: bug where a user's existing `[features]` section caused a
	 * second `[features]` header to be appended via the managed block, producing
	 * TOML duplicate-key errors on next Codex load.
	 */
	it("merges codex_hooks into user's existing [features] section (no duplicate header)", async () => {
		const configPath = join(testDir, "user-features-merge.toml");
		writeFileSync(
			configPath,
			`[model_providers.cliproxy]
name = "cliproxy"

[features]
unified_exec = true
shell_snapshot = true
multi_agent = true

[notice]
hide_full_access_warning = true
`,
		);

		const result = await ensureCodexHooksFeatureFlag(configPath);
		expect(result.status).toBe("updated");

		const content = readFileSync(configPath, "utf8");
		// Exactly ONE [features] header in the file
		const featuresHeaderCount = (content.match(/^\[features\]\s*$/gm) || []).length;
		expect(featuresHeaderCount).toBe(1);
		// Flag merged into user's section
		expect(content).toContain("codex_hooks = true");
		// Pre-existing user flags preserved
		expect(content).toContain("unified_exec = true");
		expect(content).toContain("shell_snapshot = true");
		expect(content).toContain("multi_agent = true");
		// Surrounding sections preserved
		expect(content).toContain("[model_providers.cliproxy]");
		expect(content).toContain("[notice]");
		// No managed block should be written since we merged into the user's section
		expect(content).not.toContain("ck-managed-features-start");
		// Insertion position: codex_hooks goes at the END of the user's section,
		// not the top — preserves the user's flag ordering.
		const featuresBlock = content.match(/\[features\][\s\S]*?(?=\n\[|$)/)?.[0] ?? "";
		const lines = featuresBlock.split("\n").filter((l) => l.trim().length > 0);
		expect(lines[lines.length - 1]).toBe("codex_hooks = true");
	});

	/**
	 * Self-heal test: user already suffers the bug (two `[features]` sections,
	 * one user-owned and one managed). Next CLI run must strip the duplicate
	 * managed block and fold the flag into the user's section.
	 */
	it("self-heals a broken config with duplicate [features] (user + managed)", async () => {
		const configPath = join(testDir, "duplicate-features-heal.toml");
		writeFileSync(
			configPath,
			`[model_providers.cliproxy]
name = "cliproxy"

[features]
unified_exec = true
multi_agent = true

[notice]
hide_full_access_warning = true

# --- ck-managed-features-start ---
[features]
codex_hooks = true
# --- ck-managed-features-end ---
`,
		);

		const result = await ensureCodexHooksFeatureFlag(configPath);
		expect(result.status).toBe("updated");

		const content = readFileSync(configPath, "utf8");
		// Exactly ONE [features] header — no duplicate TOML table
		const featuresHeaderCount = (content.match(/^\[features\]\s*$/gm) || []).length;
		expect(featuresHeaderCount).toBe(1);
		// Managed block removed
		expect(content).not.toContain("ck-managed-features-start");
		expect(content).not.toContain("ck-managed-features-end");
		// codex_hooks now lives in user section
		expect(content).toContain("codex_hooks = true");
		// User flags preserved
		expect(content).toContain("unified_exec = true");
		expect(content).toContain("multi_agent = true");
		// Surrounding sections preserved
		expect(content).toContain("[notice]");
	});

	it("updates codex_hooks = false to true inside user's [features] section", async () => {
		const configPath = join(testDir, "user-features-false.toml");
		writeFileSync(
			configPath,
			`[features]
unified_exec = true
codex_hooks = false
multi_agent = true
`,
		);

		const result = await ensureCodexHooksFeatureFlag(configPath);
		expect(result.status).toBe("updated");

		const content = readFileSync(configPath, "utf8");
		expect(content).toContain("codex_hooks = true");
		expect(content).not.toContain("codex_hooks = false");
		// Only one [features] header, other flags preserved
		const featuresHeaderCount = (content.match(/^\[features\]\s*$/gm) || []).length;
		expect(featuresHeaderCount).toBe(1);
		expect(content).toContain("unified_exec = true");
		expect(content).toContain("multi_agent = true");
	});

	it("returns already-set when user's [features] already has codex_hooks = true among other flags", async () => {
		const configPath = join(testDir, "user-features-already.toml");
		const original = `[features]
unified_exec = true
codex_hooks = true
multi_agent = true
`;
		writeFileSync(configPath, original);

		const result = await ensureCodexHooksFeatureFlag(configPath);
		expect(result.status).toBe("already-set");

		const content = readFileSync(configPath, "utf8");
		expect(content).toBe(original);
	});

	/**
	 * Edge case: `[features.sub]` sub-table is present but no plain `[features]`.
	 * The managed block should be appended (creates the supertable) — and only
	 * one `[features]` header exists after write.
	 */
	it("treats [features.sub] as not being a plain [features] section", async () => {
		const configPath = join(testDir, "features-subtable.toml");
		writeFileSync(
			configPath,
			`[model]
name = "o4-mini"

[features.sub]
nested_flag = true
`,
		);

		const result = await ensureCodexHooksFeatureFlag(configPath);
		expect(result.status).toBe("written");

		const content = readFileSync(configPath, "utf8");
		expect(content).toContain("codex_hooks = true");
		// Sub-table preserved
		expect(content).toContain("[features.sub]");
		expect(content).toContain("nested_flag = true");
		// Exactly ONE plain [features] header
		const plainFeatures = (content.match(/^\[features\]\s*$/gm) || []).length;
		expect(plainFeatures).toBe(1);
	});

	it("cleans up multiple accidental managed blocks from older buggy writes", async () => {
		const configPath = join(testDir, "multi-managed-heal.toml");
		writeFileSync(
			configPath,
			`[model]
name = "o4-mini"

# --- ck-managed-features-start ---
[features]
codex_hooks = true
# --- ck-managed-features-end ---

[shell]
timeout = 120

# --- ck-managed-features-start ---
[features]
codex_hooks = true
# --- ck-managed-features-end ---
`,
		);

		const result = await ensureCodexHooksFeatureFlag(configPath);
		expect(result.status).toBe("updated");

		const content = readFileSync(configPath, "utf8");
		// Exactly one managed block and one [features] header after healing
		const managedStarts = (content.match(/ck-managed-features-start/g) || []).length;
		expect(managedStarts).toBe(1);
		const featuresHeaders = (content.match(/^\[features\]\s*$/gm) || []).length;
		expect(featuresHeaders).toBe(1);
		expect(content).toContain("[model]");
		expect(content).toContain("[shell]");
	});

	it("strips and re-appends managed block when only managed block exists (idempotent update)", async () => {
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
