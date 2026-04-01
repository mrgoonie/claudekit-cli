/**
 * Build rich prompt context for content generation.
 * Uses cached doc summaries (24h TTL) to minimize Claude calls.
 * Falls back to raw file reads when cache is unavailable.
 */

import type { ContentConfig, GitEvent, Platform } from "../types.js";
import type { ContentLogger } from "./content-logger.js";
import {
	type ContextCache,
	computeSourceHash,
	getCachedContext,
	saveCachedContext,
} from "./context-cache-manager.js";
import { getRecentContent } from "./db-queries.js";
import { summarizeProjectDocs } from "./docs-summarizer.js";
import type { Database } from "./sqlite-client.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContentContext {
	brandGuidelines: string;
	writingStyles: string;
	gitEventDetails: string;
	recentContent: string;
	topPerformingContent: string;
	platformRules: string;
	projectReadme: string;
	projectDocsSummary: string;
	currentDateTime: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Assemble all context sources needed to generate platform-specific content. */
export async function buildContentContext(
	event: GitEvent,
	repoPath: string,
	config: ContentConfig,
	db: Database,
	platform: Platform,
	contentLogger?: ContentLogger,
): Promise<ContentContext> {
	// Try cached context first (24h TTL, invalidated on doc changes)
	const cached = getCachedContext(repoPath);
	if (cached) {
		return buildFromCache(cached, event, db, platform, config);
	}

	// Cache miss — generate fresh summary and cache it
	// Use a no-op logger if none provided (e.g. during testing)
	const noopLogger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
	const log = contentLogger ?? (noopLogger as unknown as ContentLogger);

	const summary = await summarizeProjectDocs(repoPath, log);
	const hash = computeSourceHash(repoPath);
	const newCache: ContextCache = {
		createdAt: new Date().toISOString(),
		docsSummary: summary.docsSummary,
		brandSummary: summary.brandSummary,
		stylesSummary: summary.stylesSummary,
		readmeSummary: summary.readmeSummary,
		sourceHash: hash,
	};
	await saveCachedContext(repoPath, newCache);
	return buildFromCache(newCache, event, db, platform, config);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Build ContentContext from cached summaries + live data (git event, recent content). */
function buildFromCache(
	cache: ContextCache,
	event: GitEvent,
	db: Database,
	platform: Platform,
	config: ContentConfig,
): ContentContext {
	return {
		brandGuidelines: cache.brandSummary,
		writingStyles: cache.stylesSummary,
		gitEventDetails: formatGitEvent(event),
		recentContent: formatRecentContent(db),
		topPerformingContent: "",
		platformRules: getPlatformRules(platform, config),
		projectReadme: cache.readmeSummary,
		projectDocsSummary: cache.docsSummary,
		currentDateTime: new Date().toISOString(),
	};
}

function formatGitEvent(event: GitEvent): string {
	return [
		`Type: ${event.eventType}`,
		`Repo: ${event.repoName}`,
		`Title: ${sanitizeGitText(event.title)}`,
		event.body ? `Details: ${sanitizeGitText(event.body.slice(0, 500))}` : "",
		`Author: ${event.author}`,
		`Date: ${event.createdAt}`,
	]
		.filter(Boolean)
		.join("\n");
}

/**
 * Remove patterns from git-sourced text that could be interpreted as prompt instructions.
 * Basic defense-in-depth against prompt injection via crafted commit messages.
 */
function sanitizeGitText(text: string): string {
	return text
		.replace(/^(system|assistant|user|human):\s*/gim, "")
		.replace(/ignore\s+(all\s+)?previous\s+(instructions|context)/gi, "[filtered]")
		.replace(/<\/?(?:system|instructions|context|prompt)[^>]*>/gi, "[filtered]")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

function formatRecentContent(db: Database): string {
	const recent = getRecentContent(db, 20);
	if (recent.length === 0) return "No previous content yet.";
	return recent.map((c) => `[${c.platform}] ${c.textContent.slice(0, 100)}`).join("\n");
}

function getPlatformRules(platform: Platform, config: ContentConfig): string {
	switch (platform) {
		case "x":
			return [
				"Platform: X (Twitter)",
				"- Max length: 280 characters",
				"- Hashtags: 2-3 recommended",
				"- Format: Plain text only",
				"- Optimize for engagement and retweets",
			].join("\n");
		case "x_thread":
			return [
				"Platform: X Thread",
				`- Max parts: ${config.platforms.x.threadMaxParts}`,
				"- Each part: ≤280 characters",
				"- Format: Plain text, numbered if needed",
				"- First tweet must hook attention",
			].join("\n");
		case "facebook":
			return [
				"Platform: Facebook Page",
				"- Max length: 500 characters recommended",
				"- Hashtags: 3-5 recommended",
				"- Format: Plain text only",
				"- Optimize for comments and shares",
			].join("\n");
		default:
			return "";
	}
}
