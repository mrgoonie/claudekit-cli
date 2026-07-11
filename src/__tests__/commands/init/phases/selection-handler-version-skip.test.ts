/**
 * Tests for selection-handler early-exit when --yes mode + same version installed.
 * Validates the version skip optimization added in #479.
 */
import { afterEach, describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { handleSelection } from "@/commands/init/phases/selection-handler.js";
import type { InitContext } from "@/commands/init/types.js";
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

	it("checks for missing registered hook files before skipping (issue #900)", () => {
		expect(earlyExitBlock).toContain("countMissingHookFileReferencesForClaudeDir(claudeDir)");
		expect(earlyExitBlock).toContain("missingHookFiles > 0");
	});

	it("guards the skip return behind the missing-hooks check (not version match alone)", () => {
		// The skip's success log must come AFTER the missing-hooks check, i.e. live in the
		// else branch so a broken install re-onboards instead of skipping.
		const missingIdx = earlyExitBlock.indexOf("missingHookFiles > 0");
		const skipIdx = earlyExitBlock.indexOf("skipping reinstall");
		expect(missingIdx).toBeGreaterThan(-1);
		expect(missingIdx).toBeLessThan(skipIdx);
	});

	it("catches metadata read errors with verbose logging", () => {
		expect(earlyExitBlock).toContain("catch");
		expect(earlyExitBlock).toContain("logger.verbose");
		expect(earlyExitBlock).toContain("Metadata read failed");
	});

	it("skips early exit when pendingKits has items (multi-kit mode)", () => {
		expect(earlyExitBlock).toContain("!pendingKits?.length");
	});

	it("does NOT skip when --fresh flag is set", () => {
		expect(earlyExitBlock).toContain("!ctx.options.fresh");
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

describe("direct same-version global Engineer convergence", () => {
	const roots: string[] = [];

	afterEach(async () => {
		await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
	});

	async function createContext(
		preference: "plugin" | "legacy",
		configure: (root: string) => Promise<void>,
	): Promise<InitContext> {
		const root = await mkdtemp(join(tmpdir(), "ck-direct-engineer-convergence-"));
		roots.push(root);
		await writeFile(
			join(root, "metadata.json"),
			JSON.stringify({
				kits: {
					engineer: {
						version: "v2.20.1",
						installedAt: "2026-07-11T00:00:00.000Z",
						installModePreference: preference,
					},
				},
			}),
		);
		await configure(root);

		return {
			rawOptions: {} as InitContext["rawOptions"],
			options: {
				kit: "engineer",
				dir: root,
				release: "v2.20.1",
				beta: false,
				global: true,
				yes: true,
				fresh: false,
				force: false,
				refresh: false,
				exclude: [],
				only: [],
				installSkills: true,
				packageManager: "npm",
				withSudo: false,
				skipSetup: false,
				forceOverwrite: false,
				forceOverwriteSettings: false,
				restoreCkHooks: false,
				dryRun: false,
				prefix: false,
				sync: false,
				useGit: true,
				installMode: "legacy",
				installModeExplicit: false,
				installModeTransitionRequired: false,
			},
			prompts: {
				note() {},
				async selectEngineerInstallMode() {
					throw new Error("existing installs must not prompt for consent");
				},
			} as unknown as InitContext["prompts"],
			explicitDir: true,
			isNonInteractive: true,
			customClaudeFiles: [],
			includePatterns: [],
			installSkills: true,
			cancelled: false,
		};
	}

	it.each([
		{
			name: "persisted plugin with disabled Claude registration",
			preference: "plugin" as const,
			configure: async (root: string) => {
				await writeFile(
					join(root, "settings.json"),
					JSON.stringify({ enabledPlugins: { "ck@claudekit": false } }),
				);
				await mkdir(join(root, "plugins", "cache", "claudekit", "ck", "v2.20.0"), {
					recursive: true,
				});
			},
		},
		{
			name: "persisted plugin with missing or stale Codex registration",
			preference: "plugin" as const,
			configure: async (root: string) => {
				await writeFile(
					join(root, "settings.json"),
					JSON.stringify({ enabledPlugins: { "ck@claudekit": true } }),
				);
				await mkdir(join(root, "plugins", "cache", "claudekit", "ck", "v2.20.1"), {
					recursive: true,
				});
				await mkdir(join(root, ".codex", "plugins"), { recursive: true });
				await writeFile(join(root, ".codex", "plugins", "ck.version"), "v2.20.0");
			},
		},
		{
			name: "normal preference with Codex-only plugin residue",
			preference: "legacy" as const,
			configure: async (root: string) => {
				await mkdir(join(root, ".codex", "plugins"), { recursive: true });
				await writeFile(join(root, ".codex", "plugins", "ck.version"), "v2.20.1");
			},
		},
	])("does not early-exit for $name", async ({ preference, configure }) => {
		const ctx = await createContext(preference, configure);

		const result = await handleSelection(ctx);

		expect(result.cancelled).toBe(false);
		expect(result.release?.tag_name).toBe("v2.20.1");
		expect(result.options.installMode).toBe(preference);
	});
});
