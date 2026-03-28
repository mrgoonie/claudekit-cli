/**
 * Handler for `ck api reviewweb scrape <url>` — Scrape webpage
 */

import { createApiClient } from "@/domains/claudekit-api/index.js";
import { createSpinner } from "@/shared/safe-spinner.js";
import type { ReviewwebOptions } from "../types.js";

export async function handleReviewwebScrape(url: string, options: ReviewwebOptions): Promise<void> {
	const spinner = createSpinner("Scraping webpage...");
	spinner.start();

	try {
		const client = createApiClient();
		const response = await client.request<unknown>("/api/proxy/reviewweb/scrape", {
			method: "POST",
			body: { url },
		});
		spinner.succeed("Done");

		if (options.json) {
			process.stdout.write(JSON.stringify(response.data, null, 2));
			return;
		}

		console.log();
		const data = response.data as Record<string, unknown>;
		console.log(typeof data.content === "string" ? data.content : JSON.stringify(data, null, 2));
		console.log();
	} catch (error) {
		spinner.fail("Failed");
		if (error instanceof Error) console.error(`  ${error.message}`);
		process.exitCode = 1;
	}
}
