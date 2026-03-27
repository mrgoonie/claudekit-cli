/**
 * Terminal preview renderer for ContentItem records.
 * Uses picocolors for colour output — no interactive prompts.
 */

import pc from "picocolors";
import type { ContentItem, Platform } from "../types.js";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Render a content preview to stdout. */
export function previewContent(content: ContentItem): void {
	const badge = getPlatformBadge(content.platform);
	const statusColor = getStatusColor(content.status);

	console.log();
	console.log(`${badge}  ${statusColor(content.status.toUpperCase())}  ID: ${content.id}`);
	console.log(pc.dim("─".repeat(60)));

	// Hook line
	if (content.hookLine) {
		console.log(pc.bold(pc.cyan("Hook: ")) + content.hookLine);
	}

	// Full text
	console.log();
	console.log(content.textContent);
	console.log();

	// Hashtags
	if (content.hashtags && content.hashtags !== "[]") {
		try {
			const tags = JSON.parse(content.hashtags) as string[];
			if (tags.length > 0) {
				console.log(pc.dim("Tags: ") + tags.map((t) => pc.blue(`#${t}`)).join(" "));
			}
		} catch {
			/* ignore parse errors */
		}
	}

	// CTA
	if (content.callToAction) {
		console.log(pc.dim("CTA: ") + content.callToAction);
	}

	// Media
	if (content.mediaPath) {
		console.log(pc.dim("Media: ") + content.mediaPath);
	}

	// Schedule
	if (content.scheduledAt) {
		console.log(pc.dim("Scheduled: ") + content.scheduledAt);
	}

	console.log(pc.dim("─".repeat(60)));
	console.log();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPlatformBadge(platform: Platform): string {
	switch (platform) {
		case "x":
			return pc.bgBlue(pc.white(" X "));
		case "x_thread":
			return pc.bgBlue(pc.white(" X Thread "));
		case "facebook":
			return pc.bgCyan(pc.white(" Facebook "));
		default:
			return pc.bgBlack(pc.white(` ${platform} `));
	}
}

function getStatusColor(status: string): (s: string) => string {
	switch (status) {
		case "published":
			return pc.green;
		case "failed":
			return pc.red;
		case "reviewing":
			return pc.yellow;
		case "scheduled":
			return pc.blue;
		case "draft":
			return pc.gray;
		default:
			return pc.white;
	}
}
