/**
 * Tests for persistent swarm state management
 * Tests state file read/write, validation, and cleanup operations
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { clearSwarmState, readSwarmState, writeSwarmState } from "@/domains/swarm/index.js";
import type { SwarmState } from "@/domains/swarm/swarm-mode-types.js";

describe("swarm-state-manager", () => {
	let testHome: string;

	beforeEach(() => {
		testHome = mkdtempSync(join(tmpdir(), "ck-swarm-test-"));
		process.env.CK_TEST_HOME = testHome;
	});

	afterEach(() => {
		process.env.CK_TEST_HOME = undefined;
		if (existsSync(testHome)) {
			rmSync(testHome, { recursive: true, force: true });
		}
	});

	describe("readSwarmState", () => {
		test("should return null when state file does not exist", () => {
			const state = readSwarmState();
			expect(state).toBeNull();
		});

		test("should read valid state file", () => {
			const testState: SwarmState = {
				enabled: true,
				cliJsPath: "/path/to/cli.js",
				cliJsHash: "abc123",
				backupPath: "/path/to/cli.js.ck-backup",
				ccVersion: "v1.0.0",
				patchedAt: "2025-01-01T00:00:00Z",
			};

			writeSwarmState(testState);
			const state = readSwarmState();

			expect(state).not.toBeNull();
			expect(state?.enabled).toBe(true);
			expect(state?.cliJsPath).toBe("/path/to/cli.js");
			expect(state?.cliJsHash).toBe("abc123");
		});

		test("should validate required fields in state file", () => {
			const statePath = join(testHome, ".claude", ".ck-swarm-state.json");
			mkdirSync(join(testHome, ".claude"), { recursive: true });

			// Write invalid state missing required field
			const fs = require("node:fs");
			fs.writeFileSync(
				statePath,
				JSON.stringify({
					enabled: true,
					cliJsPath: "/path/to/cli.js",
					// missing other required fields
				}),
				"utf8",
			);

			const state = readSwarmState();
			expect(state).toBeNull();
		});

		test("should return null when state file is malformed JSON", () => {
			const statePath = join(testHome, ".claude", ".ck-swarm-state.json");
			mkdirSync(join(testHome, ".claude"), { recursive: true });

			const fs = require("node:fs");
			fs.writeFileSync(statePath, "{ invalid json }", "utf8");

			const state = readSwarmState();
			expect(state).toBeNull();
		});
	});

	describe("writeSwarmState", () => {
		test("should create state file with correct content", () => {
			const testState: SwarmState = {
				enabled: true,
				cliJsPath: "/path/to/cli.js",
				cliJsHash: "abc123",
				backupPath: "/path/to/cli.js.ck-backup",
				ccVersion: "v1.0.0",
				patchedAt: "2025-01-01T00:00:00Z",
			};

			writeSwarmState(testState);

			const statePath = join(testHome, ".claude", ".ck-swarm-state.json");
			expect(existsSync(statePath)).toBe(true);
		});

		test("should write valid JSON that can be read back", () => {
			const testState: SwarmState = {
				enabled: false,
				cliJsPath: "/another/path/cli.js",
				cliJsHash: "def456",
				backupPath: "/another/path/cli.js.ck-backup",
				ccVersion: "v2.0.0",
				patchedAt: "2025-12-31T23:59:59Z",
			};

			writeSwarmState(testState);
			const readBack = readSwarmState();

			expect(readBack).toEqual(testState);
		});

		test("should be atomic with temp file", () => {
			const testState: SwarmState = {
				enabled: true,
				cliJsPath: "/path/to/cli.js",
				cliJsHash: "abc123",
				backupPath: "/path/to/cli.js.ck-backup",
				ccVersion: "v1.0.0",
				patchedAt: "2025-01-01T00:00:00Z",
			};

			writeSwarmState(testState);

			const statePath = join(testHome, ".claude", ".ck-swarm-state.json");
			const tempPath = `${statePath}.tmp`;

			// Temp file should be cleaned up
			expect(existsSync(tempPath)).toBe(false);
			expect(existsSync(statePath)).toBe(true);
		});

		test("should preserve JSON formatting with 2-space indent", () => {
			const testState: SwarmState = {
				enabled: true,
				cliJsPath: "/path/to/cli.js",
				cliJsHash: "abc123",
				backupPath: "/path/to/cli.js.ck-backup",
				ccVersion: "v1.0.0",
				patchedAt: "2025-01-01T00:00:00Z",
			};

			writeSwarmState(testState);

			const statePath = join(testHome, ".claude", ".ck-swarm-state.json");
			const fs = require("node:fs");
			const content = fs.readFileSync(statePath, "utf8");

			// Check that the JSON has proper formatting
			expect(content).toContain('  "enabled"');
		});

		test("should create .claude directory if missing", () => {
			const testState: SwarmState = {
				enabled: true,
				cliJsPath: "/path/to/cli.js",
				cliJsHash: "abc123",
				backupPath: "/path/to/cli.js.ck-backup",
				ccVersion: "v1.0.0",
				patchedAt: "2025-01-01T00:00:00Z",
			};

			writeSwarmState(testState);

			const claudeDir = join(testHome, ".claude");
			expect(existsSync(claudeDir)).toBe(true);
		});
	});

	describe("clearSwarmState", () => {
		test("should delete state file when it exists", () => {
			const testState: SwarmState = {
				enabled: true,
				cliJsPath: "/path/to/cli.js",
				cliJsHash: "abc123",
				backupPath: "/path/to/cli.js.ck-backup",
				ccVersion: "v1.0.0",
				patchedAt: "2025-01-01T00:00:00Z",
			};

			writeSwarmState(testState);
			const statePath = join(testHome, ".claude", ".ck-swarm-state.json");

			expect(existsSync(statePath)).toBe(true);
			clearSwarmState();
			expect(existsSync(statePath)).toBe(false);
		});

		test("should not throw when state file does not exist", () => {
			expect(() => {
				clearSwarmState();
			}).not.toThrow();
		});

		test("should verify state is deleted by reading back null", () => {
			const testState: SwarmState = {
				enabled: true,
				cliJsPath: "/path/to/cli.js",
				cliJsHash: "abc123",
				backupPath: "/path/to/cli.js.ck-backup",
				ccVersion: "v1.0.0",
				patchedAt: "2025-01-01T00:00:00Z",
			};

			writeSwarmState(testState);
			expect(readSwarmState()).not.toBeNull();

			clearSwarmState();
			expect(readSwarmState()).toBeNull();
		});
	});

	describe("Round-trip operations", () => {
		test("should write and read identical state", () => {
			const original: SwarmState = {
				enabled: true,
				cliJsPath: "/home/user/.config/Code/User/globalStorage/vendor/claude-cli/cli.js",
				cliJsHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
				backupPath: "/home/user/.config/Code/User/globalStorage/vendor/claude-cli/cli.js.ck-backup",
				ccVersion: "1.2.3",
				patchedAt: "2025-01-15T14:30:00.000Z",
			};

			writeSwarmState(original);
			const retrieved = readSwarmState();

			expect(retrieved).toEqual(original);
		});

		test("should handle multiple write cycles", () => {
			const state1: SwarmState = {
				enabled: true,
				cliJsPath: "/path1/cli.js",
				cliJsHash: "hash1",
				backupPath: "/path1/cli.js.ck-backup",
				ccVersion: "v1.0.0",
				patchedAt: "2025-01-01T00:00:00Z",
			};

			writeSwarmState(state1);
			expect(readSwarmState()).toEqual(state1);

			const state2: SwarmState = {
				enabled: false,
				cliJsPath: "/path2/cli.js",
				cliJsHash: "hash2",
				backupPath: "/path2/cli.js.ck-backup",
				ccVersion: "v2.0.0",
				patchedAt: "2025-02-01T00:00:00Z",
			};

			writeSwarmState(state2);
			expect(readSwarmState()).toEqual(state2);
		});
	});
});
