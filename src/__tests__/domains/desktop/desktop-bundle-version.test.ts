import { describe, expect, test } from "bun:test";
import {
	deriveWindowsWixVersion,
	validateDesktopBundleConfig,
} from "@/domains/desktop/desktop-bundle-version.js";
import { compareVersions } from "compare-versions";

describe("desktop-bundle-version", () => {
	test("derives a monotonic MSI-safe version from a prerelease app version", () => {
		expect(deriveWindowsWixVersion("0.1.0-dev.2")).toBe("0.1.2");
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
});
