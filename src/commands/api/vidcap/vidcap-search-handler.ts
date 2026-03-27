/**
 * Handler for `ck api vidcap search <query>` — YouTube search
 */

import { createApiClient } from "@/domains/claudekit-api/index.js";
import { createSpinner } from "@/shared/safe-spinner.js";
import type { VidcapOptions } from "../types.js";

export async function handleVidcapSearch(query: string, options: VidcapOptions): Promise<void> {
	const spinner = createSpinner("Searching YouTube...");
	spinner.start();

	try {
		const client = createApiClient();
		const queryParams: Record<string, string> = { query };
		if (options.maxResults) queryParams.maxResults = String(options.maxResults);

		const response = await client.request<unknown>("/api/proxy/vidcap/youtube/search", {
			query: queryParams,
		});
		spinner.succeed("Done");

		if (options.json) {
			process.stdout.write(JSON.stringify(response.data, null, 2));
			return;
		}

		const results = Array.isArray(response.data) ? response.data : [];
		console.log();
		if (results.length === 0) {
			console.log("  No results found.");
		} else {
			for (const r of results) {
				const item = r as Record<string, unknown>;
				console.log(`  ${item.title ?? "Untitled"}`);
				if (item.url) console.log(`    ${item.url}`);
				console.log();
			}
		}
	} catch (error) {
		spinner.fail("Search failed");
		if (error instanceof Error) console.error(`  ${error.message}`);
		process.exitCode = 1;
	}
}
