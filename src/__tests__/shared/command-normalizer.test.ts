import { afterEach, describe, expect, it } from "bun:test";
import { normalizeCommand, repairClaudeNodeCommandPath } from "@/shared/command-normalizer.js";

describe("normalizeCommand", () => {
	const originalClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR;

	afterEach(() => {
		if (originalClaudeConfigDir !== undefined) {
			process.env.CLAUDE_CONFIG_DIR = originalClaudeConfigDir;
		} else {
			// biome-ignore lint/performance/noDelete: process.env requires delete to actually unset
			delete process.env.CLAUDE_CONFIG_DIR;
		}
	});

	it("treats custom global dir commands as equivalent to legacy $HOME global commands", () => {
		process.env.CLAUDE_CONFIG_DIR = "/custom/claude-config";

		const customCommand = 'node "/custom/claude-config/hooks/task-completed-handler.cjs"';
		const legacyCommand = 'node "$HOME/.claude/hooks/task-completed-handler.cjs"';

		expect(normalizeCommand(customCommand)).toBe(normalizeCommand(legacyCommand));
	});

	it("repairs raw relative project commands to the canonical CLAUDE_PROJECT_DIR form", () => {
		const result = repairClaudeNodeCommandPath(
			"node .claude/hooks/scout-block.cjs",
			"$CLAUDE_PROJECT_DIR",
		);

		expect(result.changed).toBe(true);
		expect(result.issue).toBe("raw-relative");
		expect(result.command).toBe('node "$CLAUDE_PROJECT_DIR"/.claude/hooks/scout-block.cjs');
	});

	it("ignores non-node commands even when they mention .claude", () => {
		const command = "bash .claude/hooks/scout-block.cjs";
		const result = repairClaudeNodeCommandPath(command, "$CLAUDE_PROJECT_DIR");

		expect(result.changed).toBe(false);
		expect(result.issue).toBeNull();
		expect(result.command).toBe(command);
	});

	it("repairs invalid embedded-quoted project commands to the canonical CLAUDE_PROJECT_DIR form", () => {
		const result = repairClaudeNodeCommandPath(
			'node "$CLAUDE_PROJECT_DIR/.claude/hooks/scout-block.cjs"',
			"$CLAUDE_PROJECT_DIR",
		);

		expect(result.changed).toBe(true);
		expect(result.issue).toBe("invalid-format");
		expect(result.command).toBe('node "$CLAUDE_PROJECT_DIR"/.claude/hooks/scout-block.cjs');
	});
});
