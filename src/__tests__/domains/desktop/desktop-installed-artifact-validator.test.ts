import { describe, expect, test } from "bun:test";
import { validateInstalledDesktopArtifact } from "@/domains/desktop/desktop-installed-artifact-validator.js";

describe("desktop-installed-artifact-validator", () => {
	test("matches the exact CFBundleShortVersionString value on macOS", async () => {
		const isValid = await validateInstalledDesktopArtifact(
			"/Applications/ClaudeKit Control Center.app",
			{
				version: "1.2.3",
				manifestDate: "2026-04-19T00:00:00Z",
				channel: "stable",
				platformKey: "darwin-aarch64",
				assetName: "claudekit-control-center_1.2.3_macos-universal.app.zip",
				assetSize: 123,
				installedAt: "2026-04-19T00:00:00Z",
			},
			{
				platform: "darwin",
				readFileFn: async () => `<?xml version="1.0"?>
<plist>
  <dict>
    <key>CFBundleShortVersionString</key>
    <string>1.2.3</string>
  </dict>
</plist>`,
			},
		);

		expect(isValid).toBe(true);
	});

	test("rejects substring-only matches on macOS", async () => {
		const isValid = await validateInstalledDesktopArtifact(
			"/Applications/ClaudeKit Control Center.app",
			{
				version: "1.2",
				manifestDate: "2026-04-19T00:00:00Z",
				channel: "stable",
				platformKey: "darwin-aarch64",
				assetName: "claudekit-control-center_1.2_macos-universal.app.zip",
				assetSize: 123,
				installedAt: "2026-04-19T00:00:00Z",
			},
			{
				platform: "darwin",
				readFileFn: async () => `<?xml version="1.0"?>
<plist>
  <dict>
    <key>CFBundleShortVersionString</key>
    <string>1.20</string>
  </dict>
</plist>`,
			},
		);

		expect(isValid).toBe(false);
	});
});
