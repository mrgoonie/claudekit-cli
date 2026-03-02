/**
 * Handler for `ck api reviewweb summarize <url>` — AI summarize webpage
 */

import { createApiClient } from "@/domains/claudekit-api/index.js";
import { createSpinner } from "@/shared/safe-spinner.js";
import type { ReviewwebOptions } from "../types.js";

export async function handleReviewwebSummarize(
	url: string,
	options: ReviewwebOptions,
): Promise<void> {
	const spinner = createSpinner("Summarizing webpage...");
	spinner.start();

	try {
		const client = createApiClient();
		const body: Record<string, unknown> = { url };
		if (options.format) body.format = options.format;
		if (options.maxLength) body.maxLength = options.maxLength;

		const response = await client.request<unknown>("/api/proxy/reviewweb/summarize", {
			method: "POST",
			body,
		});
		spinner.succeed("Done");

		if (options.json) {
			process.stdout.write(JSON.stringify(response.data, null, 2));
			return;
		}

		const data = response.data as Record<string, unknown>;
		console.log();
		console.log(String(data.summary ?? JSON.stringify(data, null, 2)));
		console.log();
	} catch (error) {
		spinner.fail("Failed");
		if (error instanceof Error) console.error(`  ${error.message}`);
		process.exitCode = 1;
	}
}
