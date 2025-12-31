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
	const accessible: KitType[] = [];

	const checks = Object.entries(AVAILABLE_KITS).map(async ([type, config]) => {
		try {
			await github.checkAccess(config);
			accessible.push(type as KitType);
			logger.debug(`Access confirmed: ${type}`);
		} catch {
			logger.debug(`No access to ${type}`);
		}
	});

	await Promise.all(checks);

	if (accessible.length === 0) {
		spinner.fail("No kit access found");
	} else {
		spinner.succeed(`Access verified: ${accessible.join(", ")}`);
	}

	return accessible;
}
