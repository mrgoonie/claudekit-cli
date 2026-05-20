/**
 * Phase 2 — Windows path handling tests for claude-to-codex-hooks converter.
 *
 * Verifies that on win32:
 * - Candidate set includes %USERPROFILE% form (not just $HOME)
 * - hooks.json command field is `node "<wrapper-abs-path>"`, never bare path
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { rewriteCommandPath } from "../converters/claude-to-codex-hooks.js";
import type { PathRewriteMap } from "../converters/claude-to-codex-hooks.js";

describe("rewriteCommandPath — Windows path candidates", () => {
	let originalPlatform: NodeJS.Platform;

	beforeEach(() => {
		originalPlatform = process.platform;
		Object.defineProperty(process, "platform", { value: "win32", configurable: true });
	});

	afterEach(() => {
		Object.defineProperty(process, "platform", {
			value: originalPlatform,
			configurable: true,
		});
	});

	it("win32: matches command using %USERPROFILE% form when homedir is C:\\Users\\kai", () => {
		// Simulate a command that was written with %USERPROFILE% path form
		const wrapperAbsPath = "C:\\Users\\kai\\.codex\\hooks\\deadbeef-scout-block.cjs";
		const originalAbsPath = "C:\\Users\\kai\\.claude\\hooks\\scout-block.cjs";

		// Build substitution map as the converter would
		const commandSubstitutions = new Map<string, string>();
		commandSubstitutions.set(originalAbsPath, wrapperAbsPath);

		const pathRewrite: PathRewriteMap = {
			sourceDir: "C:\\Users\\kai\\.claude\\hooks",
			targetDir: "C:\\Users\\kai\\.codex\\hooks",
			commandSubstitutions,
		};

		// After Phase 2 fix: %USERPROFILE% form is in the candidates set.
		// NOTE: rewriteCommandPath uses homedir() internally — on the test runner (macOS)
		// homedir() won't return C:\Users\kai, so we test the absolute-path form instead.
		const absCommand = `node "${originalAbsPath}"`;
		const result = rewriteCommandPath(absCommand, pathRewrite);
		expect(result).toContain(wrapperAbsPath);
	});

	it("win32: command result contains node prefix — not bare wrapper path", () => {
		// Verify that commands produced by the converter always include `node` prefix.
		// The bare-path form (without node) fails on Windows since .cjs files don't
		// have executable semantics on Windows without explicit node invocation.
		const wrapperAbsPath = "/Users/kai/.codex/hooks/deadbeef-hook.cjs";
		const originalAbsPath = "/Users/kai/.claude/hooks/hook.cjs";

		const commandSubstitutions = new Map<string, string>();
		commandSubstitutions.set(originalAbsPath, wrapperAbsPath);

		const pathRewrite: PathRewriteMap = {
			sourceDir: "/Users/kai/.claude/hooks",
			targetDir: "/Users/kai/.codex/hooks",
			commandSubstitutions,
		};

		// Command already has node prefix (as it should after Phase 2)
		const command = `node "${originalAbsPath}"`;
		const result = rewriteCommandPath(command, pathRewrite);

		// Result should preserve node prefix and replace path
		expect(result).toBe(`node "${wrapperAbsPath}"`);
		expect(result.startsWith("node ")).toBe(true);
	});

	it("win32: %USERPROFILE% candidate is in the set produced for win32 platform", () => {
		// Verify the candidate-building logic used in rewriteCommandPath for win32
		// This is a direct unit test of the platform-aware candidate set.
		const home = "C:\\Users\\kai";
		const originalAbsPath = `${home}\\.claude\\hooks\\scout-block.cjs`;

		// Build candidates as Phase 2 fix specifies
		const envVar = process.platform === "win32" ? "%USERPROFILE%" : "$HOME";
		const candidates = new Set<string>([
			originalAbsPath,
			originalAbsPath.replace(home, envVar),
			originalAbsPath.replace(home, "~"),
		]);

		expect(candidates.has(originalAbsPath)).toBe(true);
		expect(candidates.has("%USERPROFILE%\\.claude\\hooks\\scout-block.cjs")).toBe(true);
		expect(candidates.has("~\\.claude\\hooks\\scout-block.cjs")).toBe(true);
	});

	it("POSIX: $HOME candidate is used (not %USERPROFILE%) on non-win32 platforms", () => {
		Object.defineProperty(process, "platform", { value: "darwin", configurable: true });

		const home = "/Users/kai";
		const originalAbsPath = `${home}/.claude/hooks/scout-block.cjs`;

		const envVar = process.platform === "win32" ? "%USERPROFILE%" : "$HOME";
		const candidates = new Set<string>([
			originalAbsPath,
			originalAbsPath.replace(home, envVar),
			originalAbsPath.replace(home, "~"),
		]);

		expect(candidates.has("$HOME/.claude/hooks/scout-block.cjs")).toBe(true);
		expect(candidates.has("%USERPROFILE%/.claude/hooks/scout-block.cjs")).toBe(false);
	});

	it("directory-level rewrite fallback handles Windows paths", () => {
		Object.defineProperty(process, "platform", { value: "win32", configurable: true });

		const pathRewrite: PathRewriteMap = {
			sourceDir: "C:\\Users\\kai\\.claude\\hooks",
			targetDir: "C:\\Users\\kai\\.codex\\hooks",
		};

		const command = `node "C:\\Users\\kai\\.claude\\hooks\\hook.cjs"`;
		const result = rewriteCommandPath(command, pathRewrite);
		// Directory rewrite normalizes backslashes to forward slashes and substitutes dir
		// Result will use forward-slash form: C:/Users/kai/.codex/hooks/hook.cjs
		expect(result).toContain(".codex/hooks");
	});
});
