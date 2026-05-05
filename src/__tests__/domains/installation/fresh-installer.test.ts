/**
 * Tests for fresh-installer.ts — the metadata.json self-tracking bug (#777)
 *
 * Fixtures:
 *   A. metadata.json self-tracked in kits.*.files[] → must NOT throw
 *   B. metadata.json missing mid-cleanup (race) → must NOT throw
 *   C. Happy path — metadata.json not self-tracked
 *   D. Mixed ownership — ck, ck-modified, user; metadata.json self-tracked
 *   E. Legacy format (no kits) — metadata.json self-tracked
 *
 * NOTE: mock.module calls must appear before the static import of the module
 * under test. Bun hoists static `import` declarations but not mock.module —
 * the server.test.ts pattern places mock.module calls first and the
 * `import { ... }` after them (at the bottom of the preamble section).
 */

import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type TestPaths, setupTestPaths } from "../../../../tests/helpers/test-paths.js";

// ─── Module mocks — must be resolved before the SUT import below ─────────────

// NOTE: ora mock intentionally omitted — safe-spinner is mocked below, which
// covers the only transitive ora usage in this code path.

// Spinner stub — avoids TTY checks and ora transitive dep
// NOTE: backup, lock, and proper-lockfile are NOT mocked here.
// CK_TEST_HOME (set by setupTestPaths in beforeEach) isolates all file-system
// operations to a per-test tmpdir so the real implementations run safely.
mock.module("@/shared/safe-spinner.js", () => ({
	createSpinner: () => ({
		start: () => ({ succeed: () => {}, fail: () => {}, stop: () => {} }),
		succeed: () => {},
		fail: () => {},
		stop: () => {},
	}),
}));

// ─── Import SUT after mocks are registered ────────────────────────────────────

import { handleFreshInstallation } from "@/domains/installation/fresh-installer.js";
import type { PromptsManager } from "@/domains/ui/prompts.js";

// ─── Fixtures / helpers ───────────────────────────────────────────────────────

const FAKE_CHECKSUM = "a".repeat(64);
const FAKE_VERSION = "1.0.0";
const FAKE_DATE = "2024-01-01T00:00:00.000Z";

const autoConfirmPrompts = {
	promptFreshConfirmation: async () => true,
} as unknown as PromptsManager;

function makeTrackedFile(path: string, ownership: "ck" | "ck-modified" | "user" = "ck") {
	return {
		path,
		checksum: FAKE_CHECKSUM,
		ownership,
		installedVersion: FAKE_VERSION,
		installedAt: FAKE_DATE,
	};
}

function makeMultiKitMetadata(
	files: ReturnType<typeof makeTrackedFile>[],
	selfTrackMetadata = false,
) {
	const fileList = selfTrackMetadata ? [makeTrackedFile("metadata.json", "ck"), ...files] : files;
	return {
		kits: {
			engineer: { version: FAKE_VERSION, installedAt: FAKE_DATE, files: fileList },
		},
	};
}

function makeLegacyMetadata(
	files: ReturnType<typeof makeTrackedFile>[],
	selfTrackMetadata = false,
) {
	const fileList = selfTrackMetadata ? [makeTrackedFile("metadata.json", "ck"), ...files] : files;
	return {
		name: "claudekit-engineer",
		version: FAKE_VERSION,
		installedAt: FAKE_DATE,
		files: fileList,
	};
}

function writeMetadata(claudeDir: string, metadata: object) {
	writeFileSync(join(claudeDir, "metadata.json"), JSON.stringify(metadata, null, 2));
}

function writeTrackedFile(claudeDir: string, relativePath: string) {
	const fullPath = join(claudeDir, relativePath);
	const parts = relativePath.split("/");
	if (parts.length > 1) {
		mkdirSync(join(claudeDir, ...parts.slice(0, -1)), { recursive: true });
	}
	writeFileSync(fullPath, `# ${relativePath}`);
}

async function runFreshInstall(claudeDir: string): Promise<{ success: boolean; error?: string }> {
	try {
		const result = await handleFreshInstallation(claudeDir, autoConfirmPrompts);
		return { success: result };
	} catch (err) {
		return { success: false, error: err instanceof Error ? err.message : String(err) };
	}
}

// ─── Test lifecycle ───────────────────────────────────────────────────────────

// testPaths sets process.env.CK_TEST_HOME so PathResolver roots all directories
// (backups, locks, config) under an isolated tmpdir — prevents pollution of the
// real ~/.claudekit and avoids interference with other test files.
let testPaths: TestPaths;
let claudeDir: string;

beforeEach(() => {
	testPaths = setupTestPaths();
	// claudeDir lives inside testHome so backup/lock subsystems stay within CK_TEST_HOME
	claudeDir = testPaths.claudeDir;
	mkdirSync(claudeDir, { recursive: true });
});

afterEach(() => {
	testPaths.cleanup();
});

// Restore all mock.module stubs so subsequent test files in the same Bun worker
// get the real implementations (backup, lock, proper-lockfile, safe-spinner).
afterAll(() => {
	mock.restore();
});

// ─── Fixture A: metadata.json self-tracked ────────────────────────────────────

describe("Fixture A — metadata.json self-tracked in kits.engineer.files", () => {
	test("handleFreshInstallation returns true without throwing", async () => {
		writeMetadata(
			claudeDir,
			makeMultiKitMetadata(
				[makeTrackedFile("commands/test.md", "ck")],
				true, // metadata.json listed as ck-owned tracked file
			),
		);
		writeTrackedFile(claudeDir, "commands/test.md");

		const result = await runFreshInstall(claudeDir);

		expect(result.success).toBe(true);
		expect(result.error).toBeUndefined();
	});

	test("does not emit 'metadata.json is missing' error", async () => {
		writeMetadata(
			claudeDir,
			makeMultiKitMetadata([makeTrackedFile("commands/test.md", "ck")], true),
		);
		writeTrackedFile(claudeDir, "commands/test.md");

		const result = await runFreshInstall(claudeDir);

		expect(result.error ?? "").not.toContain("metadata.json is missing");
	});

	test("CK-owned tracked files are removed", async () => {
		writeMetadata(
			claudeDir,
			makeMultiKitMetadata([makeTrackedFile("commands/ck-file.md", "ck")], true),
		);
		writeTrackedFile(claudeDir, "commands/ck-file.md");

		await runFreshInstall(claudeDir);

		expect(existsSync(join(claudeDir, "commands/ck-file.md"))).toBe(false);
	});
});

// ─── Fixture B: metadata.json missing mid-cleanup (race) ─────────────────────

describe("Fixture B — metadata.json missing mid-cleanup (race condition)", () => {
	test("tolerates no metadata.json on disk (fallback path, no throw)", async () => {
		// No metadata → analyzeFreshInstallation returns hasMetadata:false
		// → fallback removeSubdirectoriesFallback is taken; must succeed
		writeTrackedFile(claudeDir, "commands/leftover.md");
		const metaPath = join(claudeDir, "metadata.json");
		if (existsSync(metaPath)) unlinkSync(metaPath);

		const result = await runFreshInstall(claudeDir);

		expect(result.success).toBe(true);
		expect(result.error ?? "").not.toContain("metadata.json is missing");
	});

	test("metadata.json deleted before run still succeeds via fallback", async () => {
		// Valid metadata written then immediately deleted — simulates worst-case race
		writeMetadata(claudeDir, makeMultiKitMetadata([makeTrackedFile("commands/a.md", "ck")]));
		writeTrackedFile(claudeDir, "commands/a.md");
		unlinkSync(join(claudeDir, "metadata.json"));

		const result = await runFreshInstall(claudeDir);

		expect(result.success).toBe(true);
		expect(result.error ?? "").not.toContain("metadata.json is missing");
	});
});

// ─── Fixture C: Happy path ────────────────────────────────────────────────────

describe("Fixture C — happy path (metadata.json NOT self-tracked)", () => {
	test("returns true and metadata.json post-run has empty kit files array", async () => {
		writeMetadata(
			claudeDir,
			makeMultiKitMetadata([
				makeTrackedFile("commands/cmd.md", "ck"),
				makeTrackedFile("rules/rule.md", "ck"),
			]),
		);
		writeTrackedFile(claudeDir, "commands/cmd.md");
		writeTrackedFile(claudeDir, "rules/rule.md");

		const result = await runFreshInstall(claudeDir);

		expect(result.success).toBe(true);
		expect(result.error).toBeUndefined();
		expect(existsSync(join(claudeDir, "metadata.json"))).toBe(true);
		const meta = JSON.parse(readFileSync(join(claudeDir, "metadata.json"), "utf-8"));
		expect(meta.kits?.engineer?.files).toEqual([]);
	});

	test("tracked CK files are removed", async () => {
		writeMetadata(claudeDir, makeMultiKitMetadata([makeTrackedFile("commands/cmd.md", "ck")]));
		writeTrackedFile(claudeDir, "commands/cmd.md");

		await runFreshInstall(claudeDir);

		expect(existsSync(join(claudeDir, "commands/cmd.md"))).toBe(false);
	});

	test("user-owned files are preserved", async () => {
		writeMetadata(
			claudeDir,
			makeMultiKitMetadata([
				makeTrackedFile("commands/ck.md", "ck"),
				makeTrackedFile("commands/user.md", "user"),
			]),
		);
		writeTrackedFile(claudeDir, "commands/ck.md");
		writeTrackedFile(claudeDir, "commands/user.md");

		await runFreshInstall(claudeDir);

		expect(existsSync(join(claudeDir, "commands/user.md"))).toBe(true);
	});
});

// ─── Fixture D: Mixed ownership, metadata.json self-tracked ──────────────────

describe("Fixture D — mixed ownership, metadata.json self-tracked", () => {
	test("ck and ck-modified removed, user preserved, no throw", async () => {
		writeMetadata(
			claudeDir,
			makeMultiKitMetadata(
				[
					makeTrackedFile("commands/ck.md", "ck"),
					makeTrackedFile("commands/modified.md", "ck-modified"),
					makeTrackedFile("commands/user.md", "user"),
				],
				true, // metadata.json self-tracked as ck-owned
			),
		);
		writeTrackedFile(claudeDir, "commands/ck.md");
		writeTrackedFile(claudeDir, "commands/modified.md");
		writeTrackedFile(claudeDir, "commands/user.md");

		const result = await runFreshInstall(claudeDir);

		expect(result.success).toBe(true);
		expect(result.error).toBeUndefined();
		// ck + ck-modified removed (handleFreshInstallation passes includeModified=true)
		expect(existsSync(join(claudeDir, "commands/ck.md"))).toBe(false);
		expect(existsSync(join(claudeDir, "commands/modified.md"))).toBe(false);
		// user-owned preserved
		expect(existsSync(join(claudeDir, "commands/user.md"))).toBe(true);
	});
});

// ─── Fixture E: Legacy metadata (no kits), metadata.json self-tracked ────────

describe("Fixture E — legacy format (no kits), metadata.json self-tracked", () => {
	test("succeeds without throwing", async () => {
		writeMetadata(
			claudeDir,
			makeLegacyMetadata(
				[makeTrackedFile("commands/legacy.md", "ck")],
				true, // metadata.json self-tracked in legacy files[]
			),
		);
		writeTrackedFile(claudeDir, "commands/legacy.md");

		const result = await runFreshInstall(claudeDir);

		expect(result.success).toBe(true);
		expect(result.error).toBeUndefined();
	});

	test("does not throw 'metadata.json is missing' error", async () => {
		writeMetadata(
			claudeDir,
			makeLegacyMetadata([makeTrackedFile("commands/legacy.md", "ck")], true),
		);
		writeTrackedFile(claudeDir, "commands/legacy.md");

		const result = await runFreshInstall(claudeDir);

		expect(result.error ?? "").not.toContain("metadata.json is missing");
	});

	test("CK files removed", async () => {
		writeMetadata(
			claudeDir,
			makeLegacyMetadata([makeTrackedFile("commands/legacy.md", "ck")], true),
		);
		writeTrackedFile(claudeDir, "commands/legacy.md");

		await runFreshInstall(claudeDir);

		expect(existsSync(join(claudeDir, "commands/legacy.md"))).toBe(false);
	});
});
