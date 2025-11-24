import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { VersionSelector, type VersionSelectorOptions } from "../../src/lib/version-selector.js";

// Initialize mocks - these are mutable mock functions used by module mock
const mockSelectFn = mock((_opts?: any) => Promise.resolve("v1.0.0"));
const mockConfirmFn = mock((_opts?: any) => Promise.resolve(false));
const mockTextFn = mock((_opts?: any) => Promise.resolve("v1.0.0"));
const mockIsCancelFn = mock((value?: any) => value === null || value === undefined);
const mockNoteFn = mock((_message?: any, _title?: any) => {});
const mockSpinnerStartFn = mock((_msg?: any) => {});
const mockSpinnerStopFn = mock((_msg?: any) => {});

// Mock clack prompts module
mock.module("@clack/prompts", () => ({
	spinner: () => ({
		start: mockSpinnerStartFn,
		stop: mockSpinnerStopFn,
	}),
	select: (opts: any) => mockSelectFn(opts),
	confirm: (opts: any) => mockConfirmFn(opts),
	text: (opts: any) => mockTextFn(opts),
	isCancel: (value: any) => mockIsCancelFn(value),
	note: (message: any, title: any) => mockNoteFn(message, title),
}));

// Mock picocolors - passthrough
mock.module("picocolors", () => ({
	bold: (text: string) => text,
	green: (text: string) => text,
	red: (text: string) => text,
	yellow: (text: string) => text,
	magenta: (text: string) => text,
	blue: (text: string) => text,
	dim: (text: string) => text,
	gray: (text: string) => text,
	cyan: (text: string) => text,
}));

// Mock logger
mock.module("../../src/utils/logger.js", () => ({
	logger: {
		debug: mock(() => {}),
		info: mock(() => {}),
		warn: mock(() => {}),
		error: mock(() => {}),
		success: mock(() => {}),
	},
}));

describe("VersionSelector", () => {
	let versionSelector: VersionSelector;
	let mockGitHubClient: any;

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
		// Reset all mocks to defaults
		mockSelectFn.mockReset().mockImplementation(() => Promise.resolve("v1.0.0"));
		mockConfirmFn.mockReset().mockImplementation(() => Promise.resolve(false));
		mockTextFn.mockReset().mockImplementation(() => Promise.resolve("v1.0.0"));
		mockIsCancelFn
			.mockReset()
			.mockImplementation((value: any) => value === null || value === undefined);
		mockNoteFn.mockReset().mockImplementation(() => {});

		// Create mock GitHub client
		mockGitHubClient = {
			listReleasesWithCache: mock(() => Promise.resolve([mockRelease])),
			getVersionsByPattern: mock(() => Promise.resolve([])),
			clearReleaseCache: mock(() => Promise.resolve()),
		};

		versionSelector = new VersionSelector(mockGitHubClient);
	});

	afterEach(() => {
		// No mock.restore() - keep module mocks intact
	});

	describe("selectVersion", () => {
		it("should return selected version", async () => {
			mockSelectFn.mockImplementation(() => Promise.resolve("v1.0.0"));

			const options: VersionSelectorOptions = {
				kit: mockKit,
				includePrereleases: false,
			};

			const result = await versionSelector.selectVersion(options);
			expect(result).toBe("v1.0.0");
		});

		it("should return null when cancelled", async () => {
			mockSelectFn.mockImplementation(() => Promise.resolve(undefined as any));
			mockIsCancelFn.mockImplementation(() => true);

			const options: VersionSelectorOptions = {
				kit: mockKit,
			};

			const result = await versionSelector.selectVersion(options);
			expect(result).toBeNull();
		});

		it("should handle no releases found", async () => {
			mockGitHubClient.listReleasesWithCache = mock(() => Promise.resolve([]));
			mockConfirmFn.mockImplementation(() => Promise.resolve(false));

			const options: VersionSelectorOptions = {
				kit: mockKit,
				allowManualEntry: false,
			};

			await expect(versionSelector.selectVersion(options)).rejects.toThrow("No releases available");
		});

		it("should allow manual entry when enabled", async () => {
			// Empty releases triggers manual entry flow
			mockGitHubClient.listReleasesWithCache = mock(() => Promise.resolve([]));
			// User confirms they want to enter manually
			mockConfirmFn.mockImplementation(() => Promise.resolve(true));
			// User enters version
			mockTextFn.mockImplementation(() => Promise.resolve("v2.0.0"));

			const options: VersionSelectorOptions = {
				kit: mockKit,
				allowManualEntry: true,
			};

			const result = await versionSelector.selectVersion(options);
			expect(result).toBe("v2.0.0");
		});

		it("should handle manual entry cancellation", async () => {
			mockGitHubClient.listReleasesWithCache = mock(() => Promise.resolve([]));
			mockConfirmFn.mockImplementation(() => Promise.resolve(true));
			// User cancels text input
			mockTextFn.mockImplementation(() => Promise.resolve(null as any));
			mockIsCancelFn.mockImplementation((v) => v === null);

			const options: VersionSelectorOptions = {
				kit: mockKit,
				allowManualEntry: true,
			};

			const result = await versionSelector.selectVersion(options);
			expect(result).toBeNull();
		});
	});

	describe("getLatestVersion", () => {
		it("should return latest stable version", async () => {
			const result = await versionSelector.getLatestVersion(mockKit);
			expect(result).toBe("v1.0.0");
		});

		it("should return null when no releases found", async () => {
			mockGitHubClient.listReleasesWithCache = mock(() => Promise.resolve([]));

			const result = await versionSelector.getLatestVersion(mockKit);
			expect(result).toBeNull();
		});

		it("should include prereleases when requested", async () => {
			mockGitHubClient.listReleasesWithCache = mock((_kit: any, opts: any) => {
				expect(opts.includePrereleases).toBe(true);
				return Promise.resolve([mockRelease]);
			});

			await versionSelector.getLatestVersion(mockKit, true);
		});
	});

	describe("error handling", () => {
		it("should handle authentication errors", async () => {
			const authError = new Error("Authentication failed (401)");
			mockGitHubClient.listReleasesWithCache = mock(() => Promise.reject(authError));
			mockConfirmFn.mockImplementation(() => Promise.resolve(false));

			const options: VersionSelectorOptions = {
				kit: mockKit,
				allowManualEntry: false,
			};

			const result = await versionSelector.selectVersion(options);
			expect(result).toBeNull();
		});

		it("should handle network errors", async () => {
			const networkError = new Error("Network error");
			mockGitHubClient.listReleasesWithCache = mock(() => Promise.reject(networkError));
			mockConfirmFn.mockImplementation(() => Promise.resolve(false));

			const options: VersionSelectorOptions = {
				kit: mockKit,
				allowManualEntry: false,
			};

			const result = await versionSelector.selectVersion(options);
			expect(result).toBeNull();
		});

		it("should offer retry on errors", async () => {
			const error = new Error("Temporary error");
			let callCount = 0;

			mockGitHubClient.listReleasesWithCache = mock(() => {
				callCount++;
				if (callCount === 1) {
					return Promise.reject(error);
				}
				return Promise.resolve([mockRelease]);
			});

			// First confirm for retry = true
			mockConfirmFn.mockImplementation(() => Promise.resolve(true));
			// Select returns version after retry
			mockSelectFn.mockImplementation(() => Promise.resolve("v1.0.0"));

			const options: VersionSelectorOptions = {
				kit: mockKit,
				allowManualEntry: false,
			};

			const result = await versionSelector.selectVersion(options);
			expect(result).toBe("v1.0.0");
		});
	});

	describe("manual version entry", () => {
		it("should validate and reject null input", async () => {
			mockGitHubClient.listReleasesWithCache = mock(() => Promise.resolve([]));
			mockConfirmFn.mockImplementation(() => Promise.resolve(true));
			mockTextFn.mockImplementation(() => Promise.resolve(null as any));
			mockIsCancelFn.mockImplementation((v) => v === null);

			const options: VersionSelectorOptions = {
				kit: mockKit,
				allowManualEntry: true,
			};

			const result = await versionSelector.selectVersion(options);
			expect(result).toBeNull();
		});

		it("should accept valid version formats", async () => {
			mockGitHubClient.listReleasesWithCache = mock(() => Promise.resolve([]));
			mockConfirmFn.mockImplementation(() => Promise.resolve(true));
			mockTextFn.mockImplementation(() => Promise.resolve("v1.2.3"));

			const options: VersionSelectorOptions = {
				kit: mockKit,
				allowManualEntry: true,
			};

			const result = await versionSelector.selectVersion(options);
			expect(result).toBe("v1.2.3");
		});

		it("should normalize versions without v prefix", async () => {
			mockGitHubClient.listReleasesWithCache = mock(() => Promise.resolve([]));
			mockConfirmFn.mockImplementation(() => Promise.resolve(true));
			mockTextFn.mockImplementation(() => Promise.resolve("1.2.3"));

			const options: VersionSelectorOptions = {
				kit: mockKit,
				allowManualEntry: true,
			};

			const result = await versionSelector.selectVersion(options);
			expect(result).toBe("v1.2.3");
		});
	});

	describe("cancel option", () => {
		it("should return null when cancel is selected", async () => {
			mockSelectFn.mockImplementation(() => Promise.resolve("cancel"));

			const options: VersionSelectorOptions = {
				kit: mockKit,
			};

			const result = await versionSelector.selectVersion(options);
			expect(result).toBeNull();
		});
	});
});
