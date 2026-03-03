import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	loadWatchConfig,
	loadWatchState,
	saveWatchState,
} from "../../../commands/watch/phases/state-manager.js";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "ck-watch-test-"));
	// Create .claude directory (config file lives at projectDir/.claude/.ck.json)
	await mkdir(join(tempDir, ".claude"), { recursive: true });
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("loadWatchConfig", () => {
	test("returns defaults when .ck.json missing", async () => {
		const config = await loadWatchConfig(tempDir);
		expect(config.pollIntervalMs).toBe(30000);
		expect(config.maxTurnsPerIssue).toBe(10);
		expect(config.state.processedIssues).toEqual([]);
	});

	test("loads config from .ck.json", async () => {
		await writeFile(
			join(tempDir, ".claude", ".ck.json"),
			JSON.stringify({
				watch: {
					pollIntervalMs: 60000,
					excludeAuthors: ["bot1"],
				},
			}),
		);
		const config = await loadWatchConfig(tempDir);
		expect(config.pollIntervalMs).toBe(60000);
		expect(config.excludeAuthors).toEqual(["bot1"]);
	});

	test("handles corrupted .ck.json gracefully", async () => {
		await writeFile(join(tempDir, ".claude", ".ck.json"), "not valid json{{{");
		const config = await loadWatchConfig(tempDir);
		expect(config.pollIntervalMs).toBe(30000); // defaults
	});
});

describe("loadWatchState", () => {
	test("returns empty state when .ck.json missing", async () => {
		const state = await loadWatchState(tempDir);
		expect(state.activeIssues).toEqual({});
		expect(state.processedIssues).toEqual([]);
	});
});

describe("saveWatchState", () => {
	test("round-trips state through save/load", async () => {
		const state = {
			lastCheckedAt: "2026-03-03T10:00:00Z",
			activeIssues: {
				"42": {
					status: "clarifying" as const,
					turnsUsed: 2,
					createdAt: "2026-03-03T09:00:00Z",
					title: "Add dark mode",
					conversationHistory: ["AI: analysis"],
				},
			},
			processedIssues: [1, 2, 3],
			implementationQueue: [],
			currentlyImplementing: null,
		};

		await saveWatchState(tempDir, state);
		const loaded = await loadWatchState(tempDir);

		expect(loaded.lastCheckedAt).toBe("2026-03-03T10:00:00Z");
		expect(loaded.processedIssues).toEqual([1, 2, 3]);
		expect(loaded.activeIssues["42"]?.status).toBe("clarifying");
		expect(loaded.activeIssues["42"]?.conversationHistory).toEqual(["AI: analysis"]);
	});

	test("caps processedIssues at 500", async () => {
		const bigList = Array.from({ length: 600 }, (_, i) => i + 1);
		const state = {
			activeIssues: {},
			processedIssues: bigList,
			implementationQueue: [],
			currentlyImplementing: null,
		};

		await saveWatchState(tempDir, state);
		const loaded = await loadWatchState(tempDir);

		expect(loaded.processedIssues.length).toBe(500);
		// Should keep the last 500 (101-600)
		expect(loaded.processedIssues[0]).toBe(101);
		expect(loaded.processedIssues[499]).toBe(600);
	});

	test("preserves non-watch config keys", async () => {
		// Write .ck.json with other keys
		await writeFile(
			join(tempDir, ".claude", ".ck.json"),
			JSON.stringify({
				codingLevel: 3,
				plan: { namingFormat: "custom" },
			}),
		);

		await saveWatchState(tempDir, {
			activeIssues: {},
			processedIssues: [42],
			implementationQueue: [],
			currentlyImplementing: null,
		});

		// Verify other keys preserved
		const raw = JSON.parse(await readFile(join(tempDir, ".claude", ".ck.json"), "utf-8"));
		expect(raw.codingLevel).toBe(3);
		expect(raw.plan.namingFormat).toBe("custom");
		expect(raw.watch.state.processedIssues).toEqual([42]);
	});
});
