/**
 * Tests for update-cli command
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildInitCommand, readMetadataFile } from "@/commands/update-cli.js";

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
});
