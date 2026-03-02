/**
 * Handler for `ck api reviewweb markdown <url>` — Convert webpage to markdown
 */

import { createApiClient } from "@/domains/claudekit-api/index.js";
import { createSpinner } from "@/shared/safe-spinner.js";
import type { ReviewwebOptions } from "../types.js";

export async function handleReviewwebMarkdown(
	url: string,
	options: ReviewwebOptions,
): Promise<void> {
	const spinner = createSpinner("Converting to markdown...");
	spinner.start();

	try {
		const client = createApiClient();
		const response = await client.request<unknown>("/api/proxy/reviewweb/markdown", {
			method: "POST",
			body: { url },
		});
		spinner.succeed("Done");

		if (options.json) {
			process.stdout.write(JSON.stringify(response.data, null, 2));
			return;
		}

		const data = response.data as Record<string, unknown>;
		console.log();
		console.log(String(data.markdown ?? data.content ?? JSON.stringify(data, null, 2)));
		console.log();
	} catch (error) {
		spinner.fail("Failed");
		if (error instanceof Error) console.error(`  ${error.message}`);
		process.exitCode = 1;
	}
}
