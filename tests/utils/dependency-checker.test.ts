import { describe, expect, test } from "bun:test";
import {
	DEPENDENCIES,
	checkAllDependencies,
	checkDependency,
	commandExists,
	compareVersions,
	getCommandPath,
	getCommandVersion,
} from "../../src/utils/dependency-checker.js";

describe("DependencyChecker", () => {
	describe("compareVersions", () => {
		test("should return true when versions are equal", () => {
			expect(compareVersions("1.0.0", "1.0.0")).toBe(true);
			expect(compareVersions("2.5.3", "2.5.3")).toBe(true);
		});

		test("should return true when current version is higher", () => {
			expect(compareVersions("2.0.0", "1.0.0")).toBe(true);
			expect(compareVersions("1.5.0", "1.4.0")).toBe(true);
			expect(compareVersions("1.0.5", "1.0.3")).toBe(true);
			expect(compareVersions("3.8.10", "3.8.0")).toBe(true);
		});

		test("should return false when current version is lower", () => {
			expect(compareVersions("1.0.0", "2.0.0")).toBe(false);
			expect(compareVersions("1.4.0", "1.5.0")).toBe(false);
			expect(compareVersions("1.0.3", "1.0.5")).toBe(false);
			expect(compareVersions("3.7.0", "3.8.0")).toBe(false);
		});

		test("should handle missing patch/minor versions", () => {
			expect(compareVersions("1.0", "1.0.0")).toBe(true);
			expect(compareVersions("1", "1.0.0")).toBe(true);
			expect(compareVersions("2", "1.9.9")).toBe(true);
		});
	});

	describe("commandExists", () => {
		test("should detect existing commands", async () => {
			// Test with common commands that should exist on most systems
			const nodeExists = await commandExists("node");
			const bunExists = await commandExists("bun");

			// At least one of these should exist in the test environment
			expect(nodeExists || bunExists).toBe(true);
		});

		test("should return false for non-existent commands", async () => {
			const exists = await commandExists("this-command-definitely-does-not-exist-12345");
			expect(exists).toBe(false);
		});
	});

	describe("getCommandPath", () => {
		test("should return path for existing commands", async () => {
			const bunExists = await commandExists("bun");
			if (bunExists) {
				const path = await getCommandPath("bun");
				expect(path).toBeDefined();
				expect(path).not.toBeNull();
				expect(typeof path).toBe("string");
			}
		});

		test("should return null for non-existent commands", async () => {
			const path = await getCommandPath("this-command-definitely-does-not-exist-12345");
			expect(path).toBeNull();
		});
	});

	describe("getCommandVersion", () => {
		test("should extract version from bun command", async () => {
			const bunExists = await commandExists("bun");
			if (bunExists) {
				const version = await getCommandVersion("bun", "--version", /(\d+\.\d+\.\d+)/);
				expect(version).toBeDefined();
				expect(version).not.toBeNull();
				expect(version).toMatch(/^\d+\.\d+\.\d+/);
			}
		});

		test("should handle Python version format", async () => {
			const python3Exists = await commandExists("python3");
			if (python3Exists) {
				const version = await getCommandVersion("python3", "--version", /Python (\d+\.\d+\.\d+)/);
				if (version) {
					expect(version).toMatch(/^\d+\.\d+\.\d+/);
				}
			}
		});

		test("should return null for commands that don't support version flag", async () => {
			const version = await getCommandVersion("echo", "--invalid-flag", /(\d+\.\d+\.\d+)/);
			expect(version).toBeNull();
		});
	});

	describe("checkDependency", () => {
		test("should check if a dependency is installed", async () => {
			// Check a dependency that's likely installed (bun, since we're using it for tests)
			const bunExists = await commandExists("bun");
			if (bunExists) {
				const bunConfig = {
					name: "bun" as any,
					commands: ["bun"],
					versionFlag: "--version",
					versionRegex: /(\d+\.\d+\.\d+)/,
					minVersion: "1.0.0",
					required: true,
				};

				const status = await checkDependency(bunConfig);
				expect(status.installed).toBe(true);
				expect(status.version).toBeDefined();
				expect(status.path).toBeDefined();
			}
		});

		test("should return installed: false for non-existent dependency", async () => {
			const config = {
				name: "nonexistent" as any,
				commands: ["this-does-not-exist-12345"],
				versionFlag: "--version",
				versionRegex: /(\d+\.\d+\.\d+)/,
				required: false,
			};

			const status = await checkDependency(config);
			expect(status.installed).toBe(false);
			expect(status.meetsRequirements).toBe(false);
			expect(status.message).toContain("not found");
		});

		test("should check version requirements", async () => {
			const bunExists = await commandExists("bun");
			if (bunExists) {
				const config = {
					name: "bun" as any,
					commands: ["bun"],
					versionFlag: "--version",
					versionRegex: /(\d+\.\d+\.\d+)/,
					minVersion: "0.1.0", // Very low version, should pass
					required: true,
				};

				const status = await checkDependency(config);
				expect(status.installed).toBe(true);
				expect(status.meetsRequirements).toBe(true);
			}
		});

		test("should detect outdated versions", async () => {
			const bunExists = await commandExists("bun");
			if (bunExists) {
				const config = {
					name: "bun" as any,
					commands: ["bun"],
					versionFlag: "--version",
					versionRegex: /(\d+\.\d+\.\d+)/,
					minVersion: "999.0.0", // Impossible version
					required: true,
				};

				const status = await checkDependency(config);
				expect(status.installed).toBe(true);
				expect(status.meetsRequirements).toBe(false);
				expect(status.message).toContain("below minimum");
			}
		});

		test("should try multiple command variants", async () => {
			// Python might be available as python3 or python
			const python3Exists = await commandExists("python3");
			const pythonExists = await commandExists("python");

			if (python3Exists || pythonExists) {
				const status = await checkDependency(DEPENDENCIES.python);
				expect(status.installed).toBe(true);
			}
		});
	});

	describe("checkAllDependencies", () => {
		test("should check all defined dependencies", async () => {
			const statuses = await checkAllDependencies();

			// Should check all 4 dependencies (claude, python, pip, nodejs)
			expect(statuses).toHaveLength(4);

			// Each status should have required properties
			for (const status of statuses) {
				expect(status).toHaveProperty("name");
				expect(status).toHaveProperty("installed");
				expect(status).toHaveProperty("meetsRequirements");
				expect(typeof status.installed).toBe("boolean");
				expect(typeof status.meetsRequirements).toBe("boolean");
			}
		});

		test("should include all expected dependencies", async () => {
			const statuses = await checkAllDependencies();
			const names = statuses.map((s) => s.name);

			expect(names).toContain("claude");
			expect(names).toContain("python");
			expect(names).toContain("pip");
			expect(names).toContain("nodejs");
		});
	});

	describe("DEPENDENCIES configuration", () => {
		test("should have correct structure for all dependencies", () => {
			const deps = Object.values(DEPENDENCIES);

			for (const dep of deps) {
				expect(dep).toHaveProperty("name");
				expect(dep).toHaveProperty("commands");
				expect(dep).toHaveProperty("versionFlag");
				expect(dep).toHaveProperty("versionRegex");
				expect(dep).toHaveProperty("required");

				expect(Array.isArray(dep.commands)).toBe(true);
				expect(dep.commands.length).toBeGreaterThan(0);
				expect(typeof dep.versionFlag).toBe("string");
				expect(dep.versionRegex).toBeInstanceOf(RegExp);
				expect(typeof dep.required).toBe("boolean");
			}
		});

		test("should have correct minimum versions", () => {
			expect(DEPENDENCIES.claude.minVersion).toBe("1.0.0");
			expect(DEPENDENCIES.python.minVersion).toBe("3.8.0");
			expect(DEPENDENCIES.nodejs.minVersion).toBe("16.0.0");
			expect(DEPENDENCIES.pip.minVersion).toBeUndefined();
		});

		test("should mark correct dependencies as required", () => {
			expect(DEPENDENCIES.claude.required).toBe(false);
			expect(DEPENDENCIES.python.required).toBe(true);
			expect(DEPENDENCIES.pip.required).toBe(true);
			expect(DEPENDENCIES.nodejs.required).toBe(true);
		});
	});
});
