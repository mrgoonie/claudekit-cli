import { describe, expect, test } from "bun:test";
import { parseDesktopReleasePayload } from "@/domains/desktop/desktop-release-payload.js";

describe("desktop-release-payload", () => {
	test("parses a valid GitHub release payload", () => {
		const payload = parseDesktopReleasePayload({
			id: 1,
			tag_name: "desktop-v0.1.0",
			name: "ClaudeKit Desktop v0.1.0",
			draft: false,
			prerelease: false,
			published_at: "2026-04-16T00:00:00Z",
			tarball_url: "https://example.com/tarball",
			zipball_url: "https://example.com/zipball",
			assets: [
				{
					id: 10,
					name: "claudekit-control-center_0.1.0_macos-universal.app.zip",
					url: "https://api.example.com/assets/10",
					browser_download_url: "https://example.com/mac.zip",
					size: 100,
					content_type: "application/zip",
				},
			],
		});

		expect(payload.tag_name).toBe("desktop-v0.1.0");
	});

	test("rejects malformed release payloads", () => {
		expect(() =>
			parseDesktopReleasePayload({
				tag_name: "desktop-v0.1.0",
				assets: [],
			}),
		).toThrow();
	});

	test("rejects empty asset lists with a clear error", () => {
		expect(() =>
			parseDesktopReleasePayload({
				id: 1,
				tag_name: "desktop-v0.1.0",
				name: "ClaudeKit Desktop v0.1.0",
				draft: false,
				prerelease: false,
				published_at: "2026-04-16T00:00:00Z",
				tarball_url: "https://example.com/tarball",
				zipball_url: "https://example.com/zipball",
				assets: [],
			}),
		).toThrow(/no assets/i);
	});
});
