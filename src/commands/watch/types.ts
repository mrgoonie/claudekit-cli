/**
 * Watch command types and Zod schemas
 * Defines config, state, and GitHub issue structures for the watch loop
 */

import { z } from "zod";

// Issue lifecycle status
export const IssueStatusEnum = z.enum([
	"new",
	"brainstorming",
	"clarifying",
	"planning",
	"plan_posted",
	"awaiting_approval", // plan posted, waiting for owner reply
	"implementing", // Claude CLI running implementation
	"completed",
	"error",
	"timeout",
]);
export type IssueStatus = z.infer<typeof IssueStatusEnum>;

// Per-issue tracking state
export const IssueStateSchema = z.object({
	status: IssueStatusEnum,
	turnsUsed: z.number().default(0),
	lastCommentId: z.number().optional(),
	createdAt: z.string(),
	title: z.string(),
	conversationHistory: z.array(z.string()).default([]),
	planPath: z.string().optional(), // path to generated plan file
	branchName: z.string().optional(), // git branch for this issue
	prUrl: z.string().optional(), // PR URL after creation
});
export type IssueState = z.infer<typeof IssueStateSchema>;

// Timestamped processed issue entry (migrated from legacy number[])
export const ProcessedIssueEntrySchema = z.object({
	issueNumber: z.number(),
	processedAt: z.string(),
});
export type ProcessedIssueEntry = z.infer<typeof ProcessedIssueEntrySchema>;

// Runtime state persisted in .ck.json under watch.state
export const WatchStateSchema = z.object({
	lastCheckedAt: z.string().optional(),
	activeIssues: z.record(z.string(), IssueStateSchema).default({}),
	processedIssues: z.array(z.union([z.number(), ProcessedIssueEntrySchema])).default([]),
	implementationQueue: z.array(z.number()).default([]), // issues approved, waiting to implement
	currentlyImplementing: z.number().nullable().default(null), // issue being implemented right now
	processedThisHour: z.number().default(0),
	hourStart: z.string().default(""),
});
export type WatchState = z.infer<typeof WatchStateSchema>;

// Worktree configuration — default OFF, opt-in via config
export const WorktreeConfigSchema = z.object({
	enabled: z.boolean().default(false),
	baseBranch: z.string().default("main"),
	maxConcurrent: z.number().min(1).default(3),
	autoCleanup: z.boolean().default(true),
});
export type WorktreeConfig = z.infer<typeof WorktreeConfigSchema>;

// Timeout configuration
export const WatchTimeoutsSchema = z.object({
	brainstormSec: z.number().default(300),
	planSec: z.number().default(600),
	implementSec: z.number().default(18000), // 5h for complex implementations
});
export type WatchTimeouts = z.infer<typeof WatchTimeoutsSchema>;

// User-configurable options in .ck.json under watch
export const WatchConfigSchema = z.object({
	pollIntervalMs: z.number().min(10000).default(30000),
	maxTurnsPerIssue: z.number().min(1).default(10),
	maxIssuesPerHour: z.number().min(1).default(10),
	excludeAuthors: z.array(z.string()).default([]),
	skipMaintainerReplies: z.boolean().default(false),
	autoDetectMaintainers: z.boolean().default(true),
	processedIssueTtlDays: z.number().min(1).default(7),
	worktree: WorktreeConfigSchema.default({}),
	showBranding: z.boolean().default(true),
	logMaxBytes: z.number().min(0).default(0), // 0 = unlimited log file size
	timeouts: WatchTimeoutsSchema.default({}),
	state: WatchStateSchema.default({}),
});
export type WatchConfig = z.infer<typeof WatchConfigSchema>;

// CLI flags for ck watch command
export const WatchCommandOptionsSchema = z.object({
	interval: z.number().optional(),
	dryRun: z.boolean().default(false),
	force: z.boolean().default(false),
	verbose: z.boolean().default(false),
});
export type WatchCommandOptions = z.infer<typeof WatchCommandOptionsSchema>;

// GitHub issue parsed from gh CLI output
export const GitHubIssueSchema = z.object({
	number: z.number(),
	title: z.string(),
	body: z.string().nullable().default(""),
	author: z.object({ login: z.string() }),
	createdAt: z.string(),
	updatedAt: z.string(),
	labels: z.array(z.object({ name: z.string() })).default([]),
	state: z.string(),
});
export type GitHubIssue = z.infer<typeof GitHubIssueSchema>;

// GitHub comment from API
export const GitHubCommentSchema = z.object({
	id: z.number(),
	body: z.string(),
	author: z.string(),
	createdAt: z.string(),
});
export type GitHubComment = z.infer<typeof GitHubCommentSchema>;

// Claude invocation result
export interface ClaudeResult {
	response: string;
	readyForPlan: boolean;
	questionsForUser: string[];
}

// Plan generation result
export interface PlanResult {
	planText: string;
	phases: Array<{ name: string; effort: string; description: string }>;
}

// Runtime stats for summary
export interface WatchStats {
	issuesProcessed: number;
	plansCreated: number;
	errors: number;
	startedAt: Date;
	implementationsCompleted: number;
}

// Result from approval detection
export interface ApprovalResult {
	approved: boolean;
	reason: string;
}
