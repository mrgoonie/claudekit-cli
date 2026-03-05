/**
 * Unit tests for GitHub error action suggester
 * Tests all error categories return appropriate actionable suggestions
 */

import { describe, expect, test } from "bun:test";
import { formatActions, suggestActions } from "@/domains/error/action-suggester.js";
import type { ErrorCategory } from "@/domains/error/error-classifier.js";

describe("suggestActions", () => {
	describe("returns appropriate actions for each error category", () => {
		test("RATE_LIMIT returns wait and auth suggestions", () => {
			const actions = suggestActions("RATE_LIMIT");

			expect(actions.length).toBeGreaterThanOrEqual(2);
			expect(actions.some((a) => a.title.toLowerCase().includes("wait"))).toBe(true);
			expect(actions.some((a) => a.title.toLowerCase().includes("auth"))).toBe(true);
		});

		test("AUTH_MISSING returns re-authenticate suggestion", () => {
			const actions = suggestActions("AUTH_MISSING");

			expect(actions.length).toBeGreaterThanOrEqual(1);
			expect(actions.some((a) => a.commands.some((c) => c.includes("gh auth login")))).toBe(true);
		});

		test("AUTH_SCOPE returns re-authenticate with permissions suggestion", () => {
			const actions = suggestActions("AUTH_SCOPE");

			expect(actions.length).toBeGreaterThanOrEqual(1);
			expect(actions.some((a) => a.notes?.some((n) => n.includes("repo")))).toBe(true);
		});

		test("REPO_NOT_FOUND returns invitation check suggestion", () => {
			const actions = suggestActions("REPO_NOT_FOUND");

			expect(actions.length).toBeGreaterThanOrEqual(1);
			expect(actions.some((a) => a.notes?.some((n) => n.includes("invitation")))).toBe(true);
		});

		test("REPO_ACCESS returns invitation suggestion", () => {
			const actions = suggestActions("REPO_ACCESS");

			expect(actions.length).toBeGreaterThanOrEqual(1);
			expect(actions.some((a) => a.notes?.some((n) => n.includes("invitation")))).toBe(true);
		});

		test("NETWORK returns connection check suggestions", () => {
			const actions = suggestActions("NETWORK");

			expect(actions.length).toBeGreaterThanOrEqual(1);
			expect(actions.some((a) => a.commands.some((c) => c.includes("ping")))).toBe(true);
		});

		test("SSH_KEY returns SSH setup instructions", () => {
			const actions = suggestActions("SSH_KEY");

			expect(actions.length).toBeGreaterThanOrEqual(1);
			expect(actions.some((a) => a.commands.some((c) => c.includes("ssh-keygen")))).toBe(true);
		});

		test("UNKNOWN returns verbose flag suggestion", () => {
			const actions = suggestActions("UNKNOWN");

			expect(actions.length).toBeGreaterThanOrEqual(1);
			expect(actions.some((a) => a.commands.some((c) => c.includes("--verbose")))).toBe(true);
		});
	});

	describe("handles edge cases", () => {
		test("returns UNKNOWN actions for invalid category", () => {
			// Using 'as any' to test invalid input
			const actions = suggestActions("INVALID_CATEGORY" as ErrorCategory);

			// Should fallback to UNKNOWN actions
			expect(actions.length).toBeGreaterThanOrEqual(1);
		});

		test("all actions have required properties", () => {
			const categories: ErrorCategory[] = [
				"RATE_LIMIT",
				"AUTH_MISSING",
				"AUTH_SCOPE",
				"REPO_ACCESS",
				"REPO_NOT_FOUND",
				"NETWORK",
				"SSH_KEY",
				"UNKNOWN",
			];

			for (const category of categories) {
				const actions = suggestActions(category);
				for (const action of actions) {
					expect(action.title).toBeDefined();
					expect(typeof action.title).toBe("string");
					expect(action.commands).toBeDefined();
					expect(Array.isArray(action.commands)).toBe(true);
				}
			}
		});
	});
});

describe("formatActions", () => {
	test("formats single action correctly", () => {
		const actions = [
			{
				title: "Test Action",
				commands: ["test command"],
				notes: ["test note"],
			},
		];

		const formatted = formatActions(actions);

		expect(formatted).toContain("Test Action:");
		expect(formatted).toContain("test command");
		expect(formatted).toContain("test note");
	});

	test("formats multiple actions correctly", () => {
		const actions = [
			{
				title: "First Action",
				commands: ["first command"],
			},
			{
				title: "Second Action",
				commands: ["second command"],
			},
		];

		const formatted = formatActions(actions);

		expect(formatted).toContain("First Action:");
		expect(formatted).toContain("Second Action:");
		expect(formatted).toContain("first command");
		expect(formatted).toContain("second command");
	});

	test("handles action with no commands", () => {
		const actions = [
			{
				title: "No Commands",
				commands: [],
				notes: ["just a note"],
			},
		];

		const formatted = formatActions(actions);

		expect(formatted).toContain("No Commands:");
		expect(formatted).toContain("just a note");
	});

	test("handles action with no notes", () => {
		const actions = [
			{
				title: "Commands Only",
				commands: ["run this"],
			},
		];

		const formatted = formatActions(actions);

		expect(formatted).toContain("Commands Only:");
		expect(formatted).toContain("run this");
	});

	test("handles empty actions array", () => {
		const formatted = formatActions([]);

		expect(typeof formatted).toBe("string");
		expect(formatted).toBe("");
	});

	test("formats real RATE_LIMIT actions", () => {
		const actions = suggestActions("RATE_LIMIT");
		const formatted = formatActions(actions);

		expect(formatted).toContain("gh auth login");
		expect(formatted.length).toBeGreaterThan(0);
	});
});
