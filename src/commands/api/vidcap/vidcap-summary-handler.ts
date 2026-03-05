/**
 * Handler for `ck api vidcap summary <url>` — AI video summary
 */

import { createApiClient } from "@/domains/claudekit-api/index.js";
import { createSpinner } from "@/shared/safe-spinner.js";
import type { VidcapOptions } from "../types.js";

export async function handleVidcapSummary(url: string, options: VidcapOptions): Promise<void> {
	const spinner = createSpinner("Generating summary...");
	spinner.start();

	try {
		const client = createApiClient();
		const query: Record<string, string> = { url };
		if (options.locale) query.locale = options.locale;

		const response = await client.request<unknown>("/api/proxy/vidcap/youtube/getSummary", {
			query,
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
