import { describe, expect, it } from "bun:test";
import { VersionDisplayFormatter } from "@/domains/versioning/version-display.js";
import type { EnrichedRelease } from "@/types";

// VersionDisplayFormatter is pure functions with string formatting
// No mocking needed - just test the output strings

const createMockEnrichedRelease = (overrides: Partial<EnrichedRelease> = {}): EnrichedRelease => ({
	id: 1,
	tag_name: "v1.0.0",
	name: "Release 1.0.0",
	draft: false,
	prerelease: false,
	assets: [],
	published_at: "2024-01-15T00:00:00Z",
	tarball_url: "https://example.com/tarball",
	zipball_url: "https://example.com/zipball",
	displayVersion: "v1.0.0",
	normalizedVersion: "1.0.0",
	relativeTime: "1 month ago",
	isLatestStable: false,
	isLatestBeta: false,
	assetCount: 0,
	...overrides,
});

describe("VersionDisplayFormatter", () => {
	describe("createBadges", () => {
		it("should create latest badge for latest stable", () => {
			const release = createMockEnrichedRelease({ isLatestStable: true });
			const badges = VersionDisplayFormatter.createBadges(release);
			expect(badges).toContain("[latest]");
		});

		it("should create beta badge for latest beta", () => {
			const release = createMockEnrichedRelease({
				isLatestBeta: true,
				prerelease: true,
			});
			const badges = VersionDisplayFormatter.createBadges(release);
			expect(badges).toContain("[beta]");
		});

		it("should create prerelease badge for prerelease versions", () => {
			const release = createMockEnrichedRelease({
				prerelease: true,
				isLatestBeta: false,
			});
			const badges = VersionDisplayFormatter.createBadges(release);
			expect(badges).toContain("[prerelease]");
		});

		it("should create stable badge for stable releases", () => {
			const release = createMockEnrichedRelease({
				draft: false,
				prerelease: false,
			});
			const badges = VersionDisplayFormatter.createBadges(release);
			expect(badges).toContain("[stable]");
		});

		it("should create draft badge for drafts", () => {
			const release = createMockEnrichedRelease({ draft: true });
			const badges = VersionDisplayFormatter.createBadges(release);
			expect(badges).toContain("[draft]");
		});

		it("should return empty string when no badges apply", () => {
			// This case shouldn't really happen in practice but test edge case
			const release = createMockEnrichedRelease({
				draft: true,
				prerelease: false,
				isLatestStable: false,
				isLatestBeta: false,
			});
			const badges = VersionDisplayFormatter.createBadges(release);
			// Should only have draft badge
			expect(badges).toContain("[draft]");
		});
	});

	describe("formatChoiceLabel", () => {
		it("should format release label with version and name", () => {
			const release = createMockEnrichedRelease({
				displayVersion: "v1.0.0",
				name: "Test Release",
			});
			const label = VersionDisplayFormatter.formatChoiceLabel(release);
			expect(label).toContain("v1.0.0");
			expect(label).toContain("Test Release");
		});

		it("should use 'Release' as default name", () => {
			const release = createMockEnrichedRelease({
				displayVersion: "v1.0.0",
				name: "",
			});
			const label = VersionDisplayFormatter.formatChoiceLabel(release);
			expect(label).toContain("Release");
		});
	});

	describe("formatChoiceHint", () => {
		it("should include relative time", () => {
			const release = createMockEnrichedRelease({
				relativeTime: "2 days ago",
			});
			const hint = VersionDisplayFormatter.formatChoiceHint(release);
			expect(hint).toContain("2 days ago");
		});

		it("should include asset count (singular)", () => {
			const release = createMockEnrichedRelease({
				assetCount: 1,
			});
			const hint = VersionDisplayFormatter.formatChoiceHint(release);
			expect(hint).toContain("1 asset");
		});

		it("should include asset count (plural)", () => {
			const release = createMockEnrichedRelease({
				assetCount: 3,
			});
			const hint = VersionDisplayFormatter.formatChoiceHint(release);
			expect(hint).toContain("3 assets");
		});

		it("should skip Unknown relative time", () => {
			const release = createMockEnrichedRelease({
				relativeTime: "Unknown",
				assetCount: 0,
			});
			const hint = VersionDisplayFormatter.formatChoiceHint(release);
			expect(hint).not.toContain("Unknown");
		});

		it("should return empty string when no hint data", () => {
			const release = createMockEnrichedRelease({
				relativeTime: "Unknown",
				assetCount: 0,
				normalizedVersion: "v1.0.0",
				displayVersion: "v1.0.0",
			});
			const hint = VersionDisplayFormatter.formatChoiceHint(release);
			expect(hint).toBe("");
		});
	});

	describe("createSpecialOptions", () => {
		it("should create latest stable option", () => {
			const releases = [
				createMockEnrichedRelease({
					id: 1,
					tag_name: "v1.0.0",
					displayVersion: "v1.0.0",
					isLatestStable: true,
					prerelease: false,
				}),
			];

			const options = VersionDisplayFormatter.createSpecialOptions(releases);
			expect(options).toHaveLength(1);
			expect(options[0].label).toContain("Latest Stable");
			expect(options[0].value).toBe("v1.0.0");
			expect(options[0].isLatest).toBe(true);
		});

		it("should create latest beta option", () => {
			const releases = [
				createMockEnrichedRelease({
					id: 2,
					tag_name: "v1.1.0-beta",
					displayVersion: "v1.1.0-beta",
					isLatestBeta: true,
					prerelease: true,
					draft: false,
				}),
			];

			const options = VersionDisplayFormatter.createSpecialOptions(releases);
			const betaOption = options.find((o) => o.label.includes("Beta"));
			expect(betaOption).toBeDefined();
			expect(betaOption?.isPrerelease).toBe(true);
		});

		it("should return empty array when no special releases", () => {
			const releases = [
				createMockEnrichedRelease({
					isLatestStable: false,
					isLatestBeta: false,
					prerelease: false,
				}),
			];

			const options = VersionDisplayFormatter.createSpecialOptions(releases);
			expect(options).toHaveLength(0);
		});
	});

	describe("createSeparator", () => {
		it("should create separator choice", () => {
			const separator = VersionDisplayFormatter.createSeparator();
			expect(separator.value).toBe("separator");
			expect(separator.label).toContain("─");
			expect(separator.isLatest).toBe(false);
		});
	});

	describe("createCancelOption", () => {
		it("should create cancel choice", () => {
			const cancel = VersionDisplayFormatter.createCancelOption();
			expect(cancel.value).toBe("cancel");
			expect(cancel.label).toContain("Cancel");
			expect(cancel.hint).toContain("exit");
		});
	});

	describe("formatVersionChoice", () => {
		it("should format complete version choice", () => {
			const release = createMockEnrichedRelease({
				tag_name: "v1.0.0",
				displayVersion: "v1.0.0",
				isLatestStable: true,
				prerelease: false,
			});

			const choice = VersionDisplayFormatter.formatVersionChoice(release);
			expect(choice.value).toBe("v1.0.0");
			expect(choice.label).toBeDefined();
			expect(choice.isLatest).toBe(true);
			expect(choice.isPrerelease).toBe(false);
		});
	});

	describe("formatReleasesToChoices", () => {
		it("should format releases with special options", () => {
			const releases = [
				createMockEnrichedRelease({
					id: 1,
					tag_name: "v1.0.0",
					isLatestStable: true,
				}),
				createMockEnrichedRelease({
					id: 2,
					tag_name: "v0.9.0",
					isLatestStable: false,
				}),
			];

			const choices = VersionDisplayFormatter.formatReleasesToChoices(releases, true);

			// Should have: Latest Stable option, separator, releases, separator, cancel
			expect(choices.length).toBeGreaterThan(2);
			expect(choices.some((c) => c.value === "separator")).toBe(true);
			expect(choices.some((c) => c.value === "cancel")).toBe(true);
		});

		it("should format releases without special options", () => {
			const releases = [createMockEnrichedRelease({ id: 1, tag_name: "v1.0.0" })];

			const choices = VersionDisplayFormatter.formatReleasesToChoices(releases, false);

			expect(choices).toHaveLength(1);
			expect(choices[0].value).toBe("v1.0.0");
		});

		it("should respect limit", () => {
			const releases = Array.from({ length: 50 }, (_, i) =>
				createMockEnrichedRelease({
					id: i + 1,
					tag_name: `v1.0.${i}`,
				}),
			);

			const choices = VersionDisplayFormatter.formatReleasesToChoices(releases, false, 10);
			expect(choices).toHaveLength(10);
		});
	});

	describe("getDefaultChoiceIndex", () => {
		it("should return index of latest stable", () => {
			const choices = [
				{ value: "v1.0.0", label: "v1.0.0", isLatest: true, isPrerelease: false },
				{ value: "v0.9.0", label: "v0.9.0", isLatest: false, isPrerelease: false },
			];

			const index = VersionDisplayFormatter.getDefaultChoiceIndex(choices);
			expect(index).toBe(0);
		});

		it("should fallback to first non-separator", () => {
			const choices = [
				{ value: "separator", label: "---", isLatest: false, isPrerelease: false },
				{ value: "v1.0.0", label: "v1.0.0", isLatest: false, isPrerelease: false },
			];

			const index = VersionDisplayFormatter.getDefaultChoiceIndex(choices);
			expect(index).toBe(1);
		});

		it("should return 0 when no valid default found", () => {
			const choices: any[] = [];
			const index = VersionDisplayFormatter.getDefaultChoiceIndex(choices);
			expect(index).toBe(0);
		});
	});

	describe("isValidVersionChoice", () => {
		it("should return true for valid version", () => {
			expect(VersionDisplayFormatter.isValidVersionChoice("v1.0.0")).toBe(true);
		});

		it("should return false for separator", () => {
			expect(VersionDisplayFormatter.isValidVersionChoice("separator")).toBe(false);
		});

		it("should return false for cancel", () => {
			expect(VersionDisplayFormatter.isValidVersionChoice("cancel")).toBe(false);
		});

		it("should return false for empty string", () => {
			expect(VersionDisplayFormatter.isValidVersionChoice("")).toBe(false);
			expect(VersionDisplayFormatter.isValidVersionChoice("   ")).toBe(false);
		});
	});

	describe("formatError", () => {
		it("should format error message", () => {
			const error = VersionDisplayFormatter.formatError("Test error");
			expect(error).toContain("Test error");
		});

		it("should include suggestion when provided", () => {
			const error = VersionDisplayFormatter.formatError("Test error", "Try this instead");
			expect(error).toContain("Test error");
			expect(error).toContain("Try this instead");
		});
	});

	describe("formatSuccess", () => {
		it("should format success message", () => {
			const success = VersionDisplayFormatter.formatSuccess("v1.0.0", "my-kit");
			expect(success).toContain("v1.0.0");
			expect(success).toContain("my-kit");
			expect(success).toContain("✓");
		});
	});
});
