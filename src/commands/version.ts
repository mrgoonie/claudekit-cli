import { GitHubClient } from "@/domains/github/github-client.js";
import { PromptsManager } from "@/domains/ui/prompts.js";
import { logger } from "@/shared/logger.js";
import {
	AVAILABLE_KITS,
	type GitHubRelease,
	type VersionCommandOptions,
	VersionCommandOptionsSchema,
} from "@/types";
import pc from "picocolors";

/**
 * Format a date as a relative time string
 */
function formatRelativeTime(dateString?: string): string {
	if (!dateString) return "Unknown";

	const date = new Date(dateString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays === 0) return "Today";
	if (diffDays === 1) return "Yesterday";
	if (diffDays < 7) return `${diffDays} days ago`;
	if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
	if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
	return `${Math.floor(diffDays / 365)} years ago`;
}

/**
 * Display releases for a single kit
 */
function displayKitReleases(kitName: string, releases: GitHubRelease[]): void {
	console.log(`\n${pc.bold(pc.cyan(kitName))} - Available Versions:\n`);

	if (releases.length === 0) {
		console.log(pc.dim("  No releases found"));
		return;
	}

	for (const release of releases) {
		const version = pc.green(release.tag_name);
		const name = release.name || "No title";
		const publishedAt = formatRelativeTime(release.published_at);
		const assetCount = release.assets.length;

		// Add badges for prerelease and draft
		const badges: string[] = [];
		if (release.prerelease) badges.push(pc.yellow("[prerelease]"));
		if (release.draft) badges.push(pc.gray("[draft]"));
		const badgeStr = badges.length > 0 ? ` ${badges.join(" ")}` : "";

		// Format: version  |  name  |  time  |  assets
		const versionPart = version.padEnd(20);
		const namePart = name.length > 40 ? `${name.slice(0, 37)}...` : name.padEnd(40);
		const timePart = pc.dim(publishedAt.padEnd(20));
		const assetPart = pc.dim(`(${assetCount} ${assetCount === 1 ? "asset" : "assets"})`);

		console.log(`  ${versionPart}  ${namePart}  ${timePart}  ${assetPart}${badgeStr}`);
	}

	console.log(
		pc.dim(`\nShowing ${releases.length} ${releases.length === 1 ? "release" : "releases"}`),
	);
}

/**
 * Version command - List available versions of ClaudeKit repositories
 */
export async function versionCommand(options: VersionCommandOptions): Promise<void> {
	const prompts = new PromptsManager();

	prompts.intro("📦 ClaudeKit - Available Versions");

	try {
		// Validate and parse options
		const validOptions = VersionCommandOptionsSchema.parse(options);

		// Determine which kits to fetch
		const kitsToFetch = validOptions.kit
			? [validOptions.kit]
			: (Object.keys(AVAILABLE_KITS) as Array<keyof typeof AVAILABLE_KITS>);

		// Initialize GitHub client
		const github = new GitHubClient();

		// Determine limit (default to 30, similar to GitHub CLI)
		const limit = validOptions.limit || 30;

		// Fetch releases for all requested kits in parallel
		const releasePromises = kitsToFetch.map(async (kitType) => {
			const kitConfig = AVAILABLE_KITS[kitType];
			try {
				const releases = await github.listReleases(kitConfig, limit);

				// Filter out drafts and prereleases unless --all flag is set
				const filteredReleases = validOptions.all
					? releases
					: releases.filter((r) => !r.draft && !r.prerelease);

				return {
					kitType,
					kitConfig,
					releases: filteredReleases,
					error: null,
				};
			} catch (error) {
				return {
					kitType,
					kitConfig,
					releases: [],
					error: error instanceof Error ? error.message : "Unknown error",
				};
			}
		});

		const results = await Promise.all(releasePromises);

		// Display results
		for (const result of results) {
			if (result.error) {
				console.log(`\n${pc.bold(pc.cyan(result.kitConfig.name))} - ${pc.red("Error")}`);
				console.log(pc.dim(`  ${result.error}`));
			} else {
				displayKitReleases(result.kitConfig.name, result.releases);
			}
		}

		prompts.outro("✨ Done");
	} catch (error) {
		logger.error(error instanceof Error ? error.message : "Unknown error occurred");
		process.exit(1);
	}
}
