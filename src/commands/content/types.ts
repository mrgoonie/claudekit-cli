/**
 * Content command types and Zod schemas
 * Defines lifecycle states, config, runtime state, and DB row types
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Content lifecycle states */
export const ContentStatusEnum = z.enum([
	"draft",
	"scheduled",
	"reviewing",
	"approved",
	"publishing",
	"published",
	"failed",
]);
export type ContentStatus = z.infer<typeof ContentStatusEnum>;

/** Git event types that trigger content creation */
export const GitEventTypeEnum = z.enum(["commit", "pr_merged", "plan_completed", "tag", "release"]);
export type GitEventType = z.infer<typeof GitEventTypeEnum>;

/** Supported publishing platforms */
export const PlatformEnum = z.enum(["x", "x_thread", "facebook"]);
export type Platform = z.infer<typeof PlatformEnum>;

// ---------------------------------------------------------------------------
// Config schema (stored in .ck.json under "content" key)
// ---------------------------------------------------------------------------

export const ContentConfigSchema = z.object({
	enabled: z.boolean().default(false),
	pollIntervalMs: z.number().default(60000),
	platforms: z
		.object({
			x: z
				.object({
					enabled: z.boolean().default(false),
					maxPostsPerDay: z.number().default(5),
					threadMaxParts: z.number().default(6),
				})
				.default({}),
			facebook: z
				.object({
					enabled: z.boolean().default(false),
					maxPostsPerDay: z.number().default(3),
				})
				.default({}),
		})
		.default({}),
	reviewMode: z.enum(["auto", "manual", "hybrid"]).default("auto"),
	schedule: z
		.object({
			timezone: z.string().default("UTC"),
			quietHoursStart: z.string().default("23:00"),
			quietHoursEnd: z.string().default("06:00"),
		})
		.default({}),
	selfImprovement: z
		.object({
			enabled: z.boolean().default(true),
			engagementCheckIntervalHours: z.number().default(6),
			topPerformingCount: z.number().default(10),
		})
		.default({}),
	/** How many days to look back on the very first scan (default 30) */
	firstScanLookbackDays: z.number().min(1).max(365).default(30),
	maxContentPerDay: z.number().default(10),
	contentDir: z.string().default("~/.claudekit/content/"),
	dbPath: z.string().default("~/.claudekit/content.db"),
});
export type ContentConfig = z.infer<typeof ContentConfigSchema>;

// ---------------------------------------------------------------------------
// Runtime state schema (persisted alongside config)
// ---------------------------------------------------------------------------

export const ContentStateSchema = z.object({
	lastScanAt: z.string().nullable().default(null),
	lastEngagementCheckAt: z.string().nullable().default(null),
	lastCleanupAt: z.string().nullable().default(null),
	dailyPostCounts: z.record(z.string(), z.number()).default({}),
});
export type ContentState = z.infer<typeof ContentStateSchema>;

// ---------------------------------------------------------------------------
// DB row interfaces — mirror snake_case columns as camelCase TS properties
// ---------------------------------------------------------------------------

/** Row from git_events table */
export interface GitEvent {
	id: number;
	repoPath: string;
	repoName: string;
	eventType: GitEventType;
	/** Commit hash, PR number, tag name, or release tag */
	ref: string;
	title: string;
	body: string;
	author: string;
	createdAt: string;
	processed: boolean;
	contentWorthy: boolean;
	importance: "high" | "medium" | "low";
	retryCount: number;
}

/** Row from content_items table */
export interface ContentItem {
	id: number;
	gitEventId: number;
	platform: Platform;
	textContent: string;
	/** JSON-encoded string array of hashtags */
	hashtags: string;
	hookLine: string;
	callToAction: string;
	mediaPath: string | null;
	status: ContentStatus;
	scheduledAt: string | null;
	createdAt: string;
	updatedAt: string;
}

/** Row from publications table */
export interface Publication {
	id: number;
	contentItemId: number;
	platform: Platform;
	postId: string;
	postUrl: string;
	publishedAt: string;
}

// ---------------------------------------------------------------------------
// Command-level types
// ---------------------------------------------------------------------------

/** CLI options for the content command */
export interface ContentCommandOptions {
	dryRun?: boolean;
	verbose?: boolean;
	force?: boolean;
	tail?: boolean;
	platform?: string;
}

/** Result returned by the git scanner phase */
export interface ScanResult {
	totalRepos: number;
	eventsFound: number;
	contentWorthyEvents: number;
}
