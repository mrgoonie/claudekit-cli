import { describe, expect, test } from "bun:test";
import {
	CLAUDE_INSTALLERS,
	NODEJS_INSTALLERS,
	PYTHON_INSTALLERS,
	detectOS,
	getInstallerMethods,
	getManualInstructions,
} from "@/services/package-installer/dependency-installer.js";

describe("DependencyInstaller", () => {
	describe("detectOS", () => {
		test("should detect current platform", async () => {
			const osInfo = await detectOS();

			expect(osInfo).toHaveProperty("platform");
			expect(["darwin", "linux", "win32"]).toContain(osInfo.platform);
		});

		test("should detect package managers on macOS", async () => {
			const osInfo = await detectOS();

			if (osInfo.platform === "darwin") {
				expect(osInfo).toHaveProperty("hasHomebrew");
				expect(typeof osInfo.hasHomebrew).toBe("boolean");
			}
		});

		test("should detect package managers on Linux", async () => {
			const osInfo = await detectOS();

			if (osInfo.platform === "linux") {
				expect(osInfo).toHaveProperty("distro");
				expect(osInfo).toHaveProperty("hasApt");
				expect(osInfo).toHaveProperty("hasDnf");
				expect(osInfo).toHaveProperty("hasPacman");

				expect(typeof osInfo.hasApt).toBe("boolean");
				expect(typeof osInfo.hasDnf).toBe("boolean");
				expect(typeof osInfo.hasPacman).toBe("boolean");
			}
		});
	});

	describe("Installation method configurations", () => {
		test("CLAUDE_INSTALLERS should have methods for all platforms", () => {
			const platforms = CLAUDE_INSTALLERS.map((m) => m.platform);

			expect(platforms).toContain("darwin");
			expect(platforms).toContain("linux");
			expect(platforms).toContain("win32");
		});

		test("PYTHON_INSTALLERS should have methods for all platforms", () => {
			const platforms = PYTHON_INSTALLERS.map((m) => m.platform);

			expect(platforms).toContain("darwin");
			expect(platforms).toContain("linux");
		});

		test("NODEJS_INSTALLERS should have methods for all platforms", () => {
			const platforms = NODEJS_INSTALLERS.map((m) => m.platform);

			expect(platforms).toContain("darwin");
			expect(platforms).toContain("linux");
		});

		test("all installer methods should have required properties", () => {
			const allInstallers = [...CLAUDE_INSTALLERS, ...PYTHON_INSTALLERS, ...NODEJS_INSTALLERS];

			for (const installer of allInstallers) {
				expect(installer).toHaveProperty("name");
				expect(installer).toHaveProperty("command");
				expect(installer).toHaveProperty("requiresSudo");
				expect(installer).toHaveProperty("platform");
				expect(installer).toHaveProperty("priority");

				expect(typeof installer.name).toBe("string");
				expect(typeof installer.command).toBe("string");
				expect(typeof installer.requiresSudo).toBe("boolean");
				expect(["darwin", "linux", "win32"]).toContain(installer.platform);
				expect(typeof installer.priority).toBe("number");
			}
		});

		test("Homebrew installers should not require sudo", () => {
			const homebrewInstallers = [
				...CLAUDE_INSTALLERS,
				...PYTHON_INSTALLERS,
				...NODEJS_INSTALLERS,
			].filter((m) => m.name.includes("Homebrew"));

			for (const installer of homebrewInstallers) {
				expect(installer.requiresSudo).toBe(false);
			}
		});

		test("apt/dnf/pacman installers should require sudo", () => {
			const linuxPackageManagers = [
				...CLAUDE_INSTALLERS,
				...PYTHON_INSTALLERS,
				...NODEJS_INSTALLERS,
			].filter(
				(m) =>
					m.command.includes("apt") || m.command.includes("dnf") || m.command.includes("pacman"),
			);

			for (const installer of linuxPackageManagers) {
				expect(installer.requiresSudo).toBe(true);
			}
		});
	});

	describe("getInstallerMethods", () => {
		test("should return methods for current platform", async () => {
			const osInfo = await detectOS();
			const methods = getInstallerMethods("python", osInfo);

			expect(Array.isArray(methods)).toBe(true);

			// All returned methods should match current platform
			for (const method of methods) {
				expect(method.platform).toBe(osInfo.platform);
			}
		});

		test("should filter by available package managers on macOS", async () => {
			const osInfo = await detectOS();

			if (osInfo.platform === "darwin" && !osInfo.hasHomebrew) {
				const methods = getInstallerMethods("python", osInfo);

				// Should not include Homebrew methods if brew is not installed
				const hasBrewMethod = methods.some((m) => m.command.includes("brew"));
				expect(hasBrewMethod).toBe(false);
			}
		});

		test("should filter by available package managers on Linux", async () => {
			const osInfo = await detectOS();

			if (osInfo.platform === "linux") {
				const methods = getInstallerMethods("python", osInfo);

				if (!osInfo.hasApt) {
					const hasAptMethod = methods.some((m) => m.command.includes("apt"));
					expect(hasAptMethod).toBe(false);
				}

				if (!osInfo.hasDnf) {
					const hasDnfMethod = methods.some((m) => m.command.includes("dnf"));
					expect(hasDnfMethod).toBe(false);
				}

				if (!osInfo.hasPacman) {
					const hasPacmanMethod = methods.some((m) => m.command.includes("pacman"));
					expect(hasPacmanMethod).toBe(false);
				}
			}
		});

		test("should sort methods by priority", async () => {
			const osInfo = await detectOS();
			const methods = getInstallerMethods("nodejs", osInfo);

			if (methods.length > 1) {
				for (let i = 1; i < methods.length; i++) {
					expect(methods[i].priority).toBeGreaterThanOrEqual(methods[i - 1].priority);
				}
			}
		});

		test("should handle pip dependency", async () => {
			const osInfo = await detectOS();
			const methods = getInstallerMethods("pip", osInfo);

			// pip is installed with Python, so should use Python installers
			expect(methods.length).toBeGreaterThan(0);
		});
	});

	describe("getManualInstructions", () => {
		test("should return instructions for all dependencies", async () => {
			const osInfo = await detectOS();
			const dependencies = ["claude", "python", "pip", "nodejs"] as const;

			for (const dep of dependencies) {
				const instructions = getManualInstructions(dep, osInfo);

				expect(Array.isArray(instructions)).toBe(true);
				expect(instructions.length).toBeGreaterThan(0);

				// Instructions should be strings
				for (const instruction of instructions) {
					expect(typeof instruction).toBe("string");
				}
			}
		});

		test("should include platform-specific instructions", async () => {
			const osInfo = await detectOS();
			const instructions = getManualInstructions("python", osInfo);
			const allText = instructions.join("\n");

			if (osInfo.platform === "darwin") {
				expect(allText).toContain("macOS");
			} else if (osInfo.platform === "linux") {
				expect(allText).toContain("Linux");
			} else if (osInfo.platform === "win32") {
				expect(allText).toContain("Windows");
			}
		});

		test("should include official documentation links", async () => {
			const osInfo = await detectOS();

			const claudeInstructions = getManualInstructions("claude", osInfo);
			expect(claudeInstructions.some((i) => i.includes("https://"))).toBe(true);

			const pythonInstructions = getManualInstructions("python", osInfo);
			expect(pythonInstructions.some((i) => i.includes("python.org"))).toBe(true);

			const nodeInstructions = getManualInstructions("nodejs", osInfo);
			expect(nodeInstructions.some((i) => i.includes("nodejs.org"))).toBe(true);
		});

		test("should include package manager commands when available", async () => {
			const osInfo = await detectOS();

			if (osInfo.platform === "darwin") {
				const instructions = getManualInstructions("python", osInfo);
				const allText = instructions.join("\n");
				expect(allText).toContain("brew");
			} else if (osInfo.platform === "linux" && osInfo.hasApt) {
				const instructions = getManualInstructions("python", osInfo);
				const allText = instructions.join("\n");
				expect(allText).toContain("apt");
			}
		});
	});

	describe("Edge cases", () => {
		test("should handle OS without package managers", async () => {
			const osInfoNoPackageManagers = {
				platform: "linux" as const,
				hasApt: false,
				hasDnf: false,
				hasPacman: false,
			};

			const methods = getInstallerMethods("python", osInfoNoPackageManagers);

			// Should still return some methods (possibly NodeSource or manual)
			// But won't include apt/dnf/pacman specific ones
			const hasApt = methods.some((m) => m.command.includes("apt"));
			const hasDnf = methods.some((m) => m.command.includes("dnf"));
			const hasPacman = methods.some((m) => m.command.includes("pacman"));

			expect(hasApt).toBe(false);
			expect(hasDnf).toBe(false);
			expect(hasPacman).toBe(false);
		});
	});
});
