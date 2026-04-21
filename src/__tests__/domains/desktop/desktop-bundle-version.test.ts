import { describe, expect, test } from "bun:test";
import {
	deriveWindowsWixVersion,
	parseDesktopReleaseVersion,
	synchronizeDesktopBundleConfig,
	validateDesktopBundleConfig,
} from "@/domains/desktop/desktop-bundle-version.js";
import { compareVersions } from "compare-versions";

describe("desktop-bundle-version", () => {
	test("derives a monotonic MSI-safe version from a prerelease app version", () => {
		expect(deriveWindowsWixVersion("0.1.0-dev.2")).toBe("0.1.2");
		expect(deriveWindowsWixVersion("1.0.0-dev.0")).toBe("1.0.0");
		expect(deriveWindowsWixVersion("1.2.3-rc.12")).toBe("1.2.1932");
	});

	test("derives a stable MSI version that sorts after same-base prereleases", () => {
		expect(deriveWindowsWixVersion("0.1.0")).toBe("0.1.511");
		expect(
			compareVersions(deriveWindowsWixVersion("0.1.0"), deriveWindowsWixVersion("0.1.0-dev.2")),
		).toBe(1);
		expect(
			compareVersions(deriveWindowsWixVersion("0.1.1-dev.1"), deriveWindowsWixVersion("0.1.0")),
		).toBe(1);
	});

	test("rejects prerelease versions without a numeric suffix", () => {
		expect(() => deriveWindowsWixVersion("0.1.0-dev")).toThrow(/numeric prerelease segment/i);
	});

	test("rejects unsupported prerelease labels for Windows MSI", () => {
		expect(() => deriveWindowsWixVersion("0.1.0-preview.1")).toThrow(
			/unsupported prerelease label/i,
		);
	});

	test("validates matching wix.version in desktop bundle config", () => {
		expect(() =>
			validateDesktopBundleConfig({
				version: "0.1.0-dev.2",
				bundle: {
					windows: {
						wix: {
							version: "0.1.2",
						},
					},
				},
			}),
		).not.toThrow();
	});

	test("accepts an equivalent four-part wix.version that ends in .0", () => {
		expect(() =>
			validateDesktopBundleConfig({
				version: "0.1.0",
				bundle: {
					windows: {
						wix: {
							version: "0.1.511.0",
						},
					},
				},
			}),
		).not.toThrow();
	});

	test("accepts a three-part wix.version ending in .0 for dev.0 releases", () => {
		expect(() =>
			validateDesktopBundleConfig({
				version: "1.0.0-dev.0",
				bundle: {
					windows: {
						wix: {
							version: "1.0.0",
						},
					},
				},
			}),
		).not.toThrow();
	});

	test("rejects mismatched wix.version in desktop bundle config", () => {
		expect(() =>
			validateDesktopBundleConfig({
				version: "0.1.0-dev.2",
				bundle: {
					windows: {
						wix: {
							version: "0.1.1",
						},
					},
				},
			}),
		).toThrow(/requires bundle\.windows\.wix\.version 0\.1\.2/i);
	});

	test("parses the app version from a desktop release tag", () => {
		expect(parseDesktopReleaseVersion("desktop-v0.1.0-dev.7")).toBe("0.1.0-dev.7");
		expect(parseDesktopReleaseVersion("0.1.0-dev.7")).toBe("0.1.0-dev.7");
	});

	test("synchronizes desktop bundle config version and wix.version from release input", () => {
		const synced = synchronizeDesktopBundleConfig(
			{
				version: "0.1.0-dev.5",
				productName: "ClaudeKit Control Center",
				bundle: {
					active: true,
					windows: {
						wix: {
							version: "0.1.5",
							language: "en-US",
						},
					},
				},
			},
			"desktop-v0.1.0-dev.7",
		);

		expect(synced.version).toBe("0.1.0-dev.7");
		expect(synced.productName).toBe("ClaudeKit Control Center");
		expect(synced.bundle.active).toBe(true);
		expect(synced.bundle.windows.wix.language).toBe("en-US");
		expect(synced.bundle.windows.wix.version).toBe("0.1.7");
		expect(() => validateDesktopBundleConfig(synced)).not.toThrow();
	});

	test("preserves an equivalent four-part wix.version during sync no-op checks", () => {
		const synced = synchronizeDesktopBundleConfig(
			{
				version: "0.1.0",
				bundle: {
					windows: {
						wix: {
							version: "0.1.511.0",
						},
					},
				},
			},
			"0.1.0",
		);

		expect(synced.bundle.windows.wix.version).toBe("0.1.511.0");
		expect(() => validateDesktopBundleConfig(synced)).not.toThrow();
	});
});
