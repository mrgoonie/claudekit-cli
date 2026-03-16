/**
 * Tests for selection-handler early-exit when --yes mode + same version installed.
 * Validates the version skip optimization added in #479.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { versionsMatch } from "@/commands/update-cli.js";

const SOURCE_PATH = resolve(__dirname, "../../../../commands/init/phases/selection-handler.ts");
const source = readFileSync(SOURCE_PATH, "utf-8");

describe("selection-handler version skip (structural)", () => {
	it("imports versionsMatch from update-cli for DRY version comparison", () => {
		expect(source).toContain('import { versionsMatch } from "@/commands/update-cli.js"');
	});

	it("guards early exit with --yes AND NOT --fresh AND release tag AND NOT offline", () => {
		expect(source).toContain(
			"ctx.options.yes && !ctx.options.fresh && release?.tag_name && !isOfflineMode",
		);
	});

	it("reads installed kit version from manifest metadata", () => {
		// Verify it reads from manifest (not readClaudeKitMetadata which lacks kits field)
		const earlyExitBlock = source.slice(
			source.indexOf("// Early exit: skip if --yes mode"),
			source.indexOf("// Early exit: skip if --yes mode") + 600,
		);
		expect(earlyExitBlock).toContain("readManifest(claudeDir)");
		expect(earlyExitBlock).toContain("existingMetadata?.kits?.[kitType]?.version");
	});

	it("uses versionsMatch for comparison (not inline normalizeVersion)", () => {
		const earlyExitBlock = source.slice(
			source.indexOf("// Early exit: skip if --yes mode"),
			source.indexOf("// Early exit: skip if --yes mode") + 600,
		);
		expect(earlyExitBlock).toContain("versionsMatch(installedKitVersion, release.tag_name)");
		// Should NOT have inline normalizeVersion comparison
		expect(earlyExitBlock).not.toContain("normalizeVersion(installedKitVersion) ===");
	});

	it("returns cancelled: true when versions match", () => {
		const earlyExitBlock = source.slice(
			source.indexOf("// Early exit: skip if --yes mode"),
			source.indexOf("// Early exit: skip if --yes mode") + 800,
		);
		expect(earlyExitBlock).toContain("cancelled: true");
	});

	it("catches metadata read errors and proceeds with installation", () => {
		const earlyExitBlock = source.slice(
			source.indexOf("// Early exit: skip if --yes mode"),
			source.indexOf("// Early exit: skip if --yes mode") + 800,
		);
		expect(earlyExitBlock).toContain("catch");
		expect(earlyExitBlock).toContain("Metadata read failed");
	});
});

describe("versionsMatch integration with selection-handler", () => {
	it("correctly matches versions that would trigger early exit", () => {
		// Simulates: metadata has v1.2.0, release tag is v1.2.0
		expect(versionsMatch("v1.2.0", "v1.2.0")).toBe(true);
		// Simulates: metadata has 1.2.0 (no v), release tag is v1.2.0
		expect(versionsMatch("1.2.0", "v1.2.0")).toBe(true);
	});

	it("correctly identifies versions that should NOT trigger early exit", () => {
		// Simulates: metadata has v1.2.0, release tag is v1.3.0
		expect(versionsMatch("v1.2.0", "v1.3.0")).toBe(false);
		// Beta to stable transition
		expect(versionsMatch("v1.2.0-beta.5", "v1.2.0")).toBe(false);
	});
});
