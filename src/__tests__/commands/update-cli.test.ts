/**
 * Tests for update-cli command - buildInitCommand helper
 */
import { describe, expect, it } from "bun:test";
import { buildInitCommand } from "@/commands/update-cli.js";

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
	});
});
