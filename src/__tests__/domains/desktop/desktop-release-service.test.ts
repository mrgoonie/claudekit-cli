import { describe, expect, mock, test } from "bun:test";
import {
	fetchDesktopReleaseManifest,
	getDesktopManifestUrl,
} from "@/domains/desktop/desktop-release-service.js";

const MANIFEST_PLATFORMS = {
	"darwin-aarch64": {
		name: "mac.zip",
		url: "https://example.com/mac.zip",
		size: 100,
		assetType: "app-zip",
	},
	"darwin-x86_64": {
		name: "mac.zip",
		url: "https://example.com/mac.zip",
		size: 100,
		assetType: "app-zip",
	},
	"linux-x86_64": {
		name: "linux.AppImage",
		url: "https://example.com/linux.AppImage",
		size: 200,
		assetType: "appimage",
	},
	"windows-x86_64": {
		name: "windows.exe",
		url: "https://example.com/windows.exe",
		size: 300,
		assetType: "portable-exe",
	},
};

function mockApiFetch(manifest: Record<string, unknown>, assetId = 999) {
	return mock(async (url: string | URL | Request) => {
		const u = String(url);
		if (u.includes("/releases/tags/")) {
			return {
				ok: true,
				json: async () => ({
					assets: [{ id: assetId, name: "desktop-manifest.json" }],
				}),
			};
		}
		if (u.includes(`/releases/assets/${assetId}`)) {
			return { ok: true, json: async () => manifest };
		}
		throw new Error(`unexpected fetch: ${u}`);
	});
}

describe("desktop-release-service", () => {
	test("builds stable latest URL (no args)", () => {
		expect(getDesktopManifestUrl()).toBe(
			"https://github.com/mrgoonie/claudekit-cli/releases/download/desktop-latest/desktop-manifest.json",
		);
	});

	test("builds dev latest URL (channel=dev)", () => {
		expect(getDesktopManifestUrl({ channel: "dev" })).toBe(
			"https://github.com/mrgoonie/claudekit-cli/releases/download/desktop-latest-dev/desktop-manifest.json",
		);
	});

	test("builds version-specific URL (version overrides channel)", () => {
		expect(getDesktopManifestUrl({ version: "0.1.0" })).toBe(
			"https://github.com/mrgoonie/claudekit-cli/releases/download/desktop-v0.1.0/desktop-manifest.json",
		);
		expect(getDesktopManifestUrl({ version: "0.1.0", channel: "dev" })).toBe(
			"https://github.com/mrgoonie/claudekit-cli/releases/download/desktop-v0.1.0/desktop-manifest.json",
		);
	});

	test("fetches and parses manifest via GH API (stable channel)", async () => {
		const fetchFn = mockApiFetch({
			version: "0.1.0",
			date: "2026-04-15T21:00:00Z",
			platforms: MANIFEST_PLATFORMS,
		});

		const manifest = await fetchDesktopReleaseManifest(
			undefined,
			fetchFn as unknown as typeof fetch,
		);

		expect(fetchFn).toHaveBeenCalledWith(
			"https://api.github.com/repos/mrgoonie/claudekit-cli/releases/tags/desktop-latest",
			{ headers: { Accept: "application/vnd.github+json" } },
		);
		expect(fetchFn).toHaveBeenCalledWith(
			"https://api.github.com/repos/mrgoonie/claudekit-cli/releases/assets/999",
			{ headers: { Accept: "application/octet-stream" } },
		);
		expect(manifest.channel).toBe("stable");
		expect(manifest.platforms["windows-x86_64"]?.assetType).toBe("portable-exe");
	});

	test("resolves dev channel tag via API when channel=dev", async () => {
		const fetchFn = mockApiFetch({
			version: "0.1.0",
			date: "2026-04-15T21:00:00Z",
			channel: "dev",
			platforms: MANIFEST_PLATFORMS,
		});

		await fetchDesktopReleaseManifest({ channel: "dev" }, fetchFn as unknown as typeof fetch);

		expect(fetchFn).toHaveBeenCalledWith(
			"https://api.github.com/repos/mrgoonie/claudekit-cli/releases/tags/desktop-latest-dev",
			{ headers: { Accept: "application/vnd.github+json" } },
		);
	});

	test("resolves version-specific tag via API", async () => {
		const fetchFn = mockApiFetch({
			version: "0.1.0-dev.2",
			date: "2026-04-15T21:00:00Z",
			platforms: MANIFEST_PLATFORMS,
		});

		const manifest = await fetchDesktopReleaseManifest(
			{ version: "0.1.0-dev.2" },
			fetchFn as unknown as typeof fetch,
		);

		expect(fetchFn).toHaveBeenCalledWith(
			"https://api.github.com/repos/mrgoonie/claudekit-cli/releases/tags/desktop-v0.1.0-dev.2",
			{ headers: { Accept: "application/vnd.github+json" } },
		);
		expect(manifest.channel).toBe("dev");
	});

	test("backfills channel=dev for legacy dev manifests that predate the channel field", async () => {
		const fetchFn = mockApiFetch({
			version: "0.1.0-dev.2",
			date: "2026-04-15T21:00:00Z",
			platforms: MANIFEST_PLATFORMS,
		});

		const manifest = await fetchDesktopReleaseManifest(
			{ channel: "dev" },
			fetchFn as unknown as typeof fetch,
		);

		expect(manifest.channel).toBe("dev");
	});

	test("throws when the tag lookup fails", async () => {
		const fetchFn = mock(async () => ({
			ok: false,
			status: 404,
			statusText: "Not Found",
		}));

		await expect(
			fetchDesktopReleaseManifest({}, fetchFn as unknown as typeof fetch),
		).rejects.toThrow(/404/i);
	});

	test("throws when the release has no manifest asset", async () => {
		const fetchFn = mock(async () => ({
			ok: true,
			json: async () => ({ assets: [] }),
		}));

		await expect(
			fetchDesktopReleaseManifest({}, fetchFn as unknown as typeof fetch),
		).rejects.toThrow(/no desktop-manifest\.json asset/i);
	});
});
