/**
 * Handler for `ck api status` — validate API key and show rate limit info
 */

import { createApiClient } from "@/domains/claudekit-api/index.js";
import { createSpinner } from "@/shared/safe-spinner.js";
import type { CkApiValidationResult } from "@/types/claudekit-api.js";
import type { ApiStatusOptions } from "../types.js";

/**
 * Format reset timestamp as human-readable relative time
 */
function formatResetTime(resetUnix: number): string {
	if (!resetUnix) return "unknown";
	const diffMs = resetUnix * 1000 - Date.now();
	if (diffMs <= 0) return "now";
	const mins = Math.ceil(diffMs / 60_000);
	return mins === 1 ? "1 minute" : `${mins} minutes`;
}

export async function handleApiStatus(options: ApiStatusOptions): Promise<void> {
	const spinner = createSpinner("Validating API key...");
	spinner.start();

	try {
		const client = createApiClient();
		const response = await client.request<CkApiValidationResult>("/api/keys/validate", {
			method: "POST",
		});

		spinner.succeed("API key validated");

		if (options.json) {
			process.stdout.write(
				JSON.stringify({ ...response.data, rateLimit: response.rateLimit }, null, 2),
			);
			return;
		}

		const { data, rateLimit } = response;
		console.log();
		console.log(`  User ID:    ${data.userId ?? "unknown"}`);
		console.log(`  Active:     ${data.isActive ? "yes" : "no"}`);
		console.log(`  Rate Limit: ${rateLimit.remaining}/${rateLimit.limit} remaining`);
		console.log(`  Resets in:  ${formatResetTime(rateLimit.reset)}`);
		console.log();
	} catch (error) {
		spinner.fail("Validation failed");
		handleError(error);
	}
}

function handleError(error: unknown): void {
	if (error instanceof Error) {
		console.error(`  ${error.message}`);
	}
	process.exitCode = 1;
}
