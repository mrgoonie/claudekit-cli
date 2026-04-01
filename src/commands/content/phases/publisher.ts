/**
 * Publishing orchestrator for the content command.
 * Coordinates auth verification, rate limiting, adapter dispatch,
 * DB recording, and task logging for a single ContentItem.
 */

import { logger } from "@/shared/logger.js";
import type { ContentCommandOptions, ContentConfig, ContentItem, ContentState } from "../types.js";
import type { ContentLogger } from "./content-logger.js";
import { insertPublication, insertTaskLog, updateContentStatus } from "./db-queries.js";
import type { PlatformAdapter, PublishResult } from "./platform-adapters/adapter-interface.js";
import { RateLimiter } from "./platform-adapters/rate-limiter.js";
import type { Database } from "./sqlite-client.js";

// ---------------------------------------------------------------------------
// Thread splitting
// ---------------------------------------------------------------------------

/**
 * Split a thread body into individual parts.
 * Recognises numbered sections like "1. ", "1/ ", "2. ", etc.
 * Falls back to newline-separated chunks if no numbering is found.
 */
function splitThreadParts(text: string): string[] {
	const numbered = text.split(/\n\d+[/.]\s+/).filter(Boolean);
	if (numbered.length > 1) return numbered;
	return text.split(/\n{2,}/).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Attempt to publish one ContentItem via the appropriate platform adapter.
 * Returns an array of PublishResult (empty when gated by quiet hours / rate limit).
 */
export async function publishContent(
	content: ContentItem,
	config: ContentConfig,
	state: ContentState,
	db: Database,
	contentLogger: ContentLogger,
	adapters: Map<string, PlatformAdapter>,
	options: ContentCommandOptions,
): Promise<PublishResult[]> {
	const startTime = Date.now();
	const results: PublishResult[] = [];
	const rateLimiter = new RateLimiter(state, config);

	// -- Quiet hours gate ----------------------------------------------------
	if (rateLimiter.isInQuietHours()) {
		contentLogger.debug("In quiet hours, deferring publication.");
		return results;
	}

	// -- Rate limit gate -----------------------------------------------------
	if (!rateLimiter.canPost(content.platform)) {
		contentLogger.info(`Rate limit reached for ${content.platform}. Remaining: 0`);
		return results;
	}

	// -- Adapter lookup -------------------------------------------------------
	// x_thread content is published via the X adapter's publishThread method
	const adapterKey = content.platform === "x_thread" ? "x" : content.platform;
	const adapter = adapters.get(adapterKey);
	if (!adapter) {
		contentLogger.warn(`No adapter registered for platform: ${content.platform}`);
		return results;
	}

	// -- Auth check -----------------------------------------------------------
	const authStatus = await adapter.verifyAuth();
	if (!authStatus.authenticated) {
		contentLogger.error(`Auth failed for ${content.platform}: ${authStatus.error}`);
		updateContentStatus(db, content.id, "failed");
		return results;
	}

	// -- Mark as in-flight ----------------------------------------------------
	updateContentStatus(db, content.id, "publishing");

	// -- Dispatch to adapter --------------------------------------------------
	const publishOpts = { dryRun: options.dryRun };
	let result: PublishResult;

	try {
		if (content.mediaPath) {
			result = await adapter.publishPhoto(content.textContent, content.mediaPath, publishOpts);
		} else if (content.platform === "x_thread" && adapter.publishThread) {
			const parts = splitThreadParts(content.textContent);
			result = await adapter.publishThread(parts, publishOpts);
		} else {
			result = await adapter.publishText(content.textContent, publishOpts);
		}
	} catch (err) {
		result = {
			success: false,
			postId: "",
			postUrl: "",
			error: err instanceof Error ? err.message : String(err),
		};
	}

	// -- Persist outcome ------------------------------------------------------
	if (result.success) {
		insertPublication(db, {
			contentItemId: content.id,
			platform: content.platform,
			postId: result.postId,
			postUrl: result.postUrl,
		});
		updateContentStatus(db, content.id, "published");
		rateLimiter.recordPost(content.platform);
		contentLogger.info(`Published to ${content.platform}: ${result.postUrl}`);
	} else {
		updateContentStatus(db, content.id, "failed");
		contentLogger.error(`Failed to publish to ${content.platform}: ${result.error}`);
		logger.debug(
			`Publish error detail — contentId=${content.id} platform=${content.platform} err=${result.error}`,
		);
	}

	results.push(result);

	// -- Task log -------------------------------------------------------------
	insertTaskLog(db, {
		taskType: "publishing",
		status: result.success ? "completed" : "failed",
		details: `content=${content.id} platform=${content.platform}`,
		durationMs: Date.now() - startTime,
	});

	return results;
}
