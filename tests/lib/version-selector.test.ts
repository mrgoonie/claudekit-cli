import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { VersionSelector, type VersionSelectorOptions } from "../../src/lib/version-selector.js";
import { GitHubClient } from "../../src/lib/github.js";

// Mock clack prompts
mock.module("@clack/prompts", () => ({
	spinner: () => ({
		start: mock(() => {}),
		stop: mock(() => {}),
	}),
	select: mock(() => Promise.resolve("v1.0.0")),
	confirm: mock(() => Promise.resolve(false)),
	text: mock(() => Promise.resolve("v1.0.0")),
	isCancel: mock(() => false),
	note: mock(() => {}),
}));

// Mock picocolors
mock.module("picocolors", () => ({
	bold: mock((text: string) => text),
	green: mock((text: string) => text),
	red: mock((text: string) => text),
	yellow: mock((text: string) => text),
	magenta: mock((text: string) => text),
	blue: mock((text: string) => text),
	dim: mock((text: string) => text),
	gray: mock((text: string) => text),
	cyan: mock((text: string) => text),
}));

describe("VersionSelector", () => {
	let versionSelector: VersionSelector;
	const mockKit = {
		name: "Test Kit",
		repo: "test-repo",
		owner: "test-owner",
		description: "Test description",
	};

	const mockRelease = {
		id: 1,
		tag_name: "v1.0.0",
		name: "Test Release",
		draft: false,
		prerelease: false,
		assets: [],
		published_at: "2024-01-01T00:00:00Z",
		tarball_url: "https://example.com/tarball",
		zipball_url: "https://example.com/zipball",
		displayVersion: "v1.0.0",
		normalizedVersion: "1.0.0",
		relativeTime: "1 day ago",
		isLatestStable: true,
		isLatestBeta: false,
		assetCount: 0,
	};

	beforeEach(() => {
		versionSelector = new VersionSelector();
		mockGitHubClient = new GitHubClient();
	});

	afterEach(() => {
		mock.restore();
	});

	describe("selectVersion", () => {
		it("should return selected version", async () => {
			const clack = await import("@clack/prompts");
			spyOn(clack, "select").mockResolvedValue("v1.0.0");

			// Mock GitHubClient
			spyOn(versionSelector as any, "githubClient", "get").mockReturnValue({
				listReleasesWithCache: mock(() => Promise.resolve([mockRelease])),
			});

			const options: VersionSelectorOptions = {
				kit: mockKit,
				includePrereleases: false,
			};

			const result = await versionSelector.selectVersion(options);
			expect(result).toBe("v1.0.0");
		});

		it("should return null when cancelled", async () => {
			const clack = await import("@clack/prompts");
			spyOn(clack, "select").mockResolvedValue(undefined);
			spyOn(clack, "isCancel").mockReturnValue(true);

			spyOn(versionSelector as any, "githubClient", "get").mockReturnValue({
				listReleasesWithCache: mock(() => Promise.resolve([mockRelease])),
			});

			const options: VersionSelectorOptions = {
				kit: mockKit,
			};

			const result = await versionSelector.selectVersion(options);
			expect(result).toBeNull();
		});

		it("should handle no releases found", async () => {
			const clack = await import("@clack/prompts");
			spyOn(clack, "confirm").mockResolvedValue(false);

			spyOn(versionSelector as any, "githubClient", "get").mockReturnValue({
				listReleasesWithCache: mock(() => Promise.resolve([])),
			});

			const options: VersionSelectorOptions = {
				kit: mockKit,
				allowManualEntry: false,
			};

			await expect(versionSelector.selectVersion(options)).rejects.toThrow("No releases available");
		});

		it("should allow manual entry when enabled", async () => {
			const clack = await import("@clack/prompts");
			spyOn(clack, "confirm").mockResolvedValue(true);
			spyOn(clack, "text").mockResolvedValue("v2.0.0");

			spyOn(versionSelector as any, "githubClient", "get").mockReturnValue({
				listReleasesWithCache: mock(() => Promise.resolve([])),
			});

			const options: VersionSelectorOptions = {
				kit: mockKit,
				allowManualEntry: true,
			};

			const result = await versionSelector.selectVersion(options);
			expect(result).toBe("v2.0.0");
		});

		it("should handle manual entry validation", async () => {
			const clack = await import("@clack/prompts");
			spyOn(clack, "confirm").mockResolvedValue(true);
			spyOn(clack, "text").mockResolvedValue("invalid-version");

			spyOn(versionSelector as any, "githubClient", "get").mockReturnValue({
				listReleasesWithCache: mock(() => Promise.resolve([])),
			});

			const options: VersionSelectorOptions = {
				kit: mockKit,
				allowManualEntry: true,
			};

			// The text prompt should be called again due to validation failure
			await expect(versionSelector.selectVersion(options)).rejects.toThrow();
		});
	});

	describe("getLatestVersion", () => {
		it("should return latest stable version", async () => {
			spyOn(versionSelector as any, "githubClient", "get").mockReturnValue({
				listReleasesWithCache: mock(() => Promise.resolve([mockRelease])),
			});

			const result = await versionSelector.getLatestVersion(mockKit);
			expect(result).toBe("v1.0.0");
		});

		it("should return null when no releases found", async () => {
			spyOn(versionSelector as any, "githubClient", "get").mockReturnValue({
				listReleasesWithCache: mock(() => Promise.resolve([])),
			});

			const result = await versionSelector.getLatestVersion(mockKit);
			expect(result).toBeNull();
		});

		it("should include prereleases when requested", async () => {
			const clack = await import("@clack/prompts");
			const githubClient = versionSelector as any;

			spyOn(githubClient, "githubClient", "get").mockReturnValue({
				listReleasesWithCache: mock((kit, options) => {
					expect(options.includePrereleases).toBe(true);
					return Promise.resolve([mockRelease]);
				}),
			});

			await versionSelector.getLatestVersion(mockKit, true);
		});
	});

	describe("error handling", () => {
		it("should handle authentication errors", async () => {
			const clack = await import("@clack/prompts");
			spyOn(clack, "confirm").mockResolvedValue(false);
			spyOn(clack, "note").mockImplementation(() => {});

			const authError = new Error("Authentication failed (401)");
			spyOn(versionSelector as any, "githubClient", "get").mockReturnValue({
				listReleasesWithCache: mock(() => Promise.reject(authError)),
			});

			const options: VersionSelectorOptions = {
				kit: mockKit,
				allowManualEntry: false,
			};

			const result = await versionSelector.selectVersion(options);
			expect(result).toBeNull();
		});

		it("should handle network errors", async () => {
			const clack = await import("@clack/prompts");
			spyOn(clack, "confirm").mockResolvedValue(false);
			spyOn(clack, "note").mockImplementation(() => {});

			const networkError = new Error("Network error");
			spyOn(versionSelector as any, "githubClient", "get").mockReturnValue({
				listReleasesWithCache: mock(() => Promise.reject(networkError)),
			});

			const options: VersionSelectorOptions = {
				kit: mockKit,
				allowManualEntry: false,
			};

			const result = await versionSelector.selectVersion(options);
			expect(result).toBeNull();
		});

		it("should offer retry on errors", async () => {
			const clack = await import("@clack/prompts");
			spyOn(clack, "confirm").mockResolvedValue(true); // Retry
			spyOn(clack, "select").mockResolvedValue("v1.0.0"); // Success on retry
			spyOn(clack, "note").mockImplementation(() => {});

			const error = new Error("Temporary error");
			const githubClient = versionSelector as any;

			let callCount = 0;
			spyOn(githubClient, "githubClient", "get").mockReturnValue({
				listReleasesWithCache: mock(() => {
					callCount++;
					if (callCount === 1) {
						return Promise.reject(error);
					}
					return Promise.resolve([mockRelease]);
				}),
			});

			const options: VersionSelectorOptions = {
				kit: mockKit,
				allowManualEntry: false,
			};

			const result = await versionSelector.selectVersion(options);
			expect(result).toBe("v1.0.0");
		});
	});

	describe("manual version entry", () => {
		it("should validate version format", async () => {
			const clack = await import("@clack/prompts");
			spyOn(clack, "confirm").mockResolvedValueOnce(true); // Try manual entry
			spyOn(clack, "text").mockResolvedValue("invalid");

			spyOn(versionSelector as any, "githubClient", "get").mockReturnValue({
				listReleasesWithCache: mock(() => Promise.resolve([])),
			});

			const options: VersionSelectorOptions = {
				kit: mockKit,
				allowManualEntry: true,
			};

			// Should fail validation
			await expect(versionSelector.selectVersion(options)).rejects.toThrow();
		});

		it("should accept valid version formats", async () => {
			const clack = await import("@clack/prompts");
			spyOn(clack, "confirm").mockResolvedValueOnce(true); // Try manual entry
			spyOn(clack, "text").mockResolvedValue("v1.2.3");

			spyOn(versionSelector as any, "githubClient", "get").mockReturnValue({
				listReleasesWithCache: mock(() => Promise.resolve([])),
			});

			const options: VersionSelectorOptions = {
				kit: mockKit,
				allowManualEntry: true,
			};

			const result = await versionSelector.selectVersion(options);
			expect(result).toBe("v1.2.3");
		});
	});
});