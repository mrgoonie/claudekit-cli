/**
 * Tests for PathResolver.getOpenCodeDir()
 *
 * Verifies OpenCode directory path resolution for both local and global modes
 * across Windows and Unix platforms.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { homedir } from "node:os";
import { join } from "node:path";
import { PathResolver } from "@/shared/path-resolver.js";

describe("PathResolver.getOpenCodeDir", () => {
	const originalEnv = { ...process.env };

	beforeEach(() => {
		// Reset environment
		process.env = { ...originalEnv };
	});

	afterEach(() => {
		// Restore environment
		process.env = originalEnv;
	});

	describe("local mode", () => {
		it("returns .opencode relative to baseDir", () => {
			const result = PathResolver.getOpenCodeDir(false, "/project");
			expect(result).toBe(join("/project", ".opencode"));
		});

		it("returns .opencode relative to cwd when no baseDir", () => {
			const result = PathResolver.getOpenCodeDir(false);
			expect(result).toBe(join(process.cwd(), ".opencode"));
		});

		it("returns .opencode relative to custom baseDir", () => {
			const customDir = "/custom/project/path";
			const result = PathResolver.getOpenCodeDir(false, customDir);
			expect(result).toBe(join(customDir, ".opencode"));
		});
	});

	describe("global mode - test environment", () => {
		beforeEach(() => {
			process.env.CK_TEST_HOME = "/test/home";
		});

		it("returns test home config path for global mode", () => {
			const result = PathResolver.getOpenCodeDir(true);
			expect(result).toBe(join("/test/home", ".config", "opencode"));
		});

		it("returns test home local path for local mode", () => {
			const result = PathResolver.getOpenCodeDir(false);
			expect(result).toBe(join("/test/home", ".opencode"));
		});

		it("uses baseDir over testHome for local mode", () => {
			const result = PathResolver.getOpenCodeDir(false, "/custom/base");
			expect(result).toBe(join("/custom/base", ".opencode"));
		});
	});

	describe("global mode - production", () => {
		beforeEach(() => {
			// Ensure test mode is disabled
			process.env.CK_TEST_HOME = undefined;
		});

		it("returns ~/.config/opencode for global mode on all platforms (no XDG_CONFIG_HOME)", () => {
			process.env.XDG_CONFIG_HOME = undefined;

			const result = PathResolver.getOpenCodeDir(true);
			expect(result).toBe(join(homedir(), ".config", "opencode"));
		});

		it("respects XDG_CONFIG_HOME for global mode on all platforms", () => {
			const customXdgConfig = "/custom/config";
			process.env.XDG_CONFIG_HOME = customXdgConfig;

			const result = PathResolver.getOpenCodeDir(true);
			expect(result).toBe(join(customXdgConfig, "opencode"));
		});
	});

	describe("path consistency", () => {
		it("global path differs from getConfigDir (different directories)", () => {
			process.env.CK_TEST_HOME = undefined;

			const openCodeDir = PathResolver.getOpenCodeDir(true);
			const claudeConfigDir = PathResolver.getConfigDir(true);

			// OpenCode and Claude use different directories
			// OpenCode: ~/.config/opencode (all platforms)
			// Claude: %LOCALAPPDATA%/claude (Windows) or ~/.config/claude (Unix)
			expect(openCodeDir).not.toBe(claudeConfigDir);
			expect(openCodeDir).toContain("opencode");
			expect(claudeConfigDir).toContain("claude");
		});

		it("local paths are different from global paths", () => {
			process.env.CK_TEST_HOME = undefined;

			const localPath = PathResolver.getOpenCodeDir(false, "/project");
			const globalPath = PathResolver.getOpenCodeDir(true);

			expect(localPath).not.toBe(globalPath);
			expect(localPath).toContain(".opencode");
		});
	});
});
