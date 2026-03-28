/**
 * Unit tests for state-cleanup utilities
 * Covers: migration, isProcessed, removeFromProcessed, cleanExpiredIssues, backward compat
 */

import { describe, expect, it } from "bun:test";
import {
	cleanExpiredIssues,
	isProcessed,
	migrateProcessedIssues,
	removeFromProcessed,
} from "../../../commands/watch/phases/state-cleanup.js";
import type { ProcessedIssueEntry } from "../../../commands/watch/types.js";
import { WatchStateSchema } from "../../../commands/watch/types.js";

// ── migrateProcessedIssues ────────────────────────────────────────────────────

describe("migrateProcessedIssues", () => {
	it("converts legacy numbers to timestamped objects", () => {
		const result = migrateProcessedIssues([1, 2, 3]);
		expect(result).toHaveLength(3);
		for (const entry of result) {
			expect(typeof entry).toBe("object");
			expect(entry).toHaveProperty("issueNumber");
			expect(entry).toHaveProperty("processedAt");
			expect(typeof (entry as ProcessedIssueEntry).processedAt).toBe("string");
		}
		expect((result[0] as ProcessedIssueEntry).issueNumber).toBe(1);
		expect((result[1] as ProcessedIssueEntry).issueNumber).toBe(2);
		expect((result[2] as ProcessedIssueEntry).issueNumber).toBe(3);
	});

	it("passes through existing object entries unchanged", () => {
		const existing: ProcessedIssueEntry = {
			issueNumber: 42,
			processedAt: "2026-01-01T00:00:00.000Z",
		};
		const result = migrateProcessedIssues([existing]);
		expect(result).toHaveLength(1);
		expect(result[0]).toBe(existing); // same reference
	});

	it("handles mixed number and object arrays", () => {
		const obj: ProcessedIssueEntry = { issueNumber: 10, processedAt: "2026-02-01T00:00:00.000Z" };
		const result = migrateProcessedIssues([5, obj, 7]);
		expect(result).toHaveLength(3);
		expect((result[0] as ProcessedIssueEntry).issueNumber).toBe(5);
		expect(result[1]).toBe(obj);
		expect((result[2] as ProcessedIssueEntry).issueNumber).toBe(7);
	});
});

// ── isProcessed ───────────────────────────────────────────────────────────────

describe("isProcessed", () => {
	it("works with legacy number entries", () => {
		expect(isProcessed([1, 2, 3], 2)).toBe(true);
		expect(isProcessed([1, 2, 3], 99)).toBe(false);
	});

	it("works with object entries", () => {
		const entries: ProcessedIssueEntry[] = [
			{ issueNumber: 10, processedAt: "2026-01-01T00:00:00.000Z" },
			{ issueNumber: 20, processedAt: "2026-01-02T00:00:00.000Z" },
		];
		expect(isProcessed(entries, 10)).toBe(true);
		expect(isProcessed(entries, 20)).toBe(true);
		expect(isProcessed(entries, 30)).toBe(false);
	});

	it("returns false for empty array", () => {
		expect(isProcessed([], 1)).toBe(false);
	});

	it("works with mixed number and object arrays", () => {
		const mixed = [5, { issueNumber: 10, processedAt: "2026-01-01T00:00:00.000Z" }];
		expect(isProcessed(mixed, 5)).toBe(true);
		expect(isProcessed(mixed, 10)).toBe(true);
		expect(isProcessed(mixed, 99)).toBe(false);
	});
});

// ── removeFromProcessed ───────────────────────────────────────────────────────

describe("removeFromProcessed", () => {
	it("removes legacy number entries", () => {
		const result = removeFromProcessed([1, 2, 3], 2);
		expect(result).toEqual([1, 3]);
	});

	it("removes object entries", () => {
		const entries: ProcessedIssueEntry[] = [
			{ issueNumber: 10, processedAt: "2026-01-01T00:00:00.000Z" },
			{ issueNumber: 20, processedAt: "2026-01-02T00:00:00.000Z" },
		];
		const result = removeFromProcessed(entries, 10);
		expect(result).toHaveLength(1);
		expect((result[0] as ProcessedIssueEntry).issueNumber).toBe(20);
	});

	it("works with mixed arrays", () => {
		const mixed = [5, { issueNumber: 10, processedAt: "2026-01-01T00:00:00.000Z" }, 15];
		const result = removeFromProcessed(mixed, 10);
		expect(result).toHaveLength(2);
		expect(result[0]).toBe(5);
		expect(result[1]).toBe(15);
	});

	it("returns original array when issue not found", () => {
		const arr = [1, 2, 3];
		const result = removeFromProcessed(arr, 99);
		expect(result).toEqual([1, 2, 3]);
	});
});

// ── cleanExpiredIssues ────────────────────────────────────────────────────────

describe("cleanExpiredIssues", () => {
	it("removes entries older than TTL", () => {
		const oldDate = new Date(Date.now() - 10 * 86400_000).toISOString(); // 10 days ago
		const recentDate = new Date(Date.now() - 1 * 86400_000).toISOString(); // 1 day ago
		const state = WatchStateSchema.parse({
			processedIssues: [
				{ issueNumber: 1, processedAt: oldDate },
				{ issueNumber: 2, processedAt: recentDate },
			],
		});

		cleanExpiredIssues(state, 7); // TTL = 7 days

		expect(state.processedIssues).toHaveLength(1);
		expect((state.processedIssues[0] as ProcessedIssueEntry).issueNumber).toBe(2);
	});

	it("keeps entries within TTL", () => {
		const recentDate = new Date(Date.now() - 2 * 86400_000).toISOString(); // 2 days ago
		const state = WatchStateSchema.parse({
			processedIssues: [
				{ issueNumber: 1, processedAt: recentDate },
				{ issueNumber: 2, processedAt: recentDate },
			],
		});

		cleanExpiredIssues(state, 7);

		expect(state.processedIssues).toHaveLength(2);
	});

	it("migrates legacy numbers before filtering", () => {
		const state = WatchStateSchema.parse({
			processedIssues: [1, 2, 3],
		});

		cleanExpiredIssues(state, 7);

		// Legacy numbers get processedAt=now, so all survive a 7-day TTL
		expect(state.processedIssues).toHaveLength(3);
		for (const entry of state.processedIssues) {
			expect(typeof entry).toBe("object");
		}
	});

	it("moves stale error activeIssues to processedIssues", () => {
		const staleDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25h ago
		const state = WatchStateSchema.parse({
			activeIssues: {
				"42": {
					status: "error",
					turnsUsed: 1,
					createdAt: staleDate,
					title: "Bug report",
					conversationHistory: [],
				},
			},
		});

		cleanExpiredIssues(state, 7);

		expect(state.activeIssues["42"]).toBeUndefined();
		expect(state.processedIssues).toHaveLength(1);
		expect((state.processedIssues[0] as ProcessedIssueEntry).issueNumber).toBe(42);
	});

	it("moves stale timeout activeIssues to processedIssues", () => {
		const staleDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
		const state = WatchStateSchema.parse({
			activeIssues: {
				"99": {
					status: "timeout",
					turnsUsed: 5,
					createdAt: staleDate,
					title: "Feature request",
					conversationHistory: [],
				},
			},
		});

		cleanExpiredIssues(state, 7);

		expect(state.activeIssues["99"]).toBeUndefined();
		expect(state.processedIssues).toHaveLength(1);
		expect((state.processedIssues[0] as ProcessedIssueEntry).issueNumber).toBe(99);
	});

	it("does not remove recent error activeIssues (< 24h)", () => {
		const recentDate = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(); // 1h ago
		const state = WatchStateSchema.parse({
			activeIssues: {
				"7": {
					status: "error",
					turnsUsed: 0,
					createdAt: recentDate,
					title: "Recent error",
					conversationHistory: [],
				},
			},
		});

		cleanExpiredIssues(state, 7);

		expect(state.activeIssues["7"]).toBeDefined();
		expect(state.processedIssues).toHaveLength(0);
	});
});

// ── backward compatibility ────────────────────────────────────────────────────

describe("WatchStateSchema backward compatibility", () => {
	it("parses legacy number[] processedIssues without error", () => {
		const result = WatchStateSchema.parse({ processedIssues: [1, 2, 3] });
		expect(result.processedIssues).toEqual([1, 2, 3]);
	});

	it("parses mixed number and object processedIssues", () => {
		const result = WatchStateSchema.parse({
			processedIssues: [1, { issueNumber: 2, processedAt: "2026-01-01T00:00:00.000Z" }],
		});
		expect(result.processedIssues).toHaveLength(2);
		expect(result.processedIssues[0]).toBe(1);
		expect((result.processedIssues[1] as ProcessedIssueEntry).issueNumber).toBe(2);
	});

	it("defaults to empty array when processedIssues is missing", () => {
		const result = WatchStateSchema.parse({});
		expect(result.processedIssues).toEqual([]);
	});
});
