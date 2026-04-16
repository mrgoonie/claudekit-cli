import { parseDesktopReleaseManifest } from "@/domains/desktop/desktop-release-manifest.js";
import type { DesktopReleaseManifest } from "@/types/desktop.js";

const DESKTOP_RELEASE_REPOSITORY = "https://github.com/mrgoonie/claudekit-cli/releases/download";

export function getDesktopManifestUrl(version?: string): string {
	const tag = version ? `desktop-v${version}` : "desktop-latest";
	return `${DESKTOP_RELEASE_REPOSITORY}/${tag}/desktop-manifest.json`;
}

export async function fetchDesktopReleaseManifest(
	version?: string,
	fetchFn: typeof fetch = globalThis.fetch,
): Promise<DesktopReleaseManifest> {
	const response = await fetchFn(getDesktopManifestUrl(version));
	if (!response.ok) {
		throw new Error(`Failed to fetch desktop manifest: ${response.status} ${response.statusText}`);
	}
	return parseDesktopReleaseManifest(await response.json());
}
