/**
 * Version Comparator
 * Semver comparison + prerelease/dev-channel-switch detection for the update pipeline.
 */

import { isPrereleaseVersion } from "@/domains/versioning/checking/version-utils.js";
import { compareVersions } from "compare-versions";

export type VersionComparisonOutcome =
	| { status: "up-to-date" }
	| { status: "newer"; changeType: "downgrade" }
	| { status: "older"; changeType: "upgrade" | "downgrade" }
	| { status: "dev-channel-switch"; changeType: "upgrade" };

/**
 * Compare current vs target version and determine the update action.
 *
 * Special case: when --dev/--beta is requested and the target is a prerelease
 * while current is stable, semver would say "current is newer" (3.31.0 > 3.31.0-dev.3).
 * We override that: it is a user-intentional channel switch → treat as upgrade.
 */
export function compareCliVersions(
	currentVersion: string,
	targetVersion: string,
	opts: { dev?: boolean; beta?: boolean; release?: string | null },
): VersionComparisonOutcome {
	const comparison = compareVersions(currentVersion, targetVersion);

	if (comparison === 0) {
		return { status: "up-to-date" };
	}

	// Dev channel switch: user on stable, explicitly requesting prerelease channel
	const isDevChannelSwitch =
		(opts.dev || opts.beta) &&
		isPrereleaseVersion(targetVersion) &&
		!isPrereleaseVersion(currentVersion);

	if (isDevChannelSwitch) {
		return { status: "dev-channel-switch", changeType: "upgrade" };
	}

	if (comparison > 0 && !opts.release) {
		// Current is newer than latest published — edge case (local/beta builds)
		return { status: "newer", changeType: "downgrade" };
	}

	return { status: "older", changeType: comparison < 0 ? "upgrade" : "downgrade" };
}

/** Thin wrapper kept for backward-compatibility with callers that use isBetaVersion name. */
export function isBetaVersion(version: string | undefined): boolean {
	return isPrereleaseVersion(version);
}

/**
 * Parse CLI version from `ck --version` output.
 * Returns null when output does not contain a recognizable version line.
 */
export function parseCliVersionFromOutput(output: string): string | null {
	if (!output) return null;
	const match = output.match(/CLI Version:\s*(\S+)/);
	return match ? match[1] : null;
}
