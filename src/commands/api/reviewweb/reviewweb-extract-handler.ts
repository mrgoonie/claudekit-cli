/**
 * Handler for `ck api reviewweb extract <url>` — Extract structured data
 */

import { createApiClient } from "@/domains/claudekit-api/index.js";
import { createSpinner } from "@/shared/safe-spinner.js";
import type { ReviewwebOptions } from "../types.js";

export async function handleReviewwebExtract(
	url: string,
	options: ReviewwebOptions,
): Promise<void> {
	const spinner = createSpinner("Extracting data...");
	spinner.start();

	try {
		const client = createApiClient();
		const body: Record<string, unknown> = { url };
		if (options.instructions) body.instructions = options.instructions;
		if (options.template) {
			try {
				body.jsonTemplate = JSON.parse(options.template);
			} catch {
				body.jsonTemplate = options.template;
			}
		}

		const response = await client.request<unknown>("/api/proxy/reviewweb/extract", {
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
