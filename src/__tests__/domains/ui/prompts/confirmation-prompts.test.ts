import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { output } from "@/shared/output-manager.js";

describe("promptSkillsInstallation", () => {
	// Store original platform
	const originalPlatform = process.platform;

	beforeEach(() => {
		// Reset output manager
		output.reset();
	});

	afterEach(() => {
		// Restore platform
		Object.defineProperty(process, "platform", { value: originalPlatform });
	});

	describe("JSON output mode", () => {
		it("returns false immediately in JSON mode without prompting", async () => {
			// Configure JSON output mode
			output.configure({ json: true });

			// Dynamically import to get fresh module
			const { promptSkillsInstallation } = await import(
				"@/domains/ui/prompts/confirmation-prompts.js"
			);

			const result = await promptSkillsInstallation();

			expect(result).toBe(false);
		});
	});

	describe("platform detection", () => {
		it("uses os.platform() for detection", async () => {
			// Just verify the import works - actual platform behavior tested via constants
			const { platform } = await import("node:os");
			expect(typeof platform()).toBe("string");
		});
	});

	describe("dependency constants integration", () => {
		it("imports from skills-dependencies module", async () => {
			const { SKILLS_DEPENDENCIES, formatDependencyList, getInstallCommand, getVenvPath } =
				await import("@/types/skills-dependencies.js");

			// Verify all exports are available
			expect(SKILLS_DEPENDENCIES).toBeDefined();
			expect(typeof formatDependencyList).toBe("function");
			expect(typeof getInstallCommand).toBe("function");
			expect(typeof getVenvPath).toBe("function");
		});
	});
});
