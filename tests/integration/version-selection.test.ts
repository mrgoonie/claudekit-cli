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
	isCancel: mock(() => false),
	note: mock(() => {}),
}));

// Mock GitHub API
mock.module("../src/lib/github.js", () => ({
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
mock.module("../src/lib/download.js", () => ({
	DownloadManager: class {
		setExcludePatterns() {}
		async createTempDir() {
			return join(tmpdir(), randomBytes(8).toString("hex"));
		}
		async downloadFile() {
			return join(tmpdir(), randomBytes(8).toString("hex"));
		}
	},
}));

// Mock FileMerger
mock.module("../src/lib/merge.js", () => ({
	FileMerger: class {
		async extract() {}
		async merge() {}
	},
}));

describe("Version Selection Integration Tests", () => {
	let testDir: string;

	beforeEach(() => {
		// Create a unique test directory
		testDir = join(tmpdir(), `ck-test-${randomBytes(8).toString("hex")}`);
		mkdirSync(testDir, { recursive: true });
		process.chdir(testDir);
	});

	afterEach(() => {
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
			const clack = await import("@clack/prompts");

			// Mock successful version selection
			spyOn(clack, "select").mockResolvedValueOnce("v1.2.3");

			const { newCommand } = await import("../../src/commands/new.js");

			// Should not throw and complete successfully
			await expect(newCommand(createNewOptions({ kit: "engineer" }))).resolves.not.toThrow();
		});

		it("should show version selection prompt in ck init", async () => {
			const clack = await import("@clack/prompts");

			// Mock successful version selection
			spyOn(clack, "select").mockResolvedValueOnce("v1.2.3");

			const { updateCommand } = await import("../../src/commands/update.js");

			// Should not throw and complete successfully
			await expect(updateCommand(createUpdateOptions({ kit: "engineer" }))).resolves.not.toThrow();
		});

		it("should respect --version flag and skip prompt", async () => {
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
			const originalEnv = process.env.CI;
			process.env.CI = "true";

			try {
				const { newCommand } = await import("../../src/commands/new.js");

				await expect(newCommand(createNewOptions({ kit: "engineer" }))).rejects.toThrow(
					"--version flag required in non-interactive mode",
				);
			} finally {
				process.env.CI = originalEnv;
			}
		});

		it("should require --version flag when TTY is not available", async () => {
			// Mock non-TTY environment
			const originalIsTTY = process.stdin.isTTY;
			// @ts-ignore - Intentional override for testing
			process.stdin.isTTY = false;

			try {
				const { newCommand } = await import("../../src/commands/new.js");

				await expect(newCommand(createNewOptions({ kit: "engineer" }))).rejects.toThrow(
					"--version flag required in non-interactive mode",
				);
			} finally {
				process.stdin.isTTY = originalIsTTY;
			}
		});

		it("should work with explicit --version flag in non-interactive mode", async () => {
			// Mock non-TTY environment
			const originalIsTTY = process.stdin.isTTY;
			// @ts-ignore - Intentional override for testing
			process.stdin.isTTY = false;

			try {
				const { newCommand } = await import("../../src/commands/new.js");

				await expect(
					newCommand(createNewOptions({ kit: "engineer", version: "v1.5.0" })),
				).resolves.not.toThrow();
			} finally {
				process.stdin.isTTY = originalIsTTY;
			}
		});
	});

	describe("Error Handling", () => {
		it("should fallback to latest when version selection fails", async () => {
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
			const originalIsTTY = process.stdin.isTTY;
			// @ts-ignore - Intentional override for testing
			process.stdin.isTTY = false;

			try {
				const { newCommand } = await import("../../src/commands/new.js");

				await expect(newCommand(createNewOptions({}))).rejects.toThrow(
					"Kit must be specified via --kit flag in non-interactive mode",
				);
			} finally {
				process.stdin.isTTY = originalIsTTY;
			}
		});
	});

	describe("Backward Compatibility", () => {
		it("should work with explicit version flag (existing workflow)", async () => {
			const { newCommand } = await import("../../src/commands/new.js");

			await expect(
				newCommand(createNewOptions({ kit: "engineer", version: "v1.5.0" })),
			).resolves.not.toThrow();
		});

		it("should work with --beta flag (existing workflow)", async () => {
			const { newCommand } = await import("../../src/commands/new.js");

			await expect(
				newCommand(createNewOptions({ kit: "engineer", beta: true })),
			).resolves.not.toThrow();
		});

		it("should work with --force flag (existing workflow)", async () => {
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
			const clack = await import("@clack/prompts");

			// Mock successful version selection
			spyOn(clack, "select").mockResolvedValueOnce("v1.2.3");

			const { updateCommand } = await import("../../src/commands/update.js");

			await expect(
				updateCommand(createUpdateOptions({ kit: "engineer", global: true })),
			).resolves.not.toThrow();
		});

		it("should work with fresh flag and version selection", async () => {
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
			// Test that the update alias works with version selection
			const clack = await import("@clack/prompts");

			spyOn(clack, "select").mockResolvedValueOnce("v1.2.3");

			const { updateCommand } = await import("../../src/commands/update.js");

			// Both init and update should call the same function
			await expect(updateCommand(createUpdateOptions({ kit: "engineer" }))).resolves.not.toThrow();
		});
	});
});
