import { describe, it, expect } from "bun:test";
import { VersionDisplayFormatter, type VersionChoice } from "../../src/lib/version-display.js";

describe("VersionDisplayFormatter", () => {
	const mockRelease = {
		id: 1,
		tag_name: "v1.2.3",
		name: "Test Release",
		draft: false,
		prerelease: false,
		assets: [{ id: 1, name: "test.zip", size: 1000, url: "https://example.com/asset", browser_download_url: "https://example.com/download", content_type: "application/zip" }],
		published_at: "2024-01-01T00:00:00Z",
		tarball_url: "https://example.com/tarball",
		zipball_url: "https://example.com/zipball",
		displayVersion: "v1.2.3",
		normalizedVersion: "1.2.3",
		relativeTime: "2 days ago",
		isLatestStable: true,
		isLatestBeta: false,
		assetCount: 1,
	};

	const mockBetaRelease = {
		...mockRelease,
		tag_name: "v1.3.0-beta",
		name: "Beta Release",
		prerelease: true,
		isLatestStable: false,
		isLatestBeta: true,
		displayVersion: "v1.3.0-beta",
		normalizedVersion: "1.3.0-beta",
	};

	const mockDraftRelease = {
		...mockRelease,
		tag_name: "v1.4.0",
		name: "Draft Release",
		draft: true,
		prerelease: false,
		isLatestStable: false,
		isLatestBeta: false,
		displayVersion: "v1.4.0",
		normalizedVersion: "1.4.0",
	};

	describe("createBadges", () => {
		it("should create [latest] badge for latest stable", () => {
			const badges = VersionDisplayFormatter.createBadges(mockRelease);
			expect(badges).toContain(" [latest]");
			expect(badges).toContain(" [stable]");
		});

		it("should create [beta] badge for latest beta", () => {
			const badges = VersionDisplayFormatter.createBadges(mockBetaRelease);
			expect(badges).toContain(" [beta]");
			expect(badges).not.toContain(" [latest]");
		});

		it("should create [draft] badge for draft releases", () => {
			const badges = VersionDisplayFormatter.createBadges(mockDraftRelease);
			expect(badges).toContain(" [draft]");
		});

		it("should create [prerelease] badge for regular prereleases", () => {
			const regularPrerelease = {
				...mockRelease,
				prerelease: true,
				isLatestBeta: false,
			};
			const badges = VersionDisplayFormatter.createBadges(regularPrerelease);
			expect(badges).toContain(" [prerelease]");
		});
	});

	describe("formatChoiceLabel", () => {
		it("should format version with badges and name", () => {
			const label = VersionDisplayFormatter.formatChoiceLabel(mockRelease);
			expect(label).toContain("v1.2.3");
			expect(label).toContain("[latest]");
			expect(label).toContain("[stable]");
			expect(label).toContain("Test Release");
		});

		it("should format beta version with appropriate badges", () => {
			const label = VersionDisplayFormatter.formatChoiceLabel(mockBetaRelease);
			expect(label).toContain("v1.3.0-beta");
			expect(label).toContain("[beta]");
			expect(label).toContain("Beta Release");
		});
	});

	describe("formatChoiceHint", () => {
		it("should format hint with relative time and asset count", () => {
			const hint = VersionDisplayFormatter.formatChoiceHint(mockRelease);
			expect(hint).toContain("2 days ago");
			expect(hint).toContain("1 asset");
		});

		it("should handle multiple assets", () => {
			const multiAssetRelease = {
				...mockRelease,
				assets: [
					{ id: 1, name: "a.zip", size: 100, url: "https://example.com/a", browser_download_url: "https://example.com/a", content_type: "application/zip" },
					{ id: 2, name: "b.zip", size: 100, url: "https://example.com/b", browser_download_url: "https://example.com/b", content_type: "application/zip" },
					{ id: 3, name: "c.zip", size: 100, url: "https://example.com/c", browser_download_url: "https://example.com/c", content_type: "application/zip" },
				],
				assetCount: 3,
			};
			const hint = VersionDisplayFormatter.formatChoiceHint(multiAssetRelease);
			expect(hint).toContain("3 assets");
		});

		it("should handle missing metadata", () => {
			const minimalRelease = {
				...mockRelease,
				relativeTime: "Unknown",
				assetCount: 0,
				displayVersion: "1.2.3", // Same as normalized to avoid showing it
				normalizedVersion: "1.2.3",
			};
			const hint = VersionDisplayFormatter.formatChoiceHint(minimalRelease);
			expect(hint).toBe("");
		});
	});

	describe("createSpecialOptions", () => {
		it("should create Latest Stable and Latest Beta options", () => {
			const options = VersionDisplayFormatter.createSpecialOptions([mockRelease, mockBetaRelease]);
			expect(options).toHaveLength(2);

			const latestStable = options.find(o => o.value === "v1.2.3");
			expect(latestStable?.label).toContain("Latest Stable");
			expect(latestStable?.hint).toBe("recommended version");
			expect(latestStable?.isLatest).toBe(true);

			const latestBeta = options.find(o => o.value === "v1.3.0-beta");
			expect(latestBeta?.label).toContain("Latest Beta");
			expect(latestBeta?.hint).toBe("latest features, may be unstable");
			expect(latestBeta?.isPrerelease).toBe(true);
		});

		it("should return empty array when no suitable releases", () => {
			const options = VersionDisplayFormatter.createSpecialOptions([mockDraftRelease]);
			expect(options).toHaveLength(0);
		});
	});

	describe("createSeparator", () => {
		it("should create a separator choice", () => {
			const separator = VersionDisplayFormatter.createSeparator();
			expect(separator.value).toBe("separator");
			expect(separator.label).toMatch(/^[─]+$/);
		});
	});

	describe("createCancelOption", () => {
		it("should create a cancel option", () => {
			const cancel = VersionDisplayFormatter.createCancelOption();
			expect(cancel.value).toBe("cancel");
			expect(cancel.label).toBe("Cancel");
			expect(cancel.hint).toBe("exit version selection");
		});
	});

	describe("formatVersionChoice", () => {
		it("should create a complete version choice", () => {
			const choice = VersionDisplayFormatter.formatVersionChoice(mockRelease);
			expect(choice.value).toBe("v1.2.3");
			expect(choice.label).toContain("v1.2.3");
			expect(choice.hint).toContain("2 days ago");
			expect(choice.isLatest).toBe(true);
			expect(choice.isPrerelease).toBe(false);
		});
	});

	describe("formatReleasesToChoices", () => {
		it("should format releases with special options by default", () => {
			const choices = VersionDisplayFormatter.formatReleasesToChoices([mockRelease, mockBetaRelease]);

			// Should include special options, separator, regular releases, and cancel
			expect(choices.length).toBeGreaterThan(4);

			// Check for special options
			expect(choices.some(c => c.label.includes("Latest Stable"))).toBe(true);
			expect(choices.some(c => c.label.includes("Latest Beta"))).toBe(true);

			// Check for cancel option
			expect(choices.some(c => c.value === "cancel")).toBe(true);
		});

		it("should limit releases when specified", () => {
			const manyReleases = Array.from({ length: 50 }, (_, i) => ({
				...mockRelease,
				id: i,
				tag_name: `v1.${i}.0`,
			}));

			const choices = VersionDisplayFormatter.formatReleasesToChoices(manyReleases, true, 10);

			// Should limit to 10 regular releases plus special options
			const regularReleases = choices.filter(c =>
				c.value.startsWith("v1.") && !c.label.includes("Latest")
			);
			expect(regularReleases.length).toBeLessThanOrEqual(10);
		});

		it("should exclude special options when disabled", () => {
			const choices = VersionDisplayFormatter.formatReleasesToChoices([mockRelease], false);

			// Should not include special options
			expect(choices.some(c => c.label.includes("Latest"))).toBe(false);

			// Should not include cancel option when special options are disabled
			expect(choices.some(c => c.value === "cancel")).toBe(false);

			// Should include regular release
			expect(choices.some(c => c.value === "v1.2.3")).toBe(true);
		});
	});

	describe("getDefaultChoiceIndex", () => {
		it("should return index of latest stable version", () => {
			const choices = [
				{ value: "v1.1.0", isLatest: false, isPrerelease: false },
				{ value: "v1.2.0", isLatest: true, isPrerelease: false },
				{ value: "v1.3.0-beta", isLatest: false, isPrerelease: true },
			] as VersionChoice[];

			const index = VersionDisplayFormatter.getDefaultChoiceIndex(choices);
			expect(index).toBe(1);
		});

		it("should return first non-separator choice if no latest found", () => {
			const choices = [
				{ value: "separator", isLatest: false, isPrerelease: false },
				{ value: "v1.1.0", isLatest: false, isPrerelease: false },
				{ value: "v1.2.0", isLatest: false, isPrerelease: false },
			] as VersionChoice[];

			const index = VersionDisplayFormatter.getDefaultChoiceIndex(choices);
			expect(index).toBe(1);
		});

		it("should return 0 for empty choices", () => {
			const index = VersionDisplayFormatter.getDefaultChoiceIndex([]);
			expect(index).toBe(0);
		});
	});

	describe("isValidVersionChoice", () => {
		it("should validate regular version choices", () => {
			expect(VersionDisplayFormatter.isValidVersionChoice("v1.2.3")).toBe(true);
			expect(VersionDisplayFormatter.isValidVersionChoice("1.0.0")).toBe(true);
		});

		it("should reject special choices", () => {
			expect(VersionDisplayFormatter.isValidVersionChoice("separator")).toBe(false);
			expect(VersionDisplayFormatter.isValidVersionChoice("cancel")).toBe(false);
		});

		it("should reject empty or whitespace choices", () => {
			expect(VersionDisplayFormatter.isValidVersionChoice("")).toBe(false);
			expect(VersionDisplayFormatter.isValidVersionChoice("   ")).toBe(false);
		});
	});

	describe("formatError", () => {
		it("should format error message with color", () => {
			const error = VersionDisplayFormatter.formatError("Test error");
			expect(error).toContain("Test error");
		});

		it("should include suggestion when provided", () => {
			const error = VersionDisplayFormatter.formatError("Test error", "Try again");
			expect(error).toContain("Test error");
			expect(error).toContain("Try again");
		});
	});

	describe("formatSuccess", () => {
		it("should format success message", () => {
			const success = VersionDisplayFormatter.formatSuccess("v1.2.3", "Test Kit");
			expect(success).toContain("✓");
			expect(success).toContain("v1.2.3");
			expect(success).toContain("Test Kit");
		});
	});
});