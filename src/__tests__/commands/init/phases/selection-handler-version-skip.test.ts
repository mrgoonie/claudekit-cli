/**
 * Tests for selection-handler early-exit when --yes mode + same version installed.
 * Validates the version skip optimization added in #479.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { versionsMatch } from "@/domains/versioning/checking/version-utils.js";

const SOURCE_PATH = resolve(__dirname, "../../../../commands/init/phases/selection-handler.ts");
const source = readFileSync(SOURCE_PATH, "utf-8");

// Extract the early-exit block once for all structural tests
const blockStart = source.indexOf("// Early exit: skip if --yes mode");
const blockEnd = source.indexOf("\n\treturn {", blockStart);
const earlyExitBlock = source.slice(blockStart, blockEnd);

describe("selection-handler version skip (structural)", () => {
	it("imports versionsMatch from version-utils for DRY version comparison", () => {
		expect(source).toContain(
			'import { versionsMatch } from "@/domains/versioning/checking/version-utils.js"',
		);
	});

	it("guards early exit with --yes AND NOT --fresh AND release tag AND NOT offline", () => {
		expect(earlyExitBlock).toContain("ctx.options.yes");
		expect(earlyExitBlock).toContain("!ctx.options.fresh");
		expect(earlyExitBlock).toContain("releaseTag");
		expect(earlyExitBlock).toContain("!isOfflineMode");
	});

	it("reads installed kit version from manifest metadata", () => {
		expect(earlyExitBlock).toContain("readManifest(claudeDir)");
		expect(earlyExitBlock).toContain("existingMetadata?.kits?.[kitType]?.version");
	});

	it("uses versionsMatch for comparison (not inline normalizeVersion)", () => {
		expect(earlyExitBlock).toContain("versionsMatch(installedKitVersion, releaseTag)");
		expect(earlyExitBlock).not.toContain("normalizeVersion(installedKitVersion) ===");
	});

	it("returns cancelled: true when versions match", () => {
		expect(earlyExitBlock).toContain("cancelled: true");
	});

	it("catches metadata read errors and proceeds with installation", () => {
		expect(earlyExitBlock).toContain("catch");
		expect(earlyExitBlock).toContain("Metadata read failed");
	});

	it("skips early exit when pendingKits has items (multi-kit mode)", () => {
		expect(earlyExitBlock).toContain("!pendingKits?.length");
	});

	it("does NOT skip when --fresh flag is set", () => {
		expect(earlyExitBlock).toContain("!ctx.options.fresh");
	});

	it("shows outro before returning cancelled", () => {
		expect(earlyExitBlock).toContain('ctx.prompts.outro("Already at latest version');
	});
});

describe("versionsMatch integration with selection-handler", () => {
	it("correctly matches versions that would trigger early exit", () => {
		expect(versionsMatch("v1.2.0", "v1.2.0")).toBe(true);
		expect(versionsMatch("1.2.0", "v1.2.0")).toBe(true);
	});

	it("correctly identifies versions that should NOT trigger early exit", () => {
		expect(versionsMatch("v1.2.0", "v1.3.0")).toBe(false);
		expect(versionsMatch("v1.2.0-beta.5", "v1.2.0")).toBe(false);
	});
});
