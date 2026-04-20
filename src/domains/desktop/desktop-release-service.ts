import { parseDesktopReleaseManifest } from "@/domains/desktop/desktop-release-manifest.js";
import { isPrereleaseVersion } from "@/domains/versioning/checking/version-utils.js";
import type { DesktopReleaseManifest } from "@/types/desktop.js";

const DESKTOP_RELEASE_REPOSITORY = "https://github.com/mrgoonie/claudekit-cli/releases/download";
const GITHUB_API_REPO = "https://api.github.com/repos/mrgoonie/claudekit-cli";
const MANIFEST_ASSET_NAME = "desktop-manifest.json";

export type DesktopChannel = "stable" | "dev";

function resolveTag(opts?: { version?: string; channel?: DesktopChannel }): string {
	if (opts?.version) return `desktop-v${opts.version}`;
	return (opts?.channel ?? "stable") === "dev" ? "desktop-latest-dev" : "desktop-latest";
}

export function getDesktopManifestUrl(opts?: {
	version?: string;
	channel?: DesktopChannel;
}): string {
	return `${DESKTOP_RELEASE_REPOSITORY}/${resolveTag(opts)}/${MANIFEST_ASSET_NAME}`;
}

function resolveManifestChannel(
	rawManifest: unknown,
	opts?: { version?: string; channel?: DesktopChannel },
): DesktopChannel {
	if (rawManifest && typeof rawManifest === "object" && "channel" in rawManifest) {
		const rawChannel = rawManifest.channel;
		if (rawChannel === "stable" || rawChannel === "dev") {
			return rawChannel;
		}
	}

	if (
		rawManifest &&
		typeof rawManifest === "object" &&
		"version" in rawManifest &&
		typeof rawManifest.version === "string"
	) {
		return isPrereleaseVersion(rawManifest.version) ? "dev" : "stable";
	}

	if (opts?.version) {
		return isPrereleaseVersion(opts.version) ? "dev" : "stable";
	}

	if (opts?.channel) {
		return opts.channel;
	}

	return "stable";
}

// GitHub's CDN (releases/download/...) caches the manifest asset blob by name across
// all tags, serving stale/garbage content even after `gh release upload --clobber`
// replaces it. The GH API asset endpoint is not cached — use it instead.
async function fetchManifestViaApi(tag: string, fetchFn: typeof fetch): Promise<unknown> {
	const tagRes = await fetchFn(`${GITHUB_API_REPO}/releases/tags/${tag}`, {
		headers: { Accept: "application/vnd.github+json" },
	});
	if (!tagRes.ok) {
		throw new Error(
			`Failed to resolve desktop release tag ${tag}: ${tagRes.status} ${tagRes.statusText}`,
		);
	}
	const tagBody = (await tagRes.json()) as { assets?: Array<{ id?: number; name?: string }> };
	const asset = tagBody.assets?.find((a) => a.name === MANIFEST_ASSET_NAME);
	if (!asset?.id) {
		throw new Error(`Release tag ${tag} has no ${MANIFEST_ASSET_NAME} asset`);
	}
	const assetRes = await fetchFn(`${GITHUB_API_REPO}/releases/assets/${asset.id}`, {
		headers: { Accept: "application/octet-stream" },
	});
	if (!assetRes.ok) {
		throw new Error(
			`Failed to fetch desktop manifest asset ${asset.id}: ${assetRes.status} ${assetRes.statusText}`,
		);
	}
	return assetRes.json();
}

export async function fetchDesktopReleaseManifest(
	opts?: { version?: string; channel?: DesktopChannel },
	fetchFn: typeof fetch = globalThis.fetch,
): Promise<DesktopReleaseManifest> {
	const tag = resolveTag(opts);
	const rawManifest = await fetchManifestViaApi(tag, fetchFn);
	const manifestRecord =
		rawManifest && typeof rawManifest === "object"
			? (rawManifest as Record<string, unknown>)
			: { value: rawManifest };
	return parseDesktopReleaseManifest({
		...manifestRecord,
		channel: resolveManifestChannel(rawManifest, opts),
	});
}
