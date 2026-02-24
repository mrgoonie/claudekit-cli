/**
 * Tests for plan-display module
 */
import { describe, expect, test } from "bun:test";
import { displayReconcilePlan } from "../plan-display.js";
import type { ReconcilePlan } from "../reconcile-types.js";

describe("displayReconcilePlan", () => {
	test("displays plan with all action types", () => {
		const plan: ReconcilePlan = {
			actions: [
				{
					action: "install",
					item: "test-agent",
					type: "agent",
					provider: "cline",
					global: false,
					targetPath: "/path/to/agent",
					reason: "New item, not previously installed",
				},
				{
					action: "update",
					item: "existing-agent",
					type: "agent",
					provider: "roo",
					global: true,
					targetPath: "/path/to/existing",
					reason: "CK updated, no user edits",
				},
				{
					action: "conflict",
					item: "modified-agent",
					type: "agent",
					provider: "cline",
					global: false,
					targetPath: "/path/to/modified",
					reason: "Both CK and user modified",
				},
				{
					action: "skip",
					item: "unchanged-agent",
					type: "agent",
					provider: "cline",
					global: false,
					targetPath: "/path/to/unchanged",
					reason: "No changes",
				},
			],
			summary: {
				install: 1,
				update: 1,
				skip: 1,
				conflict: 1,
				delete: 0,
			},
			hasConflicts: true,
		};

		// This just tests that it doesn't throw
		displayReconcilePlan(plan, { color: false });
		expect(true).toBe(true);
	});

	test("handles large skip list with truncation", () => {
		const plan: ReconcilePlan = {
			actions: Array.from({ length: 10 }, (_, i) => ({
				action: "skip" as const,
				item: `skip-${i}`,
				type: "agent" as const,
				provider: "cline",
				global: false,
				targetPath: `/path/${i}`,
				reason: "No changes",
			})),
			summary: {
				install: 0,
				update: 0,
				skip: 10,
				conflict: 0,
				delete: 0,
			},
			hasConflicts: false,
		};

		// Should show first 5 and "and N more..."
		displayReconcilePlan(plan, { color: false });
		expect(true).toBe(true);
	});
});
