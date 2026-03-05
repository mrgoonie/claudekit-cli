/**
 * Shared types for Claude data services
 */

import { z } from "zod";

// Single history entry from ~/.claude/history.jsonl
export const HistoryEntrySchema = z.object({
	display: z.string(),
	pastedContents: z.record(z.unknown()).optional(),
	timestamp: z.number(), // Unix ms
	project: z.string(),
});
export type HistoryEntry = z.infer<typeof HistoryEntrySchema>;

// Parsed project from history
export interface HistoryProject {
	path: string;
	lastUsed: number; // Unix ms
	interactionCount: number;
}

// Parse result with metadata
export interface HistoryParseResult {
	projects: HistoryProject[];
	totalEntries: number;
	errorCount: number;
	parseTimeMs: number;
	error?: string; // Surface errors to UI
}

// Cache entry for mtime-based invalidation
export interface HistoryCacheEntry {
	mtime: number;
	result: HistoryParseResult;
}

// Unified project discovery result (Phase 3)
export interface DiscoveredProject {
	path: string;
	name: string; // basename of path
	lastUsed: number | null; // Unix ms, null if unknown
	source: "session" | "history" | "both";
	exists: boolean; // path exists on filesystem
	interactionCount?: number; // from history
}

export interface ProjectDiscoveryResult {
	projects: DiscoveredProject[];
	totalFromSessions: number;
	totalFromHistory: number;
	parseTimeMs: number;
	error?: string;
}

// User preferences from ~/.claude.json
export const UserPreferencesSchema = z.object({
	numStartups: z.number().optional(),
	theme: z.enum(["dark", "light", "dark-daltonized"]).optional(),
	installMethod: z.string().optional(),
	autoUpdates: z.boolean().optional(),
	firstStartTime: z.string().optional(), // ISO 8601
	hasSeenTasksHint: z.boolean().optional(),
	hasSeenStashHint: z.boolean().optional(),
	promptQueueUseCount: z.number().optional(),
});
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

// Tips history
export const TipsHistorySchema = z.record(z.string(), z.number());
export type TipsHistory = z.infer<typeof TipsHistorySchema>;

// Feature flags
export const FeatureFlagsSchema = z.object({
	statsigGates: z.record(z.string(), z.boolean()).optional(),
	growthBookFeatures: z.record(z.string(), z.unknown()).optional(),
});
export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;

// Full preferences result
export interface UserPreferencesResult {
	preferences: UserPreferences;
	tipsHistory: TipsHistory;
	featureFlags: FeatureFlags;
	rawSize: number; // bytes
	parseTimeMs: number;
	error?: string; // Surface errors to UI
}

// Cache entry
export interface PreferencesCacheEntry {
	mtime: number;
	result: UserPreferencesResult;
}
