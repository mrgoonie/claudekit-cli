/**
 * Handler for `ck api vidcap caption <url>` — Video transcript
 */

import { createApiClient } from "@/domains/claudekit-api/index.js";
import { createSpinner } from "@/shared/safe-spinner.js";
import type { VidcapOptions } from "../types.js";

export async function handleVidcapCaption(url: string, options: VidcapOptions): Promise<void> {
	const spinner = createSpinner("Fetching captions...");
	spinner.start();

	try {
		const client = createApiClient();
		const query: Record<string, string> = { url };
		if (options.locale) query.locale = options.locale;

		const response = await client.request<unknown>("/api/proxy/vidcap/youtube/getCaption", {
			query,
		});
		spinner.succeed("Done");

		if (options.json) {
			process.stdout.write(JSON.stringify(response.data, null, 2));
			return;
		}

		const data = response.data;
		console.log();
		console.log(typeof data === "string" ? data : JSON.stringify(data, null, 2));
		console.log();
	} catch (error) {
		spinner.fail("Failed");
		if (error instanceof Error) console.error(`  ${error.message}`);
		process.exitCode = 1;
	}
}
