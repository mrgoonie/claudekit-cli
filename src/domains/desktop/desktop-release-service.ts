import { parseDesktopReleaseManifest } from "@/domains/desktop/desktop-release-manifest.js";
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

export async function fetchDesktopReleaseManifest(
	opts?: { version?: string; channel?: DesktopChannel },
	fetchFn: typeof fetch = globalThis.fetch,
): Promise<DesktopReleaseManifest> {
	const response = await fetchFn(getDesktopManifestUrl(opts));
	if (!response.ok) {
		throw new Error(`Failed to fetch desktop manifest: ${response.status} ${response.statusText}`);
	}
	return parseDesktopReleaseManifest(await response.json());
}
