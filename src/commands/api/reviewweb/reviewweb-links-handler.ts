/**
 * Handler for `ck api reviewweb links <url>` — Extract links
 */

import { createApiClient } from "@/domains/claudekit-api/index.js";
import { createSpinner } from "@/shared/safe-spinner.js";
import type { ReviewwebOptions } from "../types.js";

export async function handleReviewwebLinks(url: string, options: ReviewwebOptions): Promise<void> {
	const spinner = createSpinner("Extracting links...");
	spinner.start();

	try {
		const client = createApiClient();
		const body: Record<string, unknown> = { url };
		if (options.type) body.type = options.type;

		const response = await client.request<unknown>("/api/proxy/reviewweb/links", {
			method: "POST",
			body,
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
