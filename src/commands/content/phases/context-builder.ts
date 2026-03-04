/**
 * Build rich prompt context for content generation from multiple sources:
 * brand guidelines, writing styles, git event details, recent content, and platform rules.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type Database from "better-sqlite3";
import type { ContentConfig, GitEvent, Platform } from "../types.js";
import { getRecentContent } from "./db-queries.js";

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
	db: Database.Database,
	platform: Platform,
): Promise<ContentContext> {
	return {
		brandGuidelines: loadBrandGuidelines(repoPath),
		writingStyles: loadWritingStyles(repoPath),
		gitEventDetails: formatGitEvent(event),
		recentContent: formatRecentContent(db),
		topPerformingContent: "", // Phase 8 will populate this
		platformRules: getPlatformRules(platform, config),
		projectReadme: loadProjectReadme(repoPath),
		currentDateTime: new Date().toISOString(),
	};
}

// ---------------------------------------------------------------------------
// File loaders
// ---------------------------------------------------------------------------

function loadBrandGuidelines(repoPath: string): string {
	const candidates = ["docs/brand-guidelines.md", "docs/design-guidelines.md"];
	for (const p of candidates) {
		const full = join(repoPath, p);
		if (existsSync(full)) {
			return readFileSync(full, "utf-8").slice(0, 2000);
		}
	}
	return "No brand guidelines found. Use a professional, friendly tone.";
}

function loadWritingStyles(repoPath: string): string {
	const stylesDir = join(repoPath, "assets", "writing-styles");
	if (!existsSync(stylesDir)) return "Use clear, conversational language.";
	try {
		const files = readdirSync(stylesDir) as string[];
		return files
			.slice(0, 3)
			.map((f) => readFileSync(join(stylesDir, f), "utf-8").slice(0, 500))
			.join("\n\n");
	} catch {
		return "";
	}
}

function loadProjectReadme(repoPath: string): string {
	const readmePath = join(repoPath, "README.md");
	if (!existsSync(readmePath)) return "";
	return readFileSync(readmePath, "utf-8").slice(0, 1000);
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatGitEvent(event: GitEvent): string {
	return [
		`Type: ${event.eventType}`,
		`Repo: ${event.repoName}`,
		`Title: ${event.title}`,
		event.body ? `Details: ${event.body.slice(0, 500)}` : "",
		`Author: ${event.author}`,
		`Date: ${event.createdAt}`,
	]
		.filter(Boolean)
		.join("\n");
}

function formatRecentContent(db: Database.Database): string {
	const recent = getRecentContent(db, 20);
	if (recent.length === 0) return "No previous content yet.";
	return recent.map((c) => `[${c.platform}] ${c.textContent.slice(0, 100)}`).join("\n");
}

// ---------------------------------------------------------------------------
// Platform rules
// ---------------------------------------------------------------------------

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
