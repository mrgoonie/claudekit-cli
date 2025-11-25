import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { NewCommandOptions, UpdateCommandOptions } from "../../src/types.js";

// Test helper to create NewCommandOptions with defaults
const createNewOptions = (overrides: Partial<NewCommandOptions> = {}): NewCommandOptions => ({
	dir: ".",
	force: false,
	exclude: [],
	opencode: false,
	gemini: false,
	installSkills: false,
	prefix: false,
	beta: false,
	...overrides,
});

// Test helper to create UpdateCommandOptions with defaults
const createUpdateOptions = (
	overrides: Partial<UpdateCommandOptions> = {},
): UpdateCommandOptions => ({
	dir: ".",
	exclude: [],
	only: [],
	global: false,
	fresh: false,
	installSkills: false,
	prefix: false,
	beta: false,
	...overrides,
});

// Mock the CLI to test version selection
mock.module("@clack/prompts", () => ({
	spinner: () => ({
		start: mock(() => {}),
		stop: mock(() => {}),
	}),
	select: mock(() => Promise.resolve("v1.0.0")),
	confirm: mock(() => Promise.resolve(true)),
	text: mock(() => Promise.resolve("test-project")),
	password: mock(() => Promise.resolve("ghp_test_token")),
	isCancel: mock(() => false),
	note: mock(() => {}),
}));

// Mock AuthManager to prevent actual token prompts in CI
mock.module("../../src/lib/auth.js", () => ({
	AuthManager: {
		getToken: mock(() => Promise.resolve({ token: "ghp_test_token", method: "env-var" })),
		clearToken: mock(() => Promise.resolve()),
		isValidTokenFormat: mock(() => true),
	},
}));

// Mock ConfigManager to prevent file system operations
mock.module("../../src/utils/config.js", () => ({
	ConfigManager: {
		get: mock(() => Promise.resolve({ defaults: {} })),
		getToken: mock(() => Promise.resolve(null)),
		setGlobalFlag: mock(() => {}),
		isGlobal: mock(() => false),
		load: mock(() => Promise.resolve({ defaults: {} })),
		save: mock(() => Promise.resolve()),
		set: mock(() => Promise.resolve()),
	},
}));

// Mock GitHub API
mock.module("../../src/lib/github.js", () => ({
	GitHubClient: class {
		async checkAccess() {
			return true;
		}
		async getReleaseByTag(_kit: any, tag: string) {
			return {
				id: 1,
				tag_name: tag,
				name: "Test Release",
				draft: false,
				prerelease: tag.includes("beta"),
				assets: [],
				published_at: "2024-01-01T00:00:00Z",
				tarball_url: "https://example.com/tarball",
				zipball_url: "https://example.com/zipball",
			};
		}
		async getLatestRelease(_kit: any, beta = false) {
			return {
				id: 1,
				tag_name: beta ? "v1.0.0-beta" : "v1.0.0",
				name: beta ? "Beta Release" : "Latest Release",
				draft: false,
				prerelease: beta,
				assets: [],
				published_at: "2024-01-01T00:00:00Z",
				tarball_url: "https://example.com/tarball",
				zipball_url: "https://example.com/zipball",
			};
		}
		static getDownloadableAsset() {
			return {
				type: "tarball",
				url: "https://example.com/tarball",
				name: "test.tar.gz",
			};
		}
	},
}));

// Mock DownloadManager
mock.module("../../src/lib/download.js", () => ({
	DownloadManager: class {
		setExcludePatterns() {}
		async createTempDir() {
			return join(tmpdir(), randomBytes(8).toString("hex"));
		}
		async downloadFile() {
			return join(tmpdir(), randomBytes(8).toString("hex"));
		}
		async extractArchive() {}
		async validateExtraction() {}
	},
}));

// Mock FileMerger
mock.module("../../src/lib/merge.js", () => ({
	FileMerger: class {
		addIgnorePatterns() {}
		setIncludePatterns() {}
		setGlobalFlag() {}
		async extract() {}
		async merge() {}
	},
}));

// Mock PromptsManager to prevent interactive prompts
mock.module("../../src/lib/prompts.js", () => ({
	PromptsManager: class {
		intro() {}
		outro() {}
		note() {}
		async selectKit() {
			return "engineer";
		}
		async selectVersion() {
			return "v1.0.0";
		}
		async selectVersionEnhanced() {
			return "v1.0.0";
		}
		async getLatestVersion() {
			return "v1.0.0";
		}
		async getDirectory() {
			return ".";
		}
		async confirm() {
			return true;
		}
		async promptPackageInstallations() {
			return { installOpenCode: false, installGemini: false };
		}
		async promptSkillsInstallation() {
			return false;
		}
		async promptUpdateMode() {
			return true; // Update everything
		}
		async promptDirectorySelection() {
			return [];
		}
		showPackageInstallationResults() {}
	},
}));

// Mock safe-spinner to prevent console output
mock.module("../../src/utils/safe-spinner.js", () => ({
	createSpinner: () => ({
		start: () => ({
			succeed: () => {},
			fail: () => {},
			stop: () => {},
		}),
	}),
}));

// Mock CommandsPrefix
mock.module("../../src/lib/commands-prefix.js", () => ({
	CommandsPrefix: {
		shouldApplyPrefix: () => false,
		applyPrefix: async () => {},
		cleanupCommandsDirectory: async () => {},
	},
}));

// Mock package-installer
mock.module("../../src/utils/package-installer.js", () => ({
	processPackageInstallations: async () => ({ opencode: null, gemini: null }),
	handleSkillsInstallation: async () => {},
}));

// Mock file-scanner
mock.module("../../src/utils/file-scanner.js", () => ({
	FileScanner: {
		findCustomFiles: async () => [],
	},
}));

// Mock path-resolver
mock.module("../../src/utils/path-resolver.js", () => ({
	PathResolver: {
		getGlobalKitDir: () => join(tmpdir(), "ck-test-global"),
		getConfigDir: () => join(tmpdir(), "ck-test-config"),
		getConfigFile: () => join(tmpdir(), "ck-test-config", "config.json"),
	},
}));

// Mock fresh-installer
mock.module("../../src/lib/fresh-installer.js", () => ({
	handleFreshInstallation: async () => true,
}));

// Mock skills-detector
mock.module("../../src/lib/skills-detector.js", () => ({
	SkillsMigrationDetector: {
		detectMigration: async () => ({ status: "not_needed" }),
	},
}));

// Mock skills-migrator
mock.module("../../src/lib/skills-migrator.js", () => ({
	SkillsMigrator: {
		migrate: async () => ({ success: true }),
	},
}));

// Skip integration tests in CI as they require interactive TTY
const isCI = process.env.CI === "true" || process.env.NON_INTERACTIVE === "true";
const describeOrSkip = isCI ? describe.skip : describe;

describeOrSkip("Version Selection Integration Tests", () => {
	let testDir: string;
	let originalCI: string | undefined;
	let originalNonInteractive: string | undefined;
	let originalIsTTY: boolean | undefined;

	beforeEach(() => {
		// Create a unique test directory
		testDir = join(tmpdir(), `ck-test-${randomBytes(8).toString("hex")}`);
		mkdirSync(testDir, { recursive: true });
		process.chdir(testDir);

		// Save original environment
		originalCI = process.env.CI;
		originalNonInteractive = process.env.NON_INTERACTIVE;
		originalIsTTY = process.stdin.isTTY;
	});

	afterEach(() => {
		// Restore original environment
		if (originalCI !== undefined) {
			process.env.CI = originalCI;
		} else {
			delete process.env.CI;
		}
		if (originalNonInteractive !== undefined) {
			process.env.NON_INTERACTIVE = originalNonInteractive;
		} else {
			delete process.env.NON_INTERACTIVE;
		}
		// @ts-ignore - Restore original isTTY
		process.stdin.isTTY = originalIsTTY;

		// Clean up test directory
		try {
			process.chdir("/");
			if (existsSync(testDir)) {
				rmSync(testDir, { recursive: true, force: true });
			}
		} catch (error) {
			// Ignore cleanup errors
		}
	});

	describe("Interactive Mode Version Selection", () => {
		it("should show version selection prompt in ck new", async () => {
			// Simulate interactive environment
			delete process.env.CI;
			delete process.env.NON_INTERACTIVE;
			// @ts-ignore - Mock TTY
			process.stdin.isTTY = true;

			const clack = await import("@clack/prompts");

			// Mock successful version selection
			spyOn(clack, "select").mockResolvedValueOnce("v1.2.3");

			const { newCommand } = await import("../../src/commands/new.js");

			// Should not throw and complete successfully
			await expect(newCommand(createNewOptions({ kit: "engineer" }))).resolves.not.toThrow();
		});

		it("should show version selection prompt in ck init", async () => {
			// Simulate interactive environment
			delete process.env.CI;
			delete process.env.NON_INTERACTIVE;
			// @ts-ignore - Mock TTY
			process.stdin.isTTY = true;

			const clack = await import("@clack/prompts");

			// Mock successful version selection
			spyOn(clack, "select").mockResolvedValueOnce("v1.2.3");

			const { updateCommand } = await import("../../src/commands/update.js");

			// Should not throw and complete successfully
			await expect(updateCommand(createUpdateOptions({ kit: "engineer" }))).resolves.not.toThrow();
		});

		it("should respect --version flag and skip prompt", async () => {
			// Simulate interactive environment
			delete process.env.CI;
			delete process.env.NON_INTERACTIVE;
			// @ts-ignore - Mock TTY
			process.stdin.isTTY = true;

			const clack = await import("@clack/prompts");

			// Verify select is never called when version is specified
			const selectSpy = spyOn(clack, "select");

			const { newCommand } = await import("../../src/commands/new.js");

			await expect(
				newCommand(createNewOptions({ kit: "engineer", version: "v1.5.0" })),
			).resolves.not.toThrow();

			// select should not be called when version is specified
			expect(selectSpy).not.toHaveBeenCalled();
		});

		it("should show beta versions when --beta flag is used", async () => {
			// Simulate interactive environment
			delete process.env.CI;
			delete process.env.NON_INTERACTIVE;
			// @ts-ignore - Mock TTY
			process.stdin.isTTY = true;

			const clack = await import("@clack/prompts");

			// Mock version selection with beta versions
			spyOn(clack, "select").mockResolvedValueOnce("v1.0.0-beta");

			const { newCommand } = await import("../../src/commands/new.js");

			await expect(
				newCommand(createNewOptions({ kit: "engineer", beta: true })),
			).resolves.not.toThrow();

			// Verify select was called
			expect(clack.select).toHaveBeenCalled();
		});

		it("should cancel gracefully when user cancels version selection", async () => {
			// Simulate interactive environment
			delete process.env.CI;
			delete process.env.NON_INTERACTIVE;
			// @ts-ignore - Mock TTY
			process.stdin.isTTY = true;

			const clack = await import("@clack/prompts");

			// Mock cancellation
			spyOn(clack, "select").mockResolvedValueOnce(undefined);
			spyOn(clack, "isCancel").mockReturnValue(true);

			const { newCommand } = await import("../../src/commands/new.js");

			// Should complete without throwing (early exit)
			await newCommand(createNewOptions({ kit: "engineer" }));
		});
	});

	describe("Non-Interactive Mode", () => {
		it("should require --version flag in CI mode", async () => {
			// Mock CI environment
			process.env.CI = "true";

			const { newCommand } = await import("../../src/commands/new.js");

			await expect(newCommand(createNewOptions({ kit: "engineer" }))).rejects.toThrow(
				"--version flag required in non-interactive mode",
			);
		});

		it("should require --version flag when TTY is not available", async () => {
			// Mock non-TTY environment
			// @ts-ignore - Intentional override for testing
			process.stdin.isTTY = false;

			const { newCommand } = await import("../../src/commands/new.js");

			await expect(newCommand(createNewOptions({ kit: "engineer" }))).rejects.toThrow(
				"--version flag required in non-interactive mode",
			);
		});

		it("should work with explicit --version flag in non-interactive mode", async () => {
			// Mock non-TTY environment
			// @ts-ignore - Intentional override for testing
			process.stdin.isTTY = false;

			const { newCommand } = await import("../../src/commands/new.js");

			await expect(
				newCommand(createNewOptions({ kit: "engineer", version: "v1.5.0" })),
			).resolves.not.toThrow();
		});
	});

	describe("Error Handling", () => {
		it("should fallback to latest when version selection fails", async () => {
			// Simulate interactive environment
			delete process.env.CI;
			delete process.env.NON_INTERACTIVE;
			// @ts-ignore - Mock TTY
			process.stdin.isTTY = true;

			const clack = await import("@clack/prompts");

			// Mock version selection failure
			spyOn(clack, "select").mockImplementationOnce(() => {
				throw new Error("API Error");
			});

			const { newCommand } = await import("../../src/commands/new.js");

			// Should not throw and fall back to latest
			await expect(newCommand(createNewOptions({ kit: "engineer" }))).resolves.not.toThrow();
		});

		it("should handle kit selection requirement", async () => {
			// Mock non-interactive mode without kit or version
			process.env.CI = "true";
			// @ts-ignore - Intentional override for testing
			process.stdin.isTTY = false;

			const { newCommand } = await import("../../src/commands/new.js");

			await expect(newCommand(createNewOptions({}))).rejects.toThrow(
				"Kit must be specified via --kit flag in non-interactive mode",
			);
		});
	});

	describe("Backward Compatibility", () => {
		it("should work with explicit version flag (existing workflow)", async () => {
			// Simulate interactive environment for backward compatibility tests
			delete process.env.CI;
			delete process.env.NON_INTERACTIVE;
			// @ts-ignore - Mock TTY
			process.stdin.isTTY = true;

			const { newCommand } = await import("../../src/commands/new.js");

			await expect(
				newCommand(createNewOptions({ kit: "engineer", version: "v1.5.0" })),
			).resolves.not.toThrow();
		});

		it("should work with --beta flag (existing workflow)", async () => {
			// Simulate interactive environment for backward compatibility tests
			delete process.env.CI;
			delete process.env.NON_INTERACTIVE;
			// @ts-ignore - Mock TTY
			process.stdin.isTTY = true;

			const { newCommand } = await import("../../src/commands/new.js");

			await expect(
				newCommand(createNewOptions({ kit: "engineer", beta: true })),
			).resolves.not.toThrow();
		});

		it("should work with --force flag (existing workflow)", async () => {
			// Simulate interactive environment for backward compatibility tests
			delete process.env.CI;
			delete process.env.NON_INTERACTIVE;
			// @ts-ignore - Mock TTY
			process.stdin.isTTY = true;

			// Create some files to test force behavior
			const { writeFileSync } = await import("node:fs");
			writeFileSync(join(testDir, "existing-file.txt"), "test content");

			const { newCommand } = await import("../../src/commands/new.js");

			await expect(
				newCommand(createNewOptions({ kit: "engineer", force: true })),
			).resolves.not.toThrow();
		});
	});

	describe("Update Command Specific Tests", () => {
		it("should work with global flag and version selection", async () => {
			// Simulate interactive environment
			delete process.env.CI;
			delete process.env.NON_INTERACTIVE;
			// @ts-ignore - Mock TTY
			process.stdin.isTTY = true;

			const clack = await import("@clack/prompts");

			// Mock successful version selection
			spyOn(clack, "select").mockResolvedValueOnce("v1.2.3");

			const { updateCommand } = await import("../../src/commands/update.js");

			await expect(
				updateCommand(createUpdateOptions({ kit: "engineer", global: true })),
			).resolves.not.toThrow();
		});

		it("should work with fresh flag and version selection", async () => {
			// Simulate interactive environment
			delete process.env.CI;
			delete process.env.NON_INTERACTIVE;
			// @ts-ignore - Mock TTY
			process.stdin.isTTY = true;

			const clack = await import("@clack/prompts");

			// Mock successful version selection
			spyOn(clack, "select").mockResolvedValueOnce("v1.2.3");
			spyOn(clack, "confirm").mockResolvedValueOnce(true);

			const { updateCommand } = await import("../../src/commands/update.js");

			await expect(
				updateCommand(createUpdateOptions({ kit: "engineer", fresh: true })),
			).resolves.not.toThrow();
		});
	});

	describe("Alias Compatibility", () => {
		it("should recognize update alias for init command", async () => {
			// Simulate interactive environment
			delete process.env.CI;
			delete process.env.NON_INTERACTIVE;
			// @ts-ignore - Mock TTY
			process.stdin.isTTY = true;

			// Test that the update alias works with version selection
			const clack = await import("@clack/prompts");

			spyOn(clack, "select").mockResolvedValueOnce("v1.2.3");

			const { updateCommand } = await import("../../src/commands/update.js");

			// Both init and update should call the same function
			await expect(updateCommand(createUpdateOptions({ kit: "engineer" }))).resolves.not.toThrow();
		});
	});
});
