/**
 * Tests for update-cli command
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	type KitSelectionParams,
	buildInitCommand,
	isBetaVersion,
	readMetadataFile,
	selectKitForUpdate,
} from "@/commands/update-cli.js";

describe("update-cli", () => {
	describe("buildInitCommand", () => {
		it("builds local command with no kit (generic)", () => {
			const result = buildInitCommand(false);
			expect(result).toBe("ck init --yes --install-skills");
		});

		it("builds global command with no kit (generic)", () => {
			const result = buildInitCommand(true);
			expect(result).toBe("ck init -g --yes --install-skills");
		});

		it("builds local command with engineer kit", () => {
			const result = buildInitCommand(false, "engineer");
			expect(result).toBe("ck init --kit engineer --yes --install-skills");
		});

		it("builds local command with marketing kit", () => {
			const result = buildInitCommand(false, "marketing");
			expect(result).toBe("ck init --kit marketing --yes --install-skills");
		});

		it("builds global command with engineer kit", () => {
			const result = buildInitCommand(true, "engineer");
			expect(result).toBe("ck init -g --kit engineer --yes --install-skills");
		});

		it("builds global command with marketing kit", () => {
			const result = buildInitCommand(true, "marketing");
			expect(result).toBe("ck init -g --kit marketing --yes --install-skills");
		});

		it("places -g flag before --kit flag", () => {
			const result = buildInitCommand(true, "engineer");
			const gIndex = result.indexOf("-g");
			const kitIndex = result.indexOf("--kit");
			expect(gIndex).toBeLessThan(kitIndex);
		});

		it("always includes --yes and --install-skills flags", () => {
			const cases = [
				buildInitCommand(false),
				buildInitCommand(true),
				buildInitCommand(false, "engineer"),
				buildInitCommand(true, "marketing"),
			];

			for (const cmd of cases) {
				expect(cmd).toContain("--yes");
				expect(cmd).toContain("--install-skills");
			}
		});

		it("includes --beta flag when beta is true", () => {
			const result = buildInitCommand(false, undefined, true);
			expect(result).toBe("ck init --yes --install-skills --beta");
		});

		it("includes --beta flag with kit and global", () => {
			const result = buildInitCommand(true, "engineer", true);
			expect(result).toBe("ck init -g --kit engineer --yes --install-skills --beta");
		});

		it("does not include --beta flag when beta is false", () => {
			const result = buildInitCommand(false, "engineer", false);
			expect(result).toBe("ck init --kit engineer --yes --install-skills");
		});

		it("does not include --beta flag when beta is undefined", () => {
			const result = buildInitCommand(false, "engineer");
			expect(result).toBe("ck init --kit engineer --yes --install-skills");
		});
	});

	describe("readMetadataFile", () => {
		let tempDir: string;

		beforeEach(async () => {
			tempDir = await mkdtemp(join(tmpdir(), "ck-test-"));
		});

		afterEach(async () => {
			await rm(tempDir, { recursive: true, force: true });
		});

		it("returns null when metadata.json does not exist", async () => {
			const result = await readMetadataFile(tempDir);
			expect(result).toBeNull();
		});

		it("reads and parses valid metadata.json", async () => {
			const metadata = {
				version: "1.0.0",
				kits: {
					engineer: { version: "2.0.0", installedAt: "2025-01-01T00:00:00Z" },
				},
			};
			await writeFile(join(tempDir, "metadata.json"), JSON.stringify(metadata));

			const result = await readMetadataFile(tempDir);
			expect(result?.version).toBe("1.0.0");
			expect(result?.kits?.engineer?.version).toBe("2.0.0");
		});

		it("returns null for invalid JSON", async () => {
			await writeFile(join(tempDir, "metadata.json"), "not valid json {{{");

			const result = await readMetadataFile(tempDir);
			expect(result).toBeNull();
		});

		it("returns null for empty file", async () => {
			await writeFile(join(tempDir, "metadata.json"), "");

			const result = await readMetadataFile(tempDir);
			expect(result).toBeNull();
		});

		it("handles metadata with multiple kits", async () => {
			const metadata = {
				version: "1.5.0",
				kits: {
					engineer: { version: "2.0.0", installedAt: "2025-01-01T00:00:00Z" },
					marketing: { version: "1.0.0", installedAt: "2025-01-01T00:00:00Z" },
				},
			};
			await writeFile(join(tempDir, "metadata.json"), JSON.stringify(metadata));

			const result = await readMetadataFile(tempDir);
			expect(result?.kits?.engineer?.version).toBe("2.0.0");
			expect(result?.kits?.marketing?.version).toBe("1.0.0");
		});
	});

	describe("selectKitForUpdate", () => {
		// =========================================================================
		// No kits installed - should return null
		// =========================================================================
		describe("no kits installed", () => {
			it("returns null when no local or global installations", () => {
				const params: KitSelectionParams = {
					hasLocal: false,
					hasGlobal: false,
					localKits: [],
					globalKits: [],
				};
				const result = selectKitForUpdate(params);
				expect(result).toBeNull();
			});
		});

		// =========================================================================
		// Only global kit installed
		// =========================================================================
		describe("only global kit installed", () => {
			it("selects global kit when globalKits has items", () => {
				const params: KitSelectionParams = {
					hasLocal: false,
					hasGlobal: true,
					localKits: [],
					globalKits: ["engineer"],
				};
				const result = selectKitForUpdate(params);
				expect(result).not.toBeNull();
				expect(result?.isGlobal).toBe(true);
				expect(result?.kit).toBe("engineer");
				expect(result?.promptMessage).toContain("global");
				expect(result?.promptMessage).toContain("engineer");
			});

			it("falls back to localKits when globalKits is empty but hasGlobal is true", () => {
				const params: KitSelectionParams = {
					hasLocal: false,
					hasGlobal: true,
					localKits: ["marketing"],
					globalKits: [],
				};
				const result = selectKitForUpdate(params);
				expect(result).not.toBeNull();
				expect(result?.isGlobal).toBe(true);
				expect(result?.kit).toBe("marketing");
			});

			it("returns undefined kit when both globalKits and localKits are empty", () => {
				const params: KitSelectionParams = {
					hasLocal: false,
					hasGlobal: true,
					localKits: [],
					globalKits: [],
				};
				const result = selectKitForUpdate(params);
				expect(result).not.toBeNull();
				expect(result?.isGlobal).toBe(true);
				expect(result?.kit).toBeUndefined();
				expect(result?.promptMessage).toBe("Update global ClaudeKit content?");
			});
		});

		// =========================================================================
		// Only local kit installed
		// =========================================================================
		describe("only local kit installed", () => {
			it("selects local kit when localKits has items", () => {
				const params: KitSelectionParams = {
					hasLocal: true,
					hasGlobal: false,
					localKits: ["engineer"],
					globalKits: [],
				};
				const result = selectKitForUpdate(params);
				expect(result).not.toBeNull();
				expect(result?.isGlobal).toBe(false);
				expect(result?.kit).toBe("engineer");
				expect(result?.promptMessage).toContain("local");
				expect(result?.promptMessage).toContain("engineer");
			});

			it("returns undefined kit when both localKits and globalKits are empty", () => {
				const params: KitSelectionParams = {
					hasLocal: true,
					hasGlobal: false,
					localKits: [],
					globalKits: [],
				};
				const result = selectKitForUpdate(params);
				expect(result).not.toBeNull();
				expect(result?.isGlobal).toBe(false);
				expect(result?.kit).toBeUndefined();
				expect(result?.promptMessage).toBe("Update local project ClaudeKit content?");
			});
		});

		// =========================================================================
		// Both local and global kits installed
		// =========================================================================
		describe("both local and global installed", () => {
			it("prefers global kit when both have items", () => {
				const params: KitSelectionParams = {
					hasLocal: true,
					hasGlobal: true,
					localKits: ["marketing"],
					globalKits: ["engineer"],
				};
				const result = selectKitForUpdate(params);
				expect(result).not.toBeNull();
				expect(result?.isGlobal).toBe(true);
				expect(result?.kit).toBe("engineer");
				expect(result?.promptMessage).toContain("global");
			});

			it("falls back to localKits when globalKits is empty", () => {
				const params: KitSelectionParams = {
					hasLocal: true,
					hasGlobal: true,
					localKits: ["marketing"],
					globalKits: [],
				};
				const result = selectKitForUpdate(params);
				expect(result).not.toBeNull();
				expect(result?.isGlobal).toBe(true);
				expect(result?.kit).toBe("marketing");
			});

			it("returns undefined kit when both arrays are empty but flags are true", () => {
				const params: KitSelectionParams = {
					hasLocal: true,
					hasGlobal: true,
					localKits: [],
					globalKits: [],
				};
				const result = selectKitForUpdate(params);
				expect(result).not.toBeNull();
				expect(result?.isGlobal).toBe(true);
				expect(result?.kit).toBeUndefined();
			});
		});

		// =========================================================================
		// Prompt message formatting
		// =========================================================================
		describe("prompt message formatting", () => {
			it("includes kit name in parentheses when kit is defined", () => {
				const params: KitSelectionParams = {
					hasLocal: false,
					hasGlobal: true,
					localKits: [],
					globalKits: ["engineer"],
				};
				const result = selectKitForUpdate(params);
				expect(result?.promptMessage).toBe("Update global ClaudeKit content (engineer)?");
			});

			it("excludes parentheses when kit is undefined", () => {
				const params: KitSelectionParams = {
					hasLocal: false,
					hasGlobal: true,
					localKits: [],
					globalKits: [],
				};
				const result = selectKitForUpdate(params);
				expect(result?.promptMessage).toBe("Update global ClaudeKit content?");
			});

			it("shows 'local project' for local-only installation", () => {
				const params: KitSelectionParams = {
					hasLocal: true,
					hasGlobal: false,
					localKits: ["engineer"],
					globalKits: [],
				};
				const result = selectKitForUpdate(params);
				expect(result?.promptMessage).toBe("Update local project ClaudeKit content (engineer)?");
			});
		});

		// =========================================================================
		// Edge cases with hasLocal/hasGlobal derived from kit arrays
		// =========================================================================
		describe("edge cases - kit detection from arrays", () => {
			it("detects hasLocalKit from localKits array even when hasLocal is false", () => {
				const params: KitSelectionParams = {
					hasLocal: false,
					hasGlobal: false,
					localKits: ["engineer"],
					globalKits: [],
				};
				const result = selectKitForUpdate(params);
				expect(result).not.toBeNull();
				expect(result?.isGlobal).toBe(false);
				expect(result?.kit).toBe("engineer");
			});

			it("detects hasGlobalKit from globalKits array even when hasGlobal is false", () => {
				const params: KitSelectionParams = {
					hasLocal: false,
					hasGlobal: false,
					localKits: [],
					globalKits: ["engineer"],
				};
				const result = selectKitForUpdate(params);
				expect(result).not.toBeNull();
				expect(result?.isGlobal).toBe(true);
				expect(result?.kit).toBe("engineer");
			});

			it("selects first kit when multiple kits in array", () => {
				const params: KitSelectionParams = {
					hasLocal: true,
					hasGlobal: false,
					localKits: ["engineer", "marketing"],
					globalKits: [],
				};
				const result = selectKitForUpdate(params);
				expect(result?.kit).toBe("engineer");
			});
		});
	});

	// =========================================================================
	// isBetaVersion - prerelease detection
	// =========================================================================
	describe("isBetaVersion", () => {
		describe("detects beta versions", () => {
			it("returns true for -beta.N format", () => {
				expect(isBetaVersion("v2.3.0-beta.17")).toBe(true);
				expect(isBetaVersion("1.0.0-beta.1")).toBe(true);
				expect(isBetaVersion("2.0.0-beta.0")).toBe(true);
			});

			it("returns true for -alpha.N format", () => {
				expect(isBetaVersion("v1.0.0-alpha.1")).toBe(true);
				expect(isBetaVersion("2.0.0-alpha.5")).toBe(true);
			});

			it("returns true for -rc.N format", () => {
				expect(isBetaVersion("v3.0.0-rc.1")).toBe(true);
				expect(isBetaVersion("1.0.0-rc.2")).toBe(true);
			});

			it("is case insensitive", () => {
				expect(isBetaVersion("v1.0.0-BETA.1")).toBe(true);
				expect(isBetaVersion("v1.0.0-Beta.1")).toBe(true);
				expect(isBetaVersion("v1.0.0-ALPHA.1")).toBe(true);
				expect(isBetaVersion("v1.0.0-RC.1")).toBe(true);
			});
		});

		describe("detects stable versions", () => {
			it("returns false for stable semver", () => {
				expect(isBetaVersion("v2.3.0")).toBe(false);
				expect(isBetaVersion("1.0.0")).toBe(false);
				expect(isBetaVersion("3.25.0")).toBe(false);
			});

			it("returns false for versions with v prefix only", () => {
				expect(isBetaVersion("v1.0.0")).toBe(false);
			});
		});

		describe("handles edge cases", () => {
			it("returns false for undefined", () => {
				expect(isBetaVersion(undefined)).toBe(false);
			});

			it("returns false for empty string", () => {
				expect(isBetaVersion("")).toBe(false);
			});

			it("returns false for version containing beta as substring (not prerelease)", () => {
				// Edge case: version doesn't match pattern without separator+digit
				expect(isBetaVersion("v1.0.0-betarelease")).toBe(false);
			});
		});
	});
});
