import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { InstalledSettingsTracker } from "@/domains/config/installed-settings-tracker.js";
import type { InstalledSettings } from "@/types";

describe("InstalledSettingsTracker", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = join(tmpdir(), `tracker-test-${Date.now()}`);
		await mkdir(join(testDir, ".claude"), { recursive: true });
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	describe("wasHookInstalled with normalization", () => {
		it("should detect hook installed with $CLAUDE_PROJECT_DIR when checking $HOME", () => {
			const tracker = new InstalledSettingsTracker(testDir, false);
			const installed: InstalledSettings = {
				hooks: ['node "$CLAUDE_PROJECT_DIR"/.claude/hooks/init.js'],
				mcpServers: [],
			};

			// Check with $HOME variant
			expect(tracker.wasHookInstalled('node "$HOME"/.claude/hooks/init.js', installed)).toBe(true);
		});

		it("should detect hook installed with $HOME when checking $CLAUDE_PROJECT_DIR", () => {
			const tracker = new InstalledSettingsTracker(testDir, false);
			const installed: InstalledSettings = {
				hooks: ['node "$HOME"/.claude/hooks/init.js'],
				mcpServers: [],
			};

			// Check with $CLAUDE_PROJECT_DIR variant
			expect(
				tracker.wasHookInstalled('node "$CLAUDE_PROJECT_DIR"/.claude/hooks/init.js', installed),
			).toBe(true);
		});

		it("should detect hook across Windows and Unix formats", () => {
			const tracker = new InstalledSettingsTracker(testDir, false);
			const installed: InstalledSettings = {
				hooks: ['node "%USERPROFILE%"\\.claude\\hooks\\init.js'],
				mcpServers: [],
			};

			// Check with Unix format
			expect(tracker.wasHookInstalled('node "$HOME"/.claude/hooks/init.js', installed)).toBe(true);
		});

		it("should return false for non-matching hook", () => {
			const tracker = new InstalledSettingsTracker(testDir, false);
			const installed: InstalledSettings = {
				hooks: ['node "$HOME"/.claude/hooks/init.js'],
				mcpServers: [],
			};

			expect(tracker.wasHookInstalled('node "$HOME"/.claude/hooks/other.js', installed)).toBe(
				false,
			);
		});

		it("should handle empty hooks array", () => {
			const tracker = new InstalledSettingsTracker(testDir, false);
			const installed: InstalledSettings = {
				hooks: [],
				mcpServers: [],
			};

			expect(tracker.wasHookInstalled('node "$HOME"/.claude/hooks/init.js', installed)).toBe(false);
		});

		it("should handle null command gracefully", () => {
			const tracker = new InstalledSettingsTracker(testDir, false);
			const installed: InstalledSettings = {
				hooks: ['node "$HOME"/.claude/hooks/init.js'],
				mcpServers: [],
			};

			expect(tracker.wasHookInstalled(null as unknown as string, installed)).toBe(false);
		});
	});

	describe("trackHook with normalization", () => {
		it("should store normalized command", () => {
			const tracker = new InstalledSettingsTracker(testDir, false);
			const settings: InstalledSettings = { hooks: [], mcpServers: [] };

			tracker.trackHook('node "$CLAUDE_PROJECT_DIR"/.claude/hooks/init.js', settings);

			// Should be stored as normalized $HOME version
			expect(settings.hooks).toContain("node $HOME/.claude/hooks/init.js");
		});

		it("should not add duplicate when path format differs", () => {
			const tracker = new InstalledSettingsTracker(testDir, false);
			const settings: InstalledSettings = {
				hooks: ["node $HOME/.claude/hooks/init.js"],
				mcpServers: [],
			};

			// Try to add with different format
			tracker.trackHook('node "$CLAUDE_PROJECT_DIR"/.claude/hooks/init.js', settings);

			// Should still have only one entry
			expect(settings.hooks).toHaveLength(1);
		});

		it("should add unique hooks", () => {
			const tracker = new InstalledSettingsTracker(testDir, false);
			const settings: InstalledSettings = {
				hooks: ["node $HOME/.claude/hooks/init.js"],
				mcpServers: [],
			};

			tracker.trackHook('node "$HOME"/.claude/hooks/other.js', settings);

			expect(settings.hooks).toHaveLength(2);
		});
	});

	describe("persistence", () => {
		it("should save and load installed settings", async () => {
			const tracker = new InstalledSettingsTracker(testDir, false);
			const settings: InstalledSettings = {
				hooks: ["node $HOME/.claude/hooks/init.js"],
				mcpServers: ["my-server"],
			};

			await tracker.saveInstalledSettings(settings);

			const newTracker = new InstalledSettingsTracker(testDir, false);
			const loaded = await newTracker.loadInstalledSettings();

			expect(loaded.hooks).toEqual(settings.hooks);
			expect(loaded.mcpServers).toEqual(settings.mcpServers);
		});

		it("should return empty settings when no file exists", async () => {
			const tracker = new InstalledSettingsTracker(testDir, false);
			const loaded = await tracker.loadInstalledSettings();

			expect(loaded.hooks).toEqual([]);
			expect(loaded.mcpServers).toEqual([]);
		});

		it("should handle global scope path correctly", async () => {
			// Global scope uses projectDir directly (e.g., ~/.claude)
			const tracker = new InstalledSettingsTracker(testDir, true);
			const settings: InstalledSettings = {
				hooks: ["test-hook"],
				mcpServers: [],
			};

			await tracker.saveInstalledSettings(settings);

			// Should save to testDir/.ck.json (not testDir/.claude/.ck.json)
			const newTracker = new InstalledSettingsTracker(testDir, true);
			const loaded = await newTracker.loadInstalledSettings();
			expect(loaded.hooks).toContain("test-hook");
		});
	});
});
