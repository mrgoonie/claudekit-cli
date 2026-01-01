/**
 * Kit Access Checker
 * Detects which kits the user has GitHub access to
 */
import { logger } from "@/shared/logger.js";
import { createSpinner } from "@/shared/safe-spinner.js";
import { AVAILABLE_KITS, type KitType } from "@/types";
import { GitHubClient } from "./github-client.js";

/**
 * Check access to all available kits in parallel
 * @returns Array of kit types the user has access to
 */
export async function detectAccessibleKits(): Promise<KitType[]> {
	const spinner = createSpinner("Checking kit access...").start();
	const github = new GitHubClient();

	// Check all kits in parallel, return kit type or null
	const results = await Promise.all(
		Object.entries(AVAILABLE_KITS).map(async ([type, config]) => {
			try {
				await github.checkAccess(config);
				logger.debug(`Access confirmed: ${type}`);
				return type as KitType;
			} catch {
				logger.debug(`No access to ${type}`);
				return null;
			}
		}),
	);

	// Filter out nulls (no race condition - sequential after Promise.all)
	const accessible = results.filter((kit): kit is KitType => kit !== null);

	if (accessible.length === 0) {
		spinner.fail("No kit access found");
	} else {
		spinner.succeed(`Access verified: ${accessible.join(", ")}`);
	}

	return accessible;
}
