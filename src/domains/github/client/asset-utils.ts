/**
 * Asset utilities for GitHub releases
 */
import { logger } from "@/shared/logger.js";
import type { GitHubRelease } from "@/types";

/**
 * Get downloadable asset or source code URL from release
 * Priority:
 * 1. "ClaudeKit Engineer Package" or "ClaudeKit Marketing Package" zip file
 * 2. Other custom uploaded assets (.tar.gz, .tgz, .zip) excluding "Source code" archives
 * 3. GitHub's automatic tarball URL
 */
export function getDownloadableAsset(release: GitHubRelease): {
	type: "asset" | "tarball" | "zipball";
	url: string;
	name: string;
	size?: number;
} {
	// Log all available assets for debugging
	logger.debug(`Available assets for ${release.tag_name}:`);
	if (release.assets.length === 0) {
		logger.debug("  No custom assets found");
	} else {
		release.assets.forEach((asset, index) => {
			logger.debug(`  ${index + 1}. ${asset.name} (${(asset.size / 1024 / 1024).toFixed(2)} MB)`);
		});
	}

	// First priority: Look for official ClaudeKit package assets
	const packageAsset = release.assets.find((a) => {
		const nameLower = a.name.toLowerCase();
		return (
			nameLower.includes("claudekit") && nameLower.includes("package") && nameLower.endsWith(".zip")
		);
	});

	if (packageAsset) {
		logger.debug(`Selected ClaudeKit package asset: ${packageAsset.name}`);
		return {
			type: "asset",
			url: packageAsset.url, // Use API endpoint for authenticated downloads
			name: packageAsset.name,
			size: packageAsset.size,
		};
	}

	logger.debug("No ClaudeKit package asset found, checking for other custom assets...");

	// Second priority: Look for any custom uploaded assets (excluding GitHub's automatic source code archives)
	const customAsset = release.assets.find(
		(a) =>
			(a.name.endsWith(".tar.gz") || a.name.endsWith(".tgz") || a.name.endsWith(".zip")) &&
			!a.name.toLowerCase().startsWith("source") &&
			!a.name.toLowerCase().includes("source code"),
	);

	if (customAsset) {
		logger.debug(`Selected custom asset: ${customAsset.name}`);
		return {
			type: "asset",
			url: customAsset.url, // Use API endpoint for authenticated downloads
			name: customAsset.name,
			size: customAsset.size,
		};
	}

	// Fall back to GitHub's automatic tarball
	logger.debug("No custom assets found, falling back to GitHub automatic tarball");
	return {
		type: "tarball",
		url: release.tarball_url,
		name: `${release.tag_name}.tar.gz`,
		size: undefined, // Size unknown for automatic tarballs
	};
}
