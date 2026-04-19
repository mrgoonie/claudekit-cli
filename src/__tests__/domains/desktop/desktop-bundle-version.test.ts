import { describe, expect, test } from "bun:test";
import {
	deriveWindowsWixVersion,
	validateDesktopBundleConfig,
} from "@/domains/desktop/desktop-bundle-version.js";

describe("desktop-bundle-version", () => {
	test("derives a numeric MSI-safe version from a prerelease app version", () => {
		expect(deriveWindowsWixVersion("0.1.0-dev.2")).toBe("0.1.0.2");
		expect(deriveWindowsWixVersion("1.2.3-rc.12")).toBe("1.2.3.12");
	});

	test("derives a four-part MSI version from a stable app version", () => {
		expect(deriveWindowsWixVersion("0.1.0")).toBe("0.1.0.0");
	});

	test("rejects prerelease versions without a numeric suffix", () => {
		expect(() => deriveWindowsWixVersion("0.1.0-dev")).toThrow(/numeric prerelease segment/i);
	});

	test("validates matching wix.version in desktop bundle config", () => {
		expect(() =>
			validateDesktopBundleConfig({
				version: "0.1.0-dev.2",
				bundle: {
					windows: {
						wix: {
							version: "0.1.0.2",
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
							version: "0.1.0.1",
						},
					},
				},
			}),
		).toThrow(/requires bundle\.windows\.wix\.version 0\.1\.0\.2/i);
	});
});
