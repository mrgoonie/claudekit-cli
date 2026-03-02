/**
 * Handler for `ck api vidcap info <url>` — YouTube video metadata
 */

import { createApiClient } from "@/domains/claudekit-api/index.js";
import { createSpinner } from "@/shared/safe-spinner.js";
import type { VidcapOptions } from "../types.js";

export async function handleVidcapInfo(url: string, options: VidcapOptions): Promise<void> {
	const spinner = createSpinner("Fetching video info...");
	spinner.start();

	try {
		const client = createApiClient();
		const response = await client.request<Record<string, unknown>>(
			"/api/proxy/vidcap/youtube/getInfo",
			{ query: { url } },
		);
		spinner.succeed("Done");

		if (options.json) {
			process.stdout.write(JSON.stringify(response.data, null, 2));
			return;
		}

		const d = response.data;
		console.log();
		if (d.title) console.log(`  Title:    ${d.title}`);
		if (d.duration) console.log(`  Duration: ${d.duration}`);
		if (d.author) console.log(`  Author:   ${d.author}`);
		if (d.viewCount) console.log(`  Views:    ${d.viewCount}`);
		console.log();
	} catch (error) {
		spinner.fail("Failed");
		if (error instanceof Error) console.error(`  ${error.message}`);
		process.exitCode = 1;
	}
}
