/**
 * ReviewWeb sub-router — routes `ck api reviewweb <action>` to handler
 */

import pc from "picocolors";
import type { ReviewwebOptions } from "../types.js";
import { handleReviewwebExtract } from "./reviewweb-extract-handler.js";
import { handleReviewwebLinks } from "./reviewweb-links-handler.js";
import { handleReviewwebMarkdown } from "./reviewweb-markdown-handler.js";
import { handleReviewwebScrape } from "./reviewweb-scrape-handler.js";
import { handleReviewwebScreenshot } from "./reviewweb-screenshot-handler.js";
import { handleReviewwebSeoBacklinks } from "./reviewweb-seo-backlinks-handler.js";
import { handleReviewwebSeoKeywords } from "./reviewweb-seo-keywords-handler.js";
import { handleReviewwebSeoTraffic } from "./reviewweb-seo-traffic-handler.js";
import { handleReviewwebSummarize } from "./reviewweb-summarize-handler.js";

const handlers: Record<string, (arg: string, opts: ReviewwebOptions) => Promise<void>> = {
	scrape: handleReviewwebScrape,
	summarize: handleReviewwebSummarize,
	markdown: handleReviewwebMarkdown,
	extract: handleReviewwebExtract,
	links: handleReviewwebLinks,
	screenshot: handleReviewwebScreenshot,
	"seo-traffic": handleReviewwebSeoTraffic,
	"seo-keywords": handleReviewwebSeoKeywords,
	"seo-backlinks": handleReviewwebSeoBacklinks,
};

export async function reviewwebCommand(
	action: string | undefined,
	arg: string,
	options: ReviewwebOptions,
): Promise<void> {
	if (!action) {
		showReviewwebHelp();
		return;
	}

	const handler = handlers[action];
	if (!handler) {
		console.error(`Unknown reviewweb action: ${action}`);
		console.error(`Valid actions: ${Object.keys(handlers).join(", ")}`);
		process.exitCode = 1;
		return;
	}

	if (!arg) {
		console.error(`Usage: ck api reviewweb ${action} <url|domain|keyword>`);
		process.exitCode = 1;
		return;
	}

	await handler(arg, options);
}

function showReviewwebHelp(): void {
	console.log(pc.bold("ReviewWeb Commands"));
	console.log();
	console.log("  ck api reviewweb scrape <url>           Scrape webpage");
	console.log("  ck api reviewweb summarize <url>        AI summarize");
	console.log("  ck api reviewweb markdown <url>         Convert to markdown");
	console.log("  ck api reviewweb extract <url>          Extract structured data");
	console.log("  ck api reviewweb links <url>            Extract links");
	console.log("  ck api reviewweb screenshot <url>       Webpage screenshot");
	console.log("  ck api reviewweb seo-traffic <domain>   SEO traffic");
	console.log("  ck api reviewweb seo-keywords <kw>      SEO keywords");
	console.log("  ck api reviewweb seo-backlinks <domain> SEO backlinks");
	console.log();
}
