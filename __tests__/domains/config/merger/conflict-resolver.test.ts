import { describe, expect, it } from "bun:test";
import { mergeHookEntries } from "@/domains/config/merger/conflict-resolver.js";
import type { HookEntry, MergeResult } from "@/domains/config/merger/types.js";

/**
 * Create a fresh MergeResult for each test
 */
function createMergeResult(): MergeResult {
	return {
		merged: {},
		hooksAdded: 0,
		hooksPreserved: 0,
		hooksSkipped: 0,
		mcpServersPreserved: 0,
		mcpServersSkipped: 0,
		conflictsDetected: [],
		newlyInstalledHooks: [],
		newlyInstalledServers: [],
		hooksByOrigin: new Map(),
	};
}

describe("conflict-resolver mergeHookEntries", () => {
	describe("path normalization for deduplication", () => {
		it("should detect duplicate when source uses $HOME and dest uses $CLAUDE_PROJECT_DIR", () => {
			const source: HookEntry[] = [
				{ type: "command", command: 'node "$HOME"/.claude/hooks/init.js' },
			];
			const dest: HookEntry[] = [
				{ type: "command", command: 'node "$CLAUDE_PROJECT_DIR"/.claude/hooks/init.js' },
			];
			const result = createMergeResult();

			const merged = mergeHookEntries(source, dest, "SessionStart", result, []);

			// Should not add duplicate
			expect(merged).toHaveLength(1);
			expect(result.hooksAdded).toBe(0);
			expect(result.conflictsDetected).toHaveLength(1);
		});

		it("should detect duplicate when source uses $CLAUDE_PROJECT_DIR and dest uses $HOME", () => {
			const source: HookEntry[] = [
				{ type: "command", command: 'node "$CLAUDE_PROJECT_DIR"/.claude/hooks/init.js' },
			];
			const dest: HookEntry[] = [
				{ type: "command", command: 'node "$HOME"/.claude/hooks/init.js' },
			];
			const result = createMergeResult();

			const merged = mergeHookEntries(source, dest, "SessionStart", result, []);

			expect(merged).toHaveLength(1);
			expect(result.hooksAdded).toBe(0);
		});

		it("should detect duplicate across Windows and Unix formats", () => {
			const source: HookEntry[] = [
				{ type: "command", command: 'node "$HOME"/.claude/hooks/init.js' },
			];
			const dest: HookEntry[] = [
				{ type: "command", command: 'node "%USERPROFILE%"\\.claude\\hooks\\init.js' },
			];
			const result = createMergeResult();

			const merged = mergeHookEntries(source, dest, "SessionStart", result, []);

			expect(merged).toHaveLength(1);
			expect(result.hooksAdded).toBe(0);
		});
	});

	describe("user deletion respect with normalization", () => {
		it("should skip hook user removed (normalized comparison)", () => {
			const source: HookEntry[] = [
				{ type: "command", command: 'node "$HOME"/.claude/hooks/init.js' },
			];
			const dest: HookEntry[] = [];
			// User removed this hook (was installed with different format)
			const installedHooks = ['node "$CLAUDE_PROJECT_DIR"/.claude/hooks/init.js'];
			const result = createMergeResult();

			const merged = mergeHookEntries(source, dest, "SessionStart", result, installedHooks);

			expect(merged).toHaveLength(0);
			expect(result.hooksSkipped).toBe(1);
		});

		it("should not skip hook that was never installed", () => {
			const source: HookEntry[] = [
				{ type: "command", command: 'node "$HOME"/.claude/hooks/new.js' },
			];
			const dest: HookEntry[] = [];
			const installedHooks = ['node "$HOME"/.claude/hooks/other.js'];
			const result = createMergeResult();

			const merged = mergeHookEntries(source, dest, "SessionStart", result, installedHooks);

			expect(merged).toHaveLength(1);
			expect(result.hooksAdded).toBe(1);
		});
	});

	describe("real-world global/local install scenario", () => {
		it("should handle the issue #265 scenario - global install after local", () => {
			// User did local install first, then global
			// Source: global install hooks (with $HOME)
			const source: HookEntry[] = [
				{ type: "command", command: 'node "$HOME"/.claude/hooks/session-start.cjs compact' },
				{ type: "command", command: 'node "$HOME"/.claude/hooks/prompt-submit.cjs' },
			];

			// Dest: existing settings with $CLAUDE_PROJECT_DIR (from local install)
			const dest: HookEntry[] = [
				{
					type: "command",
					command: 'node "$CLAUDE_PROJECT_DIR"/.claude/hooks/session-start.cjs compact',
				},
				{
					type: "command",
					command: 'node "$CLAUDE_PROJECT_DIR"/.claude/hooks/prompt-submit.cjs',
				},
			];

			const result = createMergeResult();
			const merged = mergeHookEntries(source, dest, "SessionStart", result, []);

			// Should not duplicate - recognize as same hooks
			expect(merged).toHaveLength(2);
			expect(result.hooksAdded).toBe(0);
			expect(result.conflictsDetected).toHaveLength(2);
		});

		it("should add genuinely new hooks even with existing normalized matches", () => {
			const source: HookEntry[] = [
				{ type: "command", command: 'node "$HOME"/.claude/hooks/existing.js' },
				{ type: "command", command: 'node "$HOME"/.claude/hooks/new.js' },
			];
			const dest: HookEntry[] = [
				{ type: "command", command: 'node "$CLAUDE_PROJECT_DIR"/.claude/hooks/existing.js' },
			];
			const result = createMergeResult();

			const merged = mergeHookEntries(source, dest, "SessionStart", result, []);

			expect(merged).toHaveLength(2);
			expect(result.hooksAdded).toBe(1);
		});
	});

	describe("existing duplicate cleanup (issue #270)", () => {
		it("should dedupe existing duplicate hooks in destination", () => {
			// User already has duplicates from before fix
			const source: HookEntry[] = [];
			const dest: HookEntry[] = [
				{ type: "command", command: 'node "$HOME"/.claude/hooks/init.js' },
				{ type: "command", command: 'node "$CLAUDE_PROJECT_DIR"/.claude/hooks/init.js' }, // duplicate
			];
			const result = createMergeResult();

			const merged = mergeHookEntries(source, dest, "SessionStart", result, []);

			// Should have cleaned up the duplicate
			expect(merged).toHaveLength(1);
			expect(result.hooksPreserved).toBe(1);
		});

		it("should dedupe multiple duplicates in destination", () => {
			const source: HookEntry[] = [];
			const dest: HookEntry[] = [
				{ type: "command", command: 'node "$HOME"/.claude/hooks/a.js' },
				{ type: "command", command: 'node "$CLAUDE_PROJECT_DIR"/.claude/hooks/a.js' }, // dup
				{ type: "command", command: 'node "$HOME"/.claude/hooks/b.js' },
				{ type: "command", command: 'node "%USERPROFILE%"/.claude/hooks/b.js' }, // dup
			];
			const result = createMergeResult();

			const merged = mergeHookEntries(source, dest, "SessionStart", result, []);

			expect(merged).toHaveLength(2);
		});

		it("should preserve first occurrence when deduping", () => {
			const source: HookEntry[] = [];
			const dest: HookEntry[] = [
				{ type: "command", command: 'node "$HOME"/.claude/hooks/init.js' },
				{ type: "command", command: 'node "$CLAUDE_PROJECT_DIR"/.claude/hooks/init.js' },
			];
			const result = createMergeResult();

			const merged = mergeHookEntries(source, dest, "SessionStart", result, []);

			// Should keep the first one ($HOME version)
			expect(merged).toHaveLength(1);
			expect((merged[0] as HookEntry).command).toContain("$HOME");
		});

		it("should still allow adding new hooks after deduping destination", () => {
			const source: HookEntry[] = [
				{ type: "command", command: 'node "$HOME"/.claude/hooks/new.js' },
			];
			const dest: HookEntry[] = [
				{ type: "command", command: 'node "$HOME"/.claude/hooks/init.js' },
				{ type: "command", command: 'node "$CLAUDE_PROJECT_DIR"/.claude/hooks/init.js' }, // dup
			];
			const result = createMergeResult();

			const merged = mergeHookEntries(source, dest, "SessionStart", result, []);

			// 1 deduped + 1 new
			expect(merged).toHaveLength(2);
			expect(result.hooksAdded).toBe(1);
		});
	});
});
