/**
 * Handler for `ck api vidcap screenshot <url>` — Video screenshot
 */

import { createApiClient } from "@/domains/claudekit-api/index.js";
import { createSpinner } from "@/shared/safe-spinner.js";
import type { VidcapOptions } from "../types.js";

export async function handleVidcapScreenshot(url: string, options: VidcapOptions): Promise<void> {
	const spinner = createSpinner("Taking screenshot...");
	spinner.start();

	try {
		const client = createApiClient();
		const query: Record<string, string> = { url };
		if (options.second) query.second = options.second;

		const response = await client.request<unknown>("/api/proxy/vidcap/youtube/getScreenshot", {
			query,
		});
		spinner.succeed("Done");

		if (options.json) {
			process.stdout.write(JSON.stringify(response.data, null, 2));
			return;
		}

		const data = response.data as Record<string, unknown>;
		console.log();
		if (data.url) console.log(`  Screenshot URL: ${data.url}`);
		else console.log(JSON.stringify(data, null, 2));
		console.log();
	} catch (error) {
		spinner.fail("Failed");
		if (error instanceof Error) console.error(`  ${error.message}`);
		process.exitCode = 1;
	}
}
