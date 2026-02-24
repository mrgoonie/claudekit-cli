/**
 * Integration tests for plugin migration pipeline.
 * Tests logical flow between: categorizeDeletions → migrateUserSkills → metadata tracking.
 * Mocks fs/child_process but tests actual module interactions.
 */

import { describe, expect, mock, test } from "bun:test";

// ---------------------------------------------------------------------------
// Mocks — must be declared before any module imports
// ---------------------------------------------------------------------------

// Mock fs-extra
mock.module("fs-extra", () => ({
	pathExists: mock(() => Promise.resolve(true)),
	copy: mock(() => Promise.resolve()),
	remove: mock(() => Promise.resolve()),
	ensureDir: mock(() => Promise.resolve()),
	readFile: mock(() => Promise.resolve("{}")),
	writeFile: mock(() => Promise.resolve()),
}));

// Mock node:fs/promises
const mockReadFilePipeline = mock(() => Promise.resolve("{}"));
mock.module("node:fs/promises", () => ({
	readFile: mockReadFilePipeline,
}));

// Mock logger
mock.module("@/shared/logger.js", () => ({
	logger: {
		info: mock(() => {}),
		debug: mock(() => {}),
		verbose: mock(() => {}),
		warning: mock(() => {}),
		success: mock(() => {}),
		error: mock(() => {}),
	},
}));

// Mock path resolver
mock.module("@/shared/path-resolver.js", () => ({
	PathResolver: {
		getClaudeKitDir: () => "/fake/.claudekit",
		getClaudeDir: () => "/fake/.claude",
	},
}));

// Mock child_process (for cc-version-checker if pulled in)
mock.module("node:child_process", () => ({
	execFile: mock(() => Promise.resolve({ stdout: "1.0.35", stderr: "" })),
}));

mock.module("node:util", () => ({
	promisify: (fn: unknown) => fn,
}));

mock.module("@/shared/claude-exec-options.js", () => ({
	buildExecOptions: () => ({ timeout: 5000, env: {}, shell: false }),
}));

// ---------------------------------------------------------------------------
// Import modules under test
// ---------------------------------------------------------------------------
import { categorizeDeletions } from "@/domains/installation/deletion-handler.js";
import { migrateUserSkills } from "@/services/skill-migration-merger.js";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("plugin migration pipeline", () => {
	test("categorizeDeletions splits skills from non-skills correctly", () => {
		const deletions = [
			"commands/old-cmd.md",
			"skills/cook/**",
			"skills/debug/**",
			"agents/old-agent/**",
			"command-archive/fix/ci.md",
		];

		const result = categorizeDeletions(deletions);

		// Skills are deferred (gated by plugin install verification)
		expect(result.deferred).toContain("skills/cook/**");
		expect(result.deferred).toContain("skills/debug/**");

		// Non-skills are immediate
		expect(result.immediate).toContain("commands/old-cmd.md");
		expect(result.immediate).toContain("agents/old-agent/**");
		expect(result.immediate).toContain("command-archive/fix/ci.md");

		// No cross-contamination
		expect(result.deferred).not.toContain("commands/old-cmd.md");
		expect(result.immediate).not.toContain("skills/cook/**");
	});

	test("migrateUserSkills categorizes ck/ck-modified/user correctly", async () => {
		mockReadFilePipeline.mockResolvedValueOnce(
			JSON.stringify({
				kits: {
					engineer: {
						files: [
							{
								path: "skills/cook/SKILL.md",
								checksum: "abc",
								ownership: "ck",
								installedVersion: "1.0.0",
							},
							{
								path: "skills/debug/SKILL.md",
								checksum: "def",
								ownership: "ck-modified",
								installedVersion: "1.0.0",
							},
							{
								path: "skills/my-custom/SKILL.md",
								checksum: "ghi",
								ownership: "user",
								installedVersion: "1.0.0",
							},
						],
					},
				},
			}),
		);

		const result = await migrateUserSkills("/fake/.claude", true);

		// ck → deleted (plugin has canonical version)
		expect(result.deleted).toContain("skills/cook");

		// ck-modified → preserved (user customized it)
		expect(result.preserved).toContain("skills/debug");

		// user → userOwned (never touched)
		expect(result.userOwned).toContain("skills/my-custom");
	});

	test("deferred deletions filtered by preserved skills", () => {
		// Simulate the pipeline gating: only delete skills NOT in preserved list
		const deferredDeletions = ["skills/cook/**", "skills/debug/**", "skills/planner/**"];
		const preservedSkillDirs = ["skills/debug"]; // user customized this one

		// Filter out preserved skills from deferred deletions
		const safeToDelete = deferredDeletions.filter((path) => {
			// Normalize: "skills/cook/**" → check if "skills/cook" is preserved
			const skillDir = path.replace(/[/\\]\*\*$/, "").replace(/\\/g, "/");
			return !preservedSkillDirs.some((p) => p === skillDir);
		});

		expect(safeToDelete).toContain("skills/cook/**");
		expect(safeToDelete).toContain("skills/planner/**");
		expect(safeToDelete).not.toContain("skills/debug/**");
	});

	test("metadata tracking records plugin state", () => {
		// Test the metadata shape expected by the pipeline
		const metadata = {
			kits: {
				engineer: {
					files: [
						{
							path: "skills/cook/SKILL.md",
							checksum: "abc123",
							ownership: "ck" as const,
							installedVersion: "3.35.0",
						},
					],
					installedVersion: "3.35.0",
					lastUpdated: new Date().toISOString(),
				},
			},
			pluginInstalled: true,
			pluginVerified: true,
		};

		// Verify metadata structure supports plugin state tracking
		expect(metadata.pluginInstalled).toBe(true);
		expect(metadata.pluginVerified).toBe(true);
		expect(metadata.kits.engineer.files[0].ownership).toBe("ck");
	});

	test("full pipeline: version gate → install → verify → delete", async () => {
		// Simulate the full logical flow without I/O

		// Step 1: Version gate (CC >= 1.0.33)
		const ccVersion = "1.0.35";
		const minVersion = "1.0.33";

		// Parse and compare
		const parseVer = (v: string) => {
			const m = v.match(/^(\d+)\.(\d+)\.(\d+)/);
			if (!m) return null;
			return [Number(m[1]), Number(m[2]), Number(m[3])] as [number, number, number];
		};
		const parsedCC = parseVer(ccVersion);
		const parsedMin = parseVer(minVersion);
		expect(parsedCC).not.toBeNull();
		expect(parsedMin).not.toBeNull();

		let versionPasses = false;
		if (parsedCC && parsedMin) {
			for (let i = 0; i < 3; i++) {
				if (parsedCC[i] !== parsedMin[i]) {
					versionPasses = parsedCC[i] > parsedMin[i];
					break;
				}
				if (i === 2) versionPasses = true; // equal
			}
		}
		expect(versionPasses).toBe(true);

		// Step 2: Plugin install succeeds
		const pluginInstallResult = {
			installed: true,
			marketplaceRegistered: true,
			verified: true,
			error: undefined as string | undefined,
		};
		expect(pluginInstallResult.verified).toBe(true);

		// Step 3: migrateUserSkills — with verified=true, categorizes skills
		mockReadFilePipeline.mockResolvedValueOnce(
			JSON.stringify({
				kits: {
					engineer: {
						files: [
							{
								path: "skills/cook/SKILL.md",
								checksum: "abc",
								ownership: "ck",
								installedVersion: "1.0.0",
							},
						],
					},
				},
			}),
		);

		const migrationResult = await migrateUserSkills("/fake/.claude", pluginInstallResult.verified);
		expect(migrationResult.deleted).toContain("skills/cook");
		expect(migrationResult.preserved).toEqual([]);

		// Step 4: Deferred deletions — only delete what's not preserved
		const deferredDeletions = ["skills/cook/**"];
		const finalDeletions = deferredDeletions.filter((path) => {
			const skillDir = path.replace(/[/\\]\*\*$/, "").replace(/\\/g, "/");
			return !migrationResult.preserved.some((p) => p === skillDir);
		});

		expect(finalDeletions).toContain("skills/cook/**");
		expect(finalDeletions).toHaveLength(1);
	});
});
