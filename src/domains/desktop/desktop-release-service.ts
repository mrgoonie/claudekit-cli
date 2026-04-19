import { parseDesktopReleaseManifest } from "@/domains/desktop/desktop-release-manifest.js";
import { isPrereleaseVersion } from "@/domains/versioning/checking/version-utils.js";
import type { DesktopReleaseManifest } from "@/types/desktop.js";

const DESKTOP_RELEASE_REPOSITORY = "https://github.com/mrgoonie/claudekit-cli/releases/download";

export type DesktopChannel = "stable" | "dev";

export function getDesktopManifestUrl(opts?: {
	version?: string;
	channel?: DesktopChannel;
}): string {
	const version = opts?.version;
	const channel = opts?.channel ?? "stable";
	let tag: string;
	if (version) {
		tag = `desktop-v${version}`;
	} else {
		tag = channel === "dev" ? "desktop-latest-dev" : "desktop-latest";
	}
	return `${DESKTOP_RELEASE_REPOSITORY}/${tag}/desktop-manifest.json`;
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

export async function fetchDesktopReleaseManifest(
	opts?: { version?: string; channel?: DesktopChannel },
	fetchFn: typeof fetch = globalThis.fetch,
): Promise<DesktopReleaseManifest> {
	const response = await fetchFn(getDesktopManifestUrl(opts));
	if (!response.ok) {
		throw new Error(`Failed to fetch desktop manifest: ${response.status} ${response.statusText}`);
	}
	const rawManifest = await response.json();
	const manifestRecord =
		rawManifest && typeof rawManifest === "object"
			? (rawManifest as Record<string, unknown>)
			: { value: rawManifest };
	return parseDesktopReleaseManifest({
		...manifestRecord,
		channel: resolveManifestChannel(rawManifest, opts),
	});
}
