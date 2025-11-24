import { compareVersions } from "compare-versions";
import { type GitHubRelease, type EnrichedRelease } from "../types.js";
import { logger } from "../utils/logger.js";

export class VersionFormatter {
	/**
	 * Strip 'v' prefix from version for comparison/storage
	 */
	static normalize(version: string): string {
		if (!version) return "";
		return version.replace(/^v/i, "");
	}

	/**
	 * Add 'v' prefix to version for consistent display
	 */
	static display(version: string): string {
		if (!version) return "";
		return version.startsWith("v") ? version : `v${version}`;
	}

	/**
	 * Compare two version strings using compare-versions package
	 */
	static compare(v1: string, v2: string): number {
		const normV1 = VersionFormatter.normalize(v1);
		const normV2 = VersionFormatter.normalize(v2);
		return compareVersions(normV1, normV2);
	}

	/**
	 * Format relative time from ISO date string
	 */
	static formatRelativeTime(dateString?: string): string {
		if (!dateString) return "Unknown";

		try {
			const date = new Date(dateString);
			const now = new Date();

			// Check if date is valid
			if (isNaN(date.getTime())) return "Unknown";

			const diffMs = now.getTime() - date.getTime();
			const diffSeconds = Math.floor(diffMs / 1000);
			const diffMinutes = Math.floor(diffSeconds / 60);
			const diffHours = Math.floor(diffMinutes / 60);
			const diffDays = Math.floor(diffHours / 24);

			if (diffSeconds < 60) {
				return "just now";
			} else if (diffMinutes < 60) {
				return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
			} else if (diffHours < 24) {
				return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
			} else if (diffDays < 7) {
				return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
			} else if (diffDays < 30) {
				const weeks = Math.floor(diffDays / 7);
				return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
			} else if (diffDays < 365) {
				const months = Math.floor(diffDays / 30);
				return `${months} month${months === 1 ? "" : "s"} ago`;
			} else {
				const years = Math.floor(diffDays / 365);
				return `${years} year${years === 1 ? "" : "s"} ago`;
			}
		} catch (error) {
			logger.debug(`Failed to format relative time for ${dateString}: ${error}`);
			return "Unknown";
		}
	}

	/**
	 * Enrich a release with additional metadata for display
	 */
	static enrichRelease(release: GitHubRelease): EnrichedRelease {
		const normalizedVersion = VersionFormatter.normalize(release.tag_name);
		const displayVersion = VersionFormatter.display(normalizedVersion);

		return {
			...release,
			displayVersion,
			normalizedVersion,
			relativeTime: VersionFormatter.formatRelativeTime(release.published_at),
			isLatestStable: false, // Will be set by ReleaseFilter.tagLatest
			isLatestBeta: false, // Will be set by ReleaseFilter.tagLatest
			assetCount: release.assets.length,
		};
	}

	/**
	 * Enrich multiple releases
	 */
	static enrichReleases(releases: GitHubRelease[]): EnrichedRelease[] {
		return releases.map((release) => VersionFormatter.enrichRelease(release));
	}

	/**
	 * Check if version string is valid
	 */
	static isValidVersion(version: string): boolean {
		if (!version) return false;
		const normalized = VersionFormatter.normalize(version);
		// Basic semantic version pattern (optional pre-release)
		const versionPattern = /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/;
		return versionPattern.test(normalized);
	}

	/**
	 * Extract major/minor/patch from version
	 */
	static parseVersion(version: string): {
		major: number;
		minor: number;
		patch: number;
		prerelease?: string;
	} | null {
		const normalized = VersionFormatter.normalize(version);
		const match = normalized.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);

		if (!match) return null;

		return {
			major: parseInt(match[1], 10),
			minor: parseInt(match[2], 10),
			patch: parseInt(match[3], 10),
			prerelease: match[4],
		};
	}

	/**
	 * Check if version is a prerelease
	 */
	static isPrerelease(version: string): boolean {
		const parsed = VersionFormatter.parseVersion(version);
		return parsed ? Boolean(parsed.prerelease) : false;
	}

	/**
	 * Sort versions by semantic version (newest first)
	 */
	static sortVersions(versions: string[]): string[] {
		return [...versions].sort((a, b) => {
			// Normalize both versions
			const normA = VersionFormatter.normalize(a);
			const normB = VersionFormatter.normalize(b);

			// Handle major version 0.x.x differently (lower priority)
			const majorA = parseInt(normA.split(".")[0], 10);
			const majorB = parseInt(normB.split(".")[0], 10);

			// If both are 0.x.x, sort normally
			if (majorA === 0 && majorB === 0) {
				return compareVersions(normB, normA); // descending
			}

			// If only one is 0.x.x, prioritize the non-zero version
			if (majorA === 0) return 1;
			if (majorB === 0) return -1;

			// Otherwise, sort by semantic version descending
			return compareVersions(normB, normA);
		});
	}
}