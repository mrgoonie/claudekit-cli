/**
 * Handler for `ck api vidcap comments <url>` — Video comments
 */

import { createApiClient } from "@/domains/claudekit-api/index.js";
import { createSpinner } from "@/shared/safe-spinner.js";
import type { VidcapOptions } from "../types.js";

/**
 * Extract video ID from YouTube URL or return as-is if already an ID
 */
function extractVideoId(urlOrId: string): string {
	try {
		const parsed = new URL(urlOrId);
		return parsed.searchParams.get("v") ?? parsed.pathname.split("/").pop() ?? urlOrId;
	} catch {
		return urlOrId;
	}
}

export async function handleVidcapComments(urlOrId: string, options: VidcapOptions): Promise<void> {
	const spinner = createSpinner("Fetching comments...");
	spinner.start();

	try {
		const client = createApiClient();
		const videoId = extractVideoId(urlOrId);
		const query: Record<string, string> = { videoId };
		if (options.order) query.order = options.order;

		const response = await client.request<unknown>("/api/proxy/vidcap/youtube/getComments", {
			query,
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
