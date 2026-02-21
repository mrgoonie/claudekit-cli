import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { platform, tmpdir } from "node:os";
import { join } from "node:path";
import { SettingsProcessor } from "@/domains/installation/merger/settings-processor.js";

const IS_WINDOWS = platform() === "win32";
const HOME_VAR = IS_WINDOWS ? "%USERPROFILE%" : "$HOME";
const PROJECT_VAR = IS_WINDOWS ? "%CLAUDE_PROJECT_DIR%" : "$CLAUDE_PROJECT_DIR";

describe("SettingsProcessor", () => {
	let testDir: string;
	let sourceDir: string;
	let destDir: string;

	beforeEach(async () => {
		testDir = join(tmpdir(), `settings-processor-test-${Date.now()}`);
		sourceDir = join(testDir, "source");
		destDir = join(testDir, "dest");
		await mkdir(sourceDir, { recursive: true });
		await mkdir(destDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	describe("global path normalization during merge", () => {
		it("should normalize $CLAUDE_PROJECT_DIR to $HOME in destination before merge", async () => {
			// Source settings with $HOME paths (what global install provides)
			const sourceSettings = {
				hooks: {
					SessionStart: [
						{ type: "command", command: 'node "$HOME"/.claude/hooks/session-start.cjs compact' },
					],
				},
			};
			const sourceFile = join(sourceDir, "settings.json");
			await writeFile(sourceFile, JSON.stringify(sourceSettings), "utf-8");

			// Destination settings with $CLAUDE_PROJECT_DIR paths (from previous local install)
			const destSettings = {
				hooks: {
					SessionStart: [
						{
							type: "command",
							command: 'node "$CLAUDE_PROJECT_DIR"/.claude/hooks/session-start.cjs compact',
						},
					],
				},
			};
			const destFile = join(destDir, "settings.json");
			await writeFile(destFile, JSON.stringify(destSettings), "utf-8");

			// Process as global install
			const processor = new SettingsProcessor();
			processor.setGlobalFlag(true);
			processor.setProjectDir(destDir);
			await processor.processSettingsJson(sourceFile, destFile);

			// Read result
			const result = JSON.parse(await readFile(destFile, "utf-8"));

			// Should have exactly 1 hook (deduplicated)
			expect(result.hooks.SessionStart).toHaveLength(1);

			// The hook should use platform-appropriate home variable
			const hookCommand = result.hooks.SessionStart[0].command;
			expect(hookCommand).toContain(HOME_VAR);
			expect(hookCommand).not.toContain(PROJECT_VAR);
		});

		it("should normalize %CLAUDE_PROJECT_DIR% to %USERPROFILE% in destination", async () => {
			// Source with Windows home path
			const sourceSettings = {
				hooks: {
					SessionStart: [
						{
							type: "command",
							command: 'node "%USERPROFILE%"\\.claude\\hooks\\init.js',
						},
					],
				},
			};
			const sourceFile = join(sourceDir, "settings.json");
			await writeFile(sourceFile, JSON.stringify(sourceSettings), "utf-8");

			// Destination with Windows project dir path
			const destSettings = {
				hooks: {
					SessionStart: [
						{
							type: "command",
							command: 'node "%CLAUDE_PROJECT_DIR%"\\.claude\\hooks\\init.js',
						},
					],
				},
			};
			const destFile = join(destDir, "settings.json");
			await writeFile(destFile, JSON.stringify(destSettings), "utf-8");

			const processor = new SettingsProcessor();
			processor.setGlobalFlag(true);
			processor.setProjectDir(destDir);
			await processor.processSettingsJson(sourceFile, destFile);

			const result = JSON.parse(await readFile(destFile, "utf-8"));

			// Should deduplicate to 1 hook
			expect(result.hooks.SessionStart).toHaveLength(1);
		});

		it("should add genuinely new hooks even with existing similar paths", async () => {
			const sourceSettings = {
				hooks: {
					SessionStart: [
						{ type: "command", command: 'node "$HOME"/.claude/hooks/existing.js' },
						{ type: "command", command: 'node "$HOME"/.claude/hooks/new.js' },
					],
				},
			};
			const sourceFile = join(sourceDir, "settings.json");
			await writeFile(sourceFile, JSON.stringify(sourceSettings), "utf-8");

			const destSettings = {
				hooks: {
					SessionStart: [
						{
							type: "command",
							command: 'node "$CLAUDE_PROJECT_DIR"/.claude/hooks/existing.js',
						},
					],
				},
			};
			const destFile = join(destDir, "settings.json");
			await writeFile(destFile, JSON.stringify(destSettings), "utf-8");

			const processor = new SettingsProcessor();
			processor.setGlobalFlag(true);
			processor.setProjectDir(destDir);
			await processor.processSettingsJson(sourceFile, destFile);

			const result = JSON.parse(await readFile(destFile, "utf-8"));

			// Should have 2 hooks: existing (deduplicated) + new
			expect(result.hooks.SessionStart).toHaveLength(2);
		});
	});

	describe("source path transformation", () => {
		it("should transform .claude/ to $HOME/.claude/ for global install", async () => {
			const sourceSettings = {
				hooks: {
					SessionStart: [{ type: "command", command: "node .claude/hooks/init.js" }],
				},
			};
			const sourceFile = join(sourceDir, "settings.json");
			await writeFile(sourceFile, JSON.stringify(sourceSettings), "utf-8");

			const destFile = join(destDir, "settings.json");

			const processor = new SettingsProcessor();
			processor.setGlobalFlag(true);
			processor.setProjectDir(destDir);
			await processor.processSettingsJson(sourceFile, destFile);

			const result = JSON.parse(await readFile(destFile, "utf-8"));
			const hookCommand = result.hooks.SessionStart[0].command;

			// Should have transformed to platform-appropriate home path
			expect(hookCommand).toContain(HOME_VAR);
			expect(hookCommand).not.toContain("./.claude");
		});

		it("should transform .claude/ to $CLAUDE_PROJECT_DIR/.claude/ for local install", async () => {
			const sourceSettings = {
				hooks: {
					SessionStart: [{ type: "command", command: "node .claude/hooks/init.js" }],
				},
			};
			const sourceFile = join(sourceDir, "settings.json");
			await writeFile(sourceFile, JSON.stringify(sourceSettings), "utf-8");

			const destFile = join(destDir, "settings.json");

			const processor = new SettingsProcessor();
			processor.setGlobalFlag(false);
			processor.setProjectDir(destDir);
			await processor.processSettingsJson(sourceFile, destFile);

			const result = JSON.parse(await readFile(destFile, "utf-8"));
			const hookCommand = result.hooks.SessionStart[0].command;

			// Should have transformed to platform-appropriate project dir path
			expect(hookCommand).toContain(PROJECT_VAR);
		});
	});

	describe("deprecated matcher migration", () => {
		it("should migrate wildcard matcher to narrowed matcher from source", async () => {
			// Source: new narrowed matcher
			const sourceSettings = {
				hooks: {
					PostToolUse: [
						{
							matcher: "Bash|Edit|Write|MultiEdit|NotebookEdit",
							hooks: [
								{
									type: "command",
									command: 'node "$HOME"/.claude/hooks/usage-context-awareness.cjs',
									timeout: 10,
								},
							],
						},
					],
				},
			};
			const sourceFile = join(sourceDir, "settings.json");
			await writeFile(sourceFile, JSON.stringify(sourceSettings), "utf-8");

			// Destination: old wildcard matcher (what existing users have)
			const destSettings = {
				hooks: {
					PostToolUse: [
						{
							matcher: "*",
							hooks: [
								{
									type: "command",
									command: 'node "$HOME"/.claude/hooks/usage-context-awareness.cjs',
								},
							],
						},
					],
				},
			};
			const destFile = join(destDir, "settings.json");
			await writeFile(destFile, JSON.stringify(destSettings), "utf-8");

			const processor = new SettingsProcessor();
			processor.setGlobalFlag(true);
			processor.setProjectDir(destDir);
			await processor.processSettingsJson(sourceFile, destFile);

			const result = JSON.parse(await readFile(destFile, "utf-8"));

			// Should have migrated matcher from "*" to narrowed
			expect(result.hooks.PostToolUse).toHaveLength(1);
			const entry = result.hooks.PostToolUse[0];
			expect(entry.matcher).toBe("Bash|Edit|Write|MultiEdit|NotebookEdit");
			// Should also sync timeout from source
			expect(entry.hooks[0].timeout).toBe(10);
		});

		it("should not migrate matcher when commands don't overlap", async () => {
			const sourceSettings = {
				hooks: {
					PostToolUse: [
						{
							matcher: "Edit|Write",
							hooks: [{ type: "command", command: 'node "$HOME"/.claude/hooks/new-hook.cjs' }],
						},
					],
				},
			};
			const sourceFile = join(sourceDir, "settings.json");
			await writeFile(sourceFile, JSON.stringify(sourceSettings), "utf-8");

			const destSettings = {
				hooks: {
					PostToolUse: [
						{
							matcher: "*",
							hooks: [
								{
									type: "command",
									command: 'node "$HOME"/.claude/hooks/different-hook.cjs',
								},
							],
						},
					],
				},
			};
			const destFile = join(destDir, "settings.json");
			await writeFile(destFile, JSON.stringify(destSettings), "utf-8");

			const processor = new SettingsProcessor();
			processor.setGlobalFlag(true);
			processor.setProjectDir(destDir);
			await processor.processSettingsJson(sourceFile, destFile);

			const result = JSON.parse(await readFile(destFile, "utf-8"));

			// Should keep "*" because commands are different
			const starEntry = result.hooks.PostToolUse.find(
				(e: { matcher?: string }) => e.matcher === "*",
			);
			expect(starEntry).toBeDefined();
		});

		it("should handle local install path variables during matcher migration", async () => {
			const sourceSettings = {
				hooks: {
					PostToolUse: [
						{
							matcher: "Bash|Edit|Write|MultiEdit|NotebookEdit",
							hooks: [
								{
									type: "command",
									command: "node .claude/hooks/usage-context-awareness.cjs",
									timeout: 10,
								},
							],
						},
					],
				},
			};
			const sourceFile = join(sourceDir, "settings.json");
			await writeFile(sourceFile, JSON.stringify(sourceSettings), "utf-8");

			// Dest has path var expanded version
			const destSettings = {
				hooks: {
					PostToolUse: [
						{
							matcher: "*",
							hooks: [
								{
									type: "command",
									command: `node "${HOME_VAR}"/.claude/hooks/usage-context-awareness.cjs`,
								},
							],
						},
					],
				},
			};
			const destFile = join(destDir, "settings.json");
			await writeFile(destFile, JSON.stringify(destSettings), "utf-8");

			const processor = new SettingsProcessor();
			processor.setGlobalFlag(true);
			processor.setProjectDir(destDir);
			await processor.processSettingsJson(sourceFile, destFile);

			const result = JSON.parse(await readFile(destFile, "utf-8"));

			// Should still migrate because normalizeCommand handles path vars
			expect(result.hooks.PostToolUse).toHaveLength(1);
			expect(result.hooks.PostToolUse[0].matcher).toBe("Bash|Edit|Write|MultiEdit|NotebookEdit");
		});
	});

	describe("fresh install (no destination)", () => {
		it("should write source content directly when no destination exists", async () => {
			const sourceSettings = {
				hooks: {
					SessionStart: [{ type: "command", command: 'node "$HOME"/.claude/hooks/init.js' }],
				},
			};
			const sourceFile = join(sourceDir, "settings.json");
			await writeFile(sourceFile, JSON.stringify(sourceSettings), "utf-8");

			const destFile = join(destDir, "settings.json");
			// Note: destFile doesn't exist

			const processor = new SettingsProcessor();
			processor.setGlobalFlag(true);
			processor.setProjectDir(destDir);
			await processor.processSettingsJson(sourceFile, destFile);

			const result = JSON.parse(await readFile(destFile, "utf-8"));
			expect(result.hooks.SessionStart).toHaveLength(1);
		});
	});
});
