/**
 * Orchestrate the full content creation pipeline for a single git event.
 * Builds context → generates text via Claude CLI → validates → persists to DB → optional photo.
 */

import type { Database } from "bun:sqlite";
import { execSync } from "node:child_process";
import type {
	ContentCommandOptions,
	ContentConfig,
	ContentItem,
	GitEvent,
	Platform,
} from "../types.js";
import type { ContentLogger } from "./content-logger.js";
import { validateContent } from "./content-validator.js";
import { buildContentContext } from "./context-builder.js";
import { getContentById, insertContentItem, insertTaskLog } from "./db-queries.js";
import { extractContentFromResponse, parseClaudeJsonOutput } from "./output-parser.js";
import { generatePhoto } from "./photo-generator.js";
import { buildTextPrompt } from "./prompt-templates.js";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate content items for all enabled platforms from a single git event.
 * Returns all successfully created items; failed platforms are logged and skipped.
 */
export async function createContent(
	event: GitEvent,
	config: ContentConfig,
	db: Database,
	contentLogger: ContentLogger,
	options: ContentCommandOptions,
): Promise<ContentItem[]> {
	const startTime = Date.now();
	const items: ContentItem[] = [];

	const platforms = resolveEnabledPlatforms(config);

	for (const platform of platforms) {
		try {
			const item = await createContentForPlatform(
				event,
				platform,
				config,
				db,
				contentLogger,
				options,
			);
			if (item) items.push(item);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			contentLogger.error(`Failed to create ${platform} content: ${msg}`);
		}
	}

	insertTaskLog(db, {
		taskType: "content_creation",
		status: "completed",
		details: `event=${event.id}`,
		durationMs: Date.now() - startTime,
	});

	return items;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Return the list of enabled platforms from config. */
function resolveEnabledPlatforms(config: ContentConfig): Platform[] {
	const platforms: Platform[] = [];
	if (config.platforms.x.enabled) platforms.push("x");
	if (config.platforms.facebook.enabled) platforms.push("facebook");
	return platforms;
}

/** Generate, validate, persist, and optionally photo-enhance content for one platform. */
async function createContentForPlatform(
	event: GitEvent,
	platform: Platform,
	config: ContentConfig,
	db: Database,
	contentLogger: ContentLogger,
	options: ContentCommandOptions,
): Promise<ContentItem | null> {
	// Build context from all available sources
	const context = await buildContentContext(
		event,
		event.repoPath,
		config,
		db,
		platform,
		contentLogger,
	);
	const prompt = buildTextPrompt(context, platform);

	// Invoke Claude CLI (prompt via stdin to prevent shell injection)
	contentLogger.debug(`Generating ${platform} content for event ${event.id}...`);
	const stdout = execSync("claude -p --output-format text --max-turns 5", {
		input: prompt,
		stdio: ["pipe", "pipe", "pipe"],
		timeout: 300000,
	}).toString();

	// Parse and extract typed content
	const parsed = parseClaudeJsonOutput(stdout);
	const generated = extractContentFromResponse(parsed);

	// Validate quality — still store on failure so humans can review
	const validation = validateContent(generated, platform);
	if (!validation.valid) {
		contentLogger.warn(
			`Content validation failed for ${platform}: ${validation.issues.join(", ")}`,
		);
	}

	// Determine initial lifecycle status
	const status = validation.valid
		? config.reviewMode === "auto"
			? "scheduled"
			: "reviewing"
		: "draft";

	// Persist to DB
	const itemId = insertContentItem(db, {
		gitEventId: event.id,
		platform,
		textContent: generated.text,
		hashtags: JSON.stringify(generated.hashtags),
		hookLine: generated.hook,
		callToAction: generated.cta,
		mediaPath: null,
		status,
		scheduledAt: null,
	});

	// Optional photo generation (skipped in dry-run mode)
	if (!options.dryRun && generated.mediaPrompt) {
		const photo = await generatePhoto(generated, context, config, platform, itemId, contentLogger);
		if (photo) {
			db.prepare("UPDATE content_items SET media_path = ? WHERE id = ?").run(photo.path, itemId);
		}
	}

	contentLogger.info(`Created ${platform} content (id: ${itemId}, status: ${status})`);

	// Re-fetch to return the full persisted row with proper column mapping
	return getContentById(db, itemId);
}
