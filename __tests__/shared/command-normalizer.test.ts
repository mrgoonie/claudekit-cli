import { describe, expect, it } from "bun:test";
import { normalizeCommand } from "@/shared/command-normalizer.js";

describe("normalizeCommand", () => {
	describe("null/undefined handling", () => {
		it("should return empty string for null", () => {
			expect(normalizeCommand(null)).toBe("");
		});

		it("should return empty string for undefined", () => {
			expect(normalizeCommand(undefined)).toBe("");
		});

		it("should return empty string for empty string", () => {
			expect(normalizeCommand("")).toBe("");
		});
	});

	describe("$CLAUDE_PROJECT_DIR normalization", () => {
		it("should normalize unquoted $CLAUDE_PROJECT_DIR to $HOME", () => {
			expect(normalizeCommand("node $CLAUDE_PROJECT_DIR/.claude/hooks/init.js")).toBe(
				"node $HOME/.claude/hooks/init.js",
			);
		});

		it("should normalize quoted $CLAUDE_PROJECT_DIR to $HOME", () => {
			expect(normalizeCommand('node "$CLAUDE_PROJECT_DIR"/.claude/hooks/init.js')).toBe(
				"node $HOME/.claude/hooks/init.js",
			);
		});

		it("should normalize multiple occurrences", () => {
			expect(normalizeCommand("$CLAUDE_PROJECT_DIR/a && $CLAUDE_PROJECT_DIR/b")).toBe(
				"$HOME/a && $HOME/b",
			);
		});
	});

	describe("$HOME variant normalization", () => {
		it("should normalize quoted $HOME", () => {
			expect(normalizeCommand('node "$HOME"/.claude/hooks/init.js')).toBe(
				"node $HOME/.claude/hooks/init.js",
			);
		});

		it("should normalize ${HOME} to $HOME", () => {
			expect(normalizeCommand("node ${HOME}/.claude/hooks/init.js")).toBe(
				"node $HOME/.claude/hooks/init.js",
			);
		});

		it("should normalize quoted ${HOME}", () => {
			expect(normalizeCommand('node "${HOME}"/.claude/hooks/init.js')).toBe(
				"node $HOME/.claude/hooks/init.js",
			);
		});

		it("should preserve unquoted $HOME as-is", () => {
			expect(normalizeCommand("node $HOME/.claude/hooks/init.js")).toBe(
				"node $HOME/.claude/hooks/init.js",
			);
		});
	});

	describe("Windows path normalization", () => {
		it("should normalize %USERPROFILE% to $HOME", () => {
			expect(normalizeCommand("node %USERPROFILE%/.claude/hooks/init.js")).toBe(
				"node $HOME/.claude/hooks/init.js",
			);
		});

		it("should normalize quoted %USERPROFILE%", () => {
			expect(normalizeCommand('node "%USERPROFILE%"/.claude/hooks/init.js')).toBe(
				"node $HOME/.claude/hooks/init.js",
			);
		});

		it("should normalize %CLAUDE_PROJECT_DIR% to $HOME", () => {
			expect(normalizeCommand("node %CLAUDE_PROJECT_DIR%/.claude/hooks/init.js")).toBe(
				"node $HOME/.claude/hooks/init.js",
			);
		});

		it("should normalize quoted %CLAUDE_PROJECT_DIR%", () => {
			expect(normalizeCommand('node "%CLAUDE_PROJECT_DIR%"/.claude/hooks/init.js')).toBe(
				"node $HOME/.claude/hooks/init.js",
			);
		});
	});

	describe("path separator normalization", () => {
		it("should convert backslashes to forward slashes", () => {
			expect(normalizeCommand("node $HOME\\.claude\\hooks\\init.js")).toBe(
				"node $HOME/.claude/hooks/init.js",
			);
		});

		it("should handle mixed path separators", () => {
			expect(normalizeCommand("node $HOME/.claude\\hooks/init.js")).toBe(
				"node $HOME/.claude/hooks/init.js",
			);
		});
	});

	describe("whitespace normalization", () => {
		it("should normalize multiple spaces to single space", () => {
			expect(normalizeCommand("node   $HOME/.claude/hooks/init.js")).toBe(
				"node $HOME/.claude/hooks/init.js",
			);
		});

		it("should trim leading and trailing whitespace", () => {
			expect(normalizeCommand("  node $HOME/.claude/hooks/init.js  ")).toBe(
				"node $HOME/.claude/hooks/init.js",
			);
		});

		it("should normalize tabs to spaces", () => {
			expect(normalizeCommand("node\t$HOME/.claude/hooks/init.js")).toBe(
				"node $HOME/.claude/hooks/init.js",
			);
		});
	});

	describe("real-world hook command scenarios", () => {
		it("should normalize global install hook", () => {
			const globalHook = 'node "$HOME"/.claude/hooks/session-start.cjs compact';
			const normalized = normalizeCommand(globalHook);
			expect(normalized).toBe("node $HOME/.claude/hooks/session-start.cjs compact");
		});

		it("should normalize local install hook to match global", () => {
			const localHook = 'node "$CLAUDE_PROJECT_DIR"/.claude/hooks/session-start.cjs compact';
			const normalized = normalizeCommand(localHook);
			expect(normalized).toBe("node $HOME/.claude/hooks/session-start.cjs compact");
		});

		it("should make global and local hooks compare equal", () => {
			const globalHook = 'node "$HOME"/.claude/hooks/session-start.cjs compact';
			const localHook = 'node "$CLAUDE_PROJECT_DIR"/.claude/hooks/session-start.cjs compact';
			expect(normalizeCommand(globalHook)).toBe(normalizeCommand(localHook));
		});

		it("should make Windows and Unix hooks compare equal", () => {
			const unixHook = 'node "$HOME"/.claude/hooks/init.js';
			const windowsHook = 'node "%USERPROFILE%"\\.claude\\hooks\\init.js';
			expect(normalizeCommand(unixHook)).toBe(normalizeCommand(windowsHook));
		});
	});
});
