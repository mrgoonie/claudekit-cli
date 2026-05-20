/**
 * Channel Resolver
 * Determines which npm dist-tag/version to fetch based on update options.
 * Stable = latest, prerelease = dev, specific = opts.release.
 */

import { NpmRegistryClient, redactRegistryUrlForLog } from "@/domains/github/npm-registry.js";
import { isPrereleaseVersion } from "@/domains/versioning/checking/version-utils.js";
import { CLAUDEKIT_CLI_NPM_PACKAGE_NAME } from "@/shared/claudekit-constants.js";
import { logger } from "@/shared/logger.js";
import type { UpdateCliOptions } from "@/types";
import { CliUpdateError } from "./error.js";
import type { UpdateCliNpmRegistryClient } from "./types.js";

export interface ChannelResolveResult {
	targetVersion: string;
	/** True when target is a prerelease (beta/alpha/rc/dev) */
	targetIsPrerelease: boolean;
}

export interface ChannelResolverDeps {
	npmRegistryClient?: UpdateCliNpmRegistryClient;
	registryUrl?: string | null;
	/** Spinner control: update its message as each sub-step resolves */
	spinnerStop: (msg: string) => void;
}

/**
 * Resolve the target npm version for the CLI update based on opts.
 * Handles three resolution paths:
 *   1. Specific version (opts.release != null)
 *   2. Prerelease channel (opts.dev || opts.beta)
 *   3. Latest stable
 */
export async function resolveTargetVersion(
	opts: Pick<UpdateCliOptions, "release" | "dev" | "beta">,
	deps: ChannelResolverDeps,
): Promise<ChannelResolveResult> {
	const client = deps.npmRegistryClient ?? NpmRegistryClient;
	const registryUrl = deps.registryUrl ?? undefined;
	const { spinnerStop } = deps;

	// ── Path 1: specific version requested ──────────────────────────────────
	if (opts.release && opts.release !== "latest") {
		let exists: boolean;
		try {
			exists = await client.versionExists(
				CLAUDEKIT_CLI_NPM_PACKAGE_NAME,
				opts.release,
				registryUrl,
			);
		} catch (error) {
			spinnerStop("Version check failed");
			const message = error instanceof Error ? error.message : "Unknown error";
			logger.verbose(`Release check failed for ${opts.release}: ${message}`);
			const registryHint = registryUrl
				? ` (${redactRegistryUrlForLog(registryUrl)})`
				: " (default registry)";
			throw new CliUpdateError(
				`Failed to verify version ${opts.release} on npm registry${registryHint}. Check registry settings/network connectivity and try again.`,
			);
		}

		if (!exists) {
			spinnerStop("Version not found");
			throw new CliUpdateError(
				`Version ${opts.release} does not exist on npm registry. Run 'ck versions' to see available versions.`,
			);
		}

		const targetVersion = opts.release;
		spinnerStop(`Target version: ${targetVersion}`);
		return { targetVersion, targetIsPrerelease: isPrereleaseVersion(targetVersion) };
	}

	// ── Path 2: prerelease channel ───────────────────────────────────────────
	const usePrereleaseChannel = opts.dev || opts.beta;
	if (usePrereleaseChannel) {
		let targetVersion = await client.getDevVersion(CLAUDEKIT_CLI_NPM_PACKAGE_NAME, registryUrl);
		if (!targetVersion) {
			spinnerStop("No dev version available");
			logger.warning("No dev version found. Using latest stable version instead.");
			targetVersion = await client.getLatestVersion(CLAUDEKIT_CLI_NPM_PACKAGE_NAME, registryUrl);
		} else {
			spinnerStop(`Latest dev version: ${targetVersion}`);
			return { targetVersion, targetIsPrerelease: isPrereleaseVersion(targetVersion) };
		}

		if (!targetVersion) {
			throw new CliUpdateError(
				"Failed to fetch version information from npm registry. Check your internet connection and try again.",
			);
		}
		spinnerStop(`Latest version: ${targetVersion}`);
		return { targetVersion, targetIsPrerelease: isPrereleaseVersion(targetVersion) };
	}

	// ── Path 3: latest stable ────────────────────────────────────────────────
	const targetVersion = await client.getLatestVersion(CLAUDEKIT_CLI_NPM_PACKAGE_NAME, registryUrl);
	spinnerStop(`Latest version: ${targetVersion || "unknown"}`);

	if (!targetVersion) {
		throw new CliUpdateError(
			"Failed to fetch version information from npm registry. Check your internet connection and try again.",
		);
	}

	return { targetVersion, targetIsPrerelease: isPrereleaseVersion(targetVersion) };
}
