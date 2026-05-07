import { afterEach, describe, expect, it } from "bun:test";
import { homedir } from "node:os";
import { join } from "node:path";
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

describe("repairClaudeNodeCommandPath — absolute path branch", () => {
	const home = homedir().replace(/\\/g, "/").replace(/\/+$/, "");

	it("rewrites macOS absolute path under home to $HOME form", () => {
		const cmd = `node "${home}/.claude/hooks/foo.cjs"`;
		const result = repairClaudeNodeCommandPath(cmd, "$CLAUDE_PROJECT_DIR");

		expect(result.changed).toBe(true);
		expect(result.issue).toBe("invalid-format");
		expect(result.command).toBe('node "$HOME/.claude/hooks/foo.cjs"');
	});

	it("rewrites macOS absolute path outside home to $CLAUDE_PROJECT_DIR form", () => {
		const projectPath = join(home, "work/proj");
		const cmd = `node "${projectPath}/.claude/hooks/foo.cjs"`;
		const result = repairClaudeNodeCommandPath(cmd, "$CLAUDE_PROJECT_DIR");

		expect(result.changed).toBe(true);
		expect(result.issue).toBe("invalid-format");
		expect(result.command).toBe('node "$CLAUDE_PROJECT_DIR"/.claude/hooks/foo.cjs');
	});

	it("rewrites Linux absolute path outside home to $CLAUDE_PROJECT_DIR form", () => {
		const result = repairClaudeNodeCommandPath(
			'node "/opt/projects/myapp/.claude/hooks/session-state.cjs"',
			"$CLAUDE_PROJECT_DIR",
		);

		expect(result.changed).toBe(true);
		expect(result.issue).toBe("invalid-format");
		expect(result.command).toBe('node "$CLAUDE_PROJECT_DIR"/.claude/hooks/session-state.cjs');
	});

	it("rewrites Windows back-slash absolute path to $CLAUDE_PROJECT_DIR form", () => {
		const result = repairClaudeNodeCommandPath(
			'node "D:\\Admin\\Documents\\PROJECTS\\foo\\.claude\\hooks\\session-state.cjs"',
			"$CLAUDE_PROJECT_DIR",
		);

		expect(result.changed).toBe(true);
		expect(result.issue).toBe("invalid-format");
		expect(result.command).toBe('node "$CLAUDE_PROJECT_DIR"/.claude/hooks/session-state.cjs');
	});

	it("rewrites Windows forward-slash absolute path to $CLAUDE_PROJECT_DIR form", () => {
		const result = repairClaudeNodeCommandPath(
			'node "C:/Users/admin/projects/app/.claude/hooks/foo.cjs"',
			"$CLAUDE_PROJECT_DIR",
		);

		expect(result.changed).toBe(true);
		expect(result.issue).toBe("invalid-format");
		expect(result.command).toBe('node "$CLAUDE_PROJECT_DIR"/.claude/hooks/foo.cjs');
	});

	it("preserves trailing args (suffix) when rewriting absolute path", () => {
		const result = repairClaudeNodeCommandPath(
			'node "D:\\Admin\\Projects\\app\\.claude\\hooks\\foo.cjs" --flag',
			"$CLAUDE_PROJECT_DIR",
		);

		expect(result.changed).toBe(true);
		expect(result.command).toBe('node "$CLAUDE_PROJECT_DIR"/.claude/hooks/foo.cjs --flag');
	});

	it("is idempotent: canonical output run through repair again returns changed=false", () => {
		const first = repairClaudeNodeCommandPath(
			'node "/opt/proj/.claude/hooks/foo.cjs"',
			"$CLAUDE_PROJECT_DIR",
		);
		expect(first.changed).toBe(true);

		const second = repairClaudeNodeCommandPath(first.command, "$CLAUDE_PROJECT_DIR");
		expect(second.changed).toBe(false);
	});

	it("leaves unrelated absolute node paths untouched (no .claude/ segment)", () => {
		const cmd = "node /usr/bin/some-tool";
		const result = repairClaudeNodeCommandPath(cmd, "$CLAUDE_PROJECT_DIR");

		expect(result.changed).toBe(false);
		expect(result.issue).toBeNull();
		expect(result.command).toBe(cmd);
	});

	it("matches Windows home dir case-insensitively (lowercased corrupted path)", () => {
		const originalPlatform = process.platform;
		Object.defineProperty(process, "platform", { value: "win32" });
		try {
			// Use a known home prefix; lowercase the path the way some IDEs/JSON tools persist it.
			// homedir() on win32 returns mixed-case (C:\Users\Kai); the corrupted path is c:/users/kai/...
			// Without case-insensitive comparison this would route to project scope (wrong).
			const home = homedir().replace(/\\/g, "/").replace(/\/+$/, "");
			const lowercased = home.toLowerCase();
			const cmd = `node "${lowercased}/.claude/hooks/foo.cjs"`;
			const result = repairClaudeNodeCommandPath(cmd, "$CLAUDE_PROJECT_DIR");
			expect(result.changed).toBe(true);
			expect(result.command).toBe('node "$HOME/.claude/hooks/foo.cjs"');
		} finally {
			Object.defineProperty(process, "platform", { value: originalPlatform });
		}
	});

	it("routes absolute path under CLAUDE_CONFIG_DIR (with .claude suffix) to $HOME scope", () => {
		const original = process.env.CLAUDE_CONFIG_DIR;
		process.env.CLAUDE_CONFIG_DIR = "/opt/custom/.claude";
		try {
			const result = repairClaudeNodeCommandPath(
				'node "/opt/custom/.claude/hooks/foo.cjs"',
				"$CLAUDE_PROJECT_DIR",
			);
			expect(result.changed).toBe(true);
			expect(result.issue).toBe("invalid-format");
			expect(result.command).toBe('node "$HOME/.claude/hooks/foo.cjs"');
		} finally {
			if (original === undefined) {
				// biome-ignore lint/performance/noDelete: process.env requires delete to actually unset
				delete process.env.CLAUDE_CONFIG_DIR;
			} else {
				process.env.CLAUDE_CONFIG_DIR = original;
			}
		}
	});
});
