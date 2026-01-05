import { describe, expect, it } from "bun:test";
import {
	SKILLS_DEPENDENCIES,
	formatDependencyList,
	getInstallCommand,
	getVenvPath,
} from "@/types/skills-dependencies.js";

describe("skills-dependencies", () => {
	describe("SKILLS_DEPENDENCIES constant", () => {
		it("has python dependencies defined", () => {
			expect(SKILLS_DEPENDENCIES.python).toBeDefined();
			expect(SKILLS_DEPENDENCIES.python.length).toBeGreaterThan(0);
		});

		it("has system dependencies defined", () => {
			expect(SKILLS_DEPENDENCIES.system).toBeDefined();
			expect(SKILLS_DEPENDENCIES.system.length).toBeGreaterThan(0);
		});

		it("has node dependencies defined", () => {
			expect(SKILLS_DEPENDENCIES.node).toBeDefined();
			expect(SKILLS_DEPENDENCIES.node.length).toBeGreaterThan(0);
		});

		it("includes google-genai in python deps", () => {
			const googleGenai = SKILLS_DEPENDENCIES.python.find((d) => d.name.includes("google-genai"));
			expect(googleGenai).toBeDefined();
			expect(googleGenai?.description).toContain("ai-multimodal");
		});

		it("includes ffmpeg in system deps", () => {
			const ffmpeg = SKILLS_DEPENDENCIES.system.find((d) => d.name === "ffmpeg");
			expect(ffmpeg).toBeDefined();
		});
	});

	describe("formatDependencyList", () => {
		it("formats dependencies with proper padding", () => {
			const deps = [{ name: "test-pkg", description: "Test description" }];
			const result = formatDependencyList(deps);

			expect(result).toContain("test-pkg");
			expect(result).toContain("Test description");
			expect(result).toMatch(/^\s+-/); // Starts with indentation and dash
		});

		it("handles multiple dependencies", () => {
			const deps = [
				{ name: "pkg1", description: "Desc 1" },
				{ name: "pkg2", description: "Desc 2" },
			];
			const result = formatDependencyList(deps);

			expect(result).toContain("pkg1");
			expect(result).toContain("pkg2");
			expect(result.split("\n").length).toBe(2);
		});
	});

	describe("getVenvPath", () => {
		it("returns Windows path format for Windows", () => {
			const result = getVenvPath(true);
			expect(result).toContain("%USERPROFILE%");
			expect(result).toContain("\\.claude\\");
		});

		it("returns Unix path format for non-Windows", () => {
			const result = getVenvPath(false);
			expect(result).toContain("~/.claude/");
			expect(result).not.toContain("%USERPROFILE%");
		});
	});

	describe("getInstallCommand", () => {
		it("returns PowerShell command for Windows", () => {
			const result = getInstallCommand(true);
			expect(result).toContain("powershell");
			expect(result).toContain("install.ps1");
			expect(result).toContain("%USERPROFILE%");
		});

		it("returns bash command for non-Windows", () => {
			const result = getInstallCommand(false);
			expect(result).toContain("bash");
			expect(result).toContain("install.sh");
			expect(result).toContain("~/.claude/");
		});
	});
});
