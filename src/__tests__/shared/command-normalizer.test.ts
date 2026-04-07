import { afterEach, describe, expect, it } from "bun:test";
import { normalizeCommand } from "@/shared/command-normalizer.js";

describe("normalizeCommand", () => {
	const originalClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR;

	afterEach(() => {
		process.env.CLAUDE_CONFIG_DIR = originalClaudeConfigDir;
	});

	it("treats custom global dir commands as equivalent to legacy $HOME global commands", () => {
		process.env.CLAUDE_CONFIG_DIR = "/custom/claude-config";

		const customCommand = 'node "/custom/claude-config/hooks/task-completed-handler.cjs"';
		const legacyCommand = 'node "$HOME/.claude/hooks/task-completed-handler.cjs"';

		expect(normalizeCommand(customCommand)).toBe(normalizeCommand(legacyCommand));
	});
});
