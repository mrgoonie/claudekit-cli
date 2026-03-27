/**
 * VidCap sub-router — routes `ck api vidcap <action>` to handler
 */

import pc from "picocolors";
import type { VidcapOptions } from "../types.js";
import { handleVidcapCaption } from "./vidcap-caption-handler.js";
import { handleVidcapComments } from "./vidcap-comments-handler.js";
import { handleVidcapInfo } from "./vidcap-info-handler.js";
import { handleVidcapMedia } from "./vidcap-media-handler.js";
import { handleVidcapScreenshot } from "./vidcap-screenshot-handler.js";
import { handleVidcapSearch } from "./vidcap-search-handler.js";
import { handleVidcapSummary } from "./vidcap-summary-handler.js";

const handlers: Record<string, (arg: string, opts: VidcapOptions) => Promise<void>> = {
	info: handleVidcapInfo,
	search: handleVidcapSearch,
	summary: handleVidcapSummary,
	caption: handleVidcapCaption,
	screenshot: handleVidcapScreenshot,
	comments: handleVidcapComments,
	media: handleVidcapMedia,
};

export async function vidcapCommand(
	action: string | undefined,
	arg: string,
	options: VidcapOptions,
): Promise<void> {
	if (!action) {
		showVidcapHelp();
		return;
	}

	const handler = handlers[action];
	if (!handler) {
		console.error(`Unknown vidcap action: ${action}`);
		console.error(`Valid actions: ${Object.keys(handlers).join(", ")}`);
		process.exitCode = 1;
		return;
	}

	if (!arg) {
		console.error(`Usage: ck api vidcap ${action} <url${action === "search" ? "|query" : ""}>`);
		process.exitCode = 1;
		return;
	}

	await handler(arg, options);
}

function showVidcapHelp(): void {
	console.log(pc.bold("VidCap Commands"));
	console.log();
	console.log("  ck api vidcap info <url>          Video metadata");
	console.log("  ck api vidcap search <query>      YouTube search");
	console.log("  ck api vidcap summary <url>       AI video summary");
	console.log("  ck api vidcap caption <url>       Video transcript");
	console.log("  ck api vidcap screenshot <url>    Video screenshot");
	console.log("  ck api vidcap comments <url>      Video comments");
	console.log("  ck api vidcap media <url>         Media formats");
	console.log();
}
