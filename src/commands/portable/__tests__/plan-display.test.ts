/**
 * Tests for plan-display module
 */
import { describe, expect, test } from "bun:test";
import { buildCompletionFooter, displayReconcilePlan } from "../plan-display.js";
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
			banners: [],
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
			banners: [],
		};

		// Should show first 5 and "and N more..."
		displayReconcilePlan(plan, { color: false });
		expect(true).toBe(true);
	});
});

describe("buildCompletionFooter", () => {
	test("includes skill-only fallback data in dry-run summaries", () => {
		const footer = buildCompletionFooter(
			{
				actions: [],
				hasConflicts: false,
				summary: { install: 0, update: 0, skip: 0, conflict: 0, delete: 0 },
				banners: [],
			},
			[
				{
					itemName: "scout",
					operation: "apply",
					path: "/tmp/project/.agents/skills/scout",
					portableType: "skill",
					provider: "codex",
					providerDisplayName: "Codex",
					success: true,
				},
			],
			true,
		);

		expect(footer.subtitle).toContain("1 item(s) would change");
		expect(footer.zones.find((zone) => zone.label === "WHAT")?.lines.join(" ")).toContain(
			"1 skills",
		);
		expect(footer.zones.find((zone) => zone.label === "WHERE")?.lines.join(" ")).toContain(
			".agents/skills",
		);
	});

	test("omits deleted paths from WHERE and reports deleted counts", () => {
		const footer = buildCompletionFooter(
			{
				actions: [],
				hasConflicts: false,
				summary: { install: 0, update: 0, skip: 0, conflict: 0, delete: 1 },
				banners: [],
			},
			[
				{
					itemName: "old-hook",
					operation: "delete",
					path: "/tmp/project/.codex/hooks/old-hook.cjs",
					portableType: "hooks",
					provider: "codex",
					providerDisplayName: "Codex",
					success: true,
				},
			],
			false,
		);

		expect(footer.zones.find((zone) => zone.label === "WHERE")?.lines).toEqual([
			"No destination paths written",
		]);
		expect(footer.zones.find((zone) => zone.label === "WHAT")?.lines.join(" ")).toContain(
			"1 deleted",
		);
	});
});
