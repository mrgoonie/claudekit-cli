/**
 * Handler for `ck api reviewweb seo-backlinks <domain>` — SEO backlink analysis
 */

import { createApiClient } from "@/domains/claudekit-api/index.js";
import { createSpinner } from "@/shared/safe-spinner.js";
import type { ReviewwebOptions } from "../types.js";

export async function handleReviewwebSeoBacklinks(
	domain: string,
	options: ReviewwebOptions,
): Promise<void> {
	const spinner = createSpinner("Analyzing backlinks...");
	spinner.start();

	try {
		const client = createApiClient();
		const response = await client.request<unknown>("/api/proxy/reviewweb/seo/backlinks", {
			query: { domain },
		});
		spinner.succeed("Done");

		if (options.json) {
			process.stdout.write(JSON.stringify(response.data, null, 2));
			return;
		}

		console.log();
		console.log(JSON.stringify(response.data, null, 2));
		console.log();
	} catch (error) {
		spinner.fail("Failed");
		if (error instanceof Error) console.error(`  ${error.message}`);
		process.exitCode = 1;
	}
}
