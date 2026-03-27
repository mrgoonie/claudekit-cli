import { beforeEach, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdir, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { clearHistoryCache, parseHistoryFile } from "@/services/claude-data/history-parser.js";
import type { HistoryEntry } from "@/services/claude-data/types.js";

/**
 * History Parser Tests
 *
 * Tests for streaming JSONL parser with mtime-based caching.
 * Uses temp files in tmpdir with unique names for isolation.
 */

const TEST_DIR = join(tmpdir(), `ck-history-test-${Date.now()}-${process.pid}`);

// Helper to create test history file
async function createHistoryFile(path: string, entries: HistoryEntry[]): Promise<void> {
	await mkdir(TEST_DIR, { recursive: true });
	const lines = entries.map((entry) => JSON.stringify(entry)).join("\n");
	await writeFile(path, lines);
}

// Helper to create sample history entry
function createEntry(project: string, timestamp: number, display = "test"): HistoryEntry {
	return {
		display,
		timestamp,
		project,
	};
}

beforeEach(() => {
	clearHistoryCache();
});

describe("History Parser", () => {
	test("parses valid JSONL file with multiple entries", async () => {
		const filePath = join(TEST_DIR, `history-${randomUUID()}.jsonl`);
		const entries: HistoryEntry[] = [
			createEntry("/project/alpha", 1000, "First interaction"),
			createEntry("/project/beta", 2000, "Second interaction"),
			createEntry("/project/alpha", 3000, "Third interaction"),
		];
		await createHistoryFile(filePath, entries);

		const result = await parseHistoryFile(filePath);

		expect(result.projects).toHaveLength(2);
		expect(result.totalEntries).toBe(3);
		expect(result.errorCount).toBe(0);
		expect(result.error).toBeUndefined();
		expect(result.parseTimeMs).toBeGreaterThanOrEqual(0);

		// Verify projects extracted
		const alpha = result.projects.find((p) => p.path === "/project/alpha");
		const beta = result.projects.find((p) => p.path === "/project/beta");

		expect(alpha).toBeDefined();
		expect(beta).toBeDefined();
		expect(alpha?.interactionCount).toBe(2);
		expect(beta?.interactionCount).toBe(1);

		// Cleanup
		await rm(filePath, { force: true });
	});

	test("returns empty result for missing file with error message", async () => {
		const filePath = join(TEST_DIR, `nonexistent-${randomUUID()}.jsonl`);

		const result = await parseHistoryFile(filePath);

		expect(result.projects).toHaveLength(0);
		expect(result.totalEntries).toBe(0);
		expect(result.errorCount).toBe(0);
		expect(result.error).toBeDefined();
		expect(result.error).toContain("Cannot read history.jsonl");
		expect(result.parseTimeMs).toBeGreaterThanOrEqual(0);
	});

	test("uses mtime cache - second call returns cached result", async () => {
		const filePath = join(TEST_DIR, `history-${randomUUID()}.jsonl`);
		const entries: HistoryEntry[] = [
			createEntry("/project/gamma", 1000),
			createEntry("/project/delta", 2000),
		];
		await createHistoryFile(filePath, entries);

		// First parse
		const result1 = await parseHistoryFile(filePath);
		expect(result1.projects).toHaveLength(2);

		// Second parse (should hit cache)
		const result2 = await parseHistoryFile(filePath);
		expect(result2).toBe(result1); // Same object reference = cached

		// Cleanup
		await rm(filePath, { force: true });
	});

	test("invalidates cache when mtime changes", async () => {
		const filePath = join(TEST_DIR, `history-${randomUUID()}.jsonl`);
		const entries1: HistoryEntry[] = [createEntry("/project/epsilon", 1000)];
		await createHistoryFile(filePath, entries1);

		// First parse
		const result1 = await parseHistoryFile(filePath);
		expect(result1.projects).toHaveLength(1);

		// Wait a bit to ensure mtime changes
		await new Promise((resolve) => setTimeout(resolve, 10));

		// Modify file (change mtime)
		const entries2: HistoryEntry[] = [
			createEntry("/project/epsilon", 1000),
			createEntry("/project/zeta", 2000),
		];
		await createHistoryFile(filePath, entries2);

		// Touch file to update mtime
		const now = new Date();
		await utimes(filePath, now, now);

		// Second parse (should NOT hit cache)
		const result2 = await parseHistoryFile(filePath);
		expect(result2.projects).toHaveLength(2);
		expect(result2).not.toBe(result1); // Different object reference = cache miss

		// Cleanup
		await rm(filePath, { force: true });
	});

	test("handles malformed JSON lines gracefully", async () => {
		const filePath = join(TEST_DIR, `history-${randomUUID()}.jsonl`);

		// Mix of valid and invalid lines
		const content = [
			JSON.stringify(createEntry("/project/theta", 1000)),
			"{ invalid json }}}",
			JSON.stringify(createEntry("/project/iota", 2000)),
			"not json at all",
			JSON.stringify(createEntry("/project/kappa", 3000)),
		].join("\n");

		await mkdir(TEST_DIR, { recursive: true });
		await writeFile(filePath, content);

		const result = await parseHistoryFile(filePath);

		// Should have 3 valid projects
		expect(result.projects).toHaveLength(3);
		expect(result.totalEntries).toBe(5);
		expect(result.errorCount).toBe(2); // 2 malformed lines
		expect(result.error).toBeUndefined(); // No fatal error

		// Cleanup
		await rm(filePath, { force: true });
	});

	test("extracts unique projects with interaction counts", async () => {
		const filePath = join(TEST_DIR, `history-${randomUUID()}.jsonl`);
		const entries: HistoryEntry[] = [
			createEntry("/project/lambda", 1000),
			createEntry("/project/lambda", 2000),
			createEntry("/project/lambda", 3000),
			createEntry("/project/mu", 4000),
			createEntry("/project/mu", 5000),
		];
		await createHistoryFile(filePath, entries);

		const result = await parseHistoryFile(filePath);

		expect(result.projects).toHaveLength(2);

		const lambda = result.projects.find((p) => p.path === "/project/lambda");
		const mu = result.projects.find((p) => p.path === "/project/mu");

		expect(lambda?.interactionCount).toBe(3);
		expect(mu?.interactionCount).toBe(2);

		// Cleanup
		await rm(filePath, { force: true });
	});

	test("sorts projects by lastUsed descending", async () => {
		const filePath = join(TEST_DIR, `history-${randomUUID()}.jsonl`);
		const entries: HistoryEntry[] = [
			createEntry("/project/old", 1000),
			createEntry("/project/recent", 5000),
			createEntry("/project/middle", 3000),
		];
		await createHistoryFile(filePath, entries);

		const result = await parseHistoryFile(filePath);

		expect(result.projects).toHaveLength(3);
		expect(result.projects[0].path).toBe("/project/recent");
		expect(result.projects[0].lastUsed).toBe(5000);
		expect(result.projects[1].path).toBe("/project/middle");
		expect(result.projects[1].lastUsed).toBe(3000);
		expect(result.projects[2].path).toBe("/project/old");
		expect(result.projects[2].lastUsed).toBe(1000);

		// Cleanup
		await rm(filePath, { force: true });
	});

	test("updates lastUsed to most recent timestamp for duplicate projects", async () => {
		const filePath = join(TEST_DIR, `history-${randomUUID()}.jsonl`);
		const entries: HistoryEntry[] = [
			createEntry("/project/nu", 1000),
			createEntry("/project/nu", 2000),
			createEntry("/project/nu", 5000), // Most recent
			createEntry("/project/nu", 3000),
		];
		await createHistoryFile(filePath, entries);

		const result = await parseHistoryFile(filePath);

		expect(result.projects).toHaveLength(1);
		const nu = result.projects[0];
		expect(nu.path).toBe("/project/nu");
		expect(nu.lastUsed).toBe(5000); // Updated to most recent
		expect(nu.interactionCount).toBe(4);

		// Cleanup
		await rm(filePath, { force: true });
	});

	test("handles empty file", async () => {
		const filePath = join(TEST_DIR, `history-${randomUUID()}.jsonl`);
		await mkdir(TEST_DIR, { recursive: true });
		await writeFile(filePath, "");

		const result = await parseHistoryFile(filePath);

		expect(result.projects).toHaveLength(0);
		expect(result.totalEntries).toBe(0);
		expect(result.errorCount).toBe(0);
		expect(result.error).toBeUndefined();

		// Cleanup
		await rm(filePath, { force: true });
	});

	test("handles file with only blank lines", async () => {
		const filePath = join(TEST_DIR, `history-${randomUUID()}.jsonl`);
		await mkdir(TEST_DIR, { recursive: true });
		await writeFile(filePath, "\n\n\n");

		const result = await parseHistoryFile(filePath);

		expect(result.projects).toHaveLength(0);
		expect(result.totalEntries).toBe(0);
		expect(result.errorCount).toBe(0);
		expect(result.error).toBeUndefined();

		// Cleanup
		await rm(filePath, { force: true });
	});

	test("clearHistoryCache() actually clears cache", async () => {
		const filePath = join(TEST_DIR, `history-${randomUUID()}.jsonl`);
		const entries: HistoryEntry[] = [createEntry("/project/xi", 1000)];
		await createHistoryFile(filePath, entries);

		// First parse (populates cache)
		const result1 = await parseHistoryFile(filePath);
		expect(result1.projects).toHaveLength(1);

		// Second parse (should hit cache)
		const result2 = await parseHistoryFile(filePath);
		expect(result2).toBe(result1); // Same reference

		// Clear cache
		clearHistoryCache();

		// Third parse (should NOT hit cache)
		const result3 = await parseHistoryFile(filePath);
		expect(result3.projects).toHaveLength(1);
		expect(result3).not.toBe(result1); // Different reference

		// Cleanup
		await rm(filePath, { force: true });
	});

	test("handles entries without project field", async () => {
		const filePath = join(TEST_DIR, `history-${randomUUID()}.jsonl`);
		const content = [
			JSON.stringify({ display: "no project", timestamp: 1000 }),
			JSON.stringify(createEntry("/project/omicron", 2000)),
			JSON.stringify({ display: "also no project", timestamp: 3000 }),
		].join("\n");

		await mkdir(TEST_DIR, { recursive: true });
		await writeFile(filePath, content);

		const result = await parseHistoryFile(filePath);

		// Should only parse the one entry with project field
		expect(result.projects).toHaveLength(1);
		expect(result.projects[0].path).toBe("/project/omicron");
		expect(result.totalEntries).toBe(3);
		expect(result.errorCount).toBe(0);

		// Cleanup
		await rm(filePath, { force: true });
	});

	test("handles entries with empty project field", async () => {
		const filePath = join(TEST_DIR, `history-${randomUUID()}.jsonl`);
		const entries = [
			{ display: "empty project", timestamp: 1000, project: "" },
			createEntry("/project/pi", 2000),
		];
		const lines = entries.map((entry) => JSON.stringify(entry)).join("\n");

		await mkdir(TEST_DIR, { recursive: true });
		await writeFile(filePath, lines);

		const result = await parseHistoryFile(filePath);

		// Empty project field should be treated as falsy and skipped
		expect(result.projects).toHaveLength(1);
		expect(result.projects[0].path).toBe("/project/pi");

		// Cleanup
		await rm(filePath, { force: true });
	});
});

// Cleanup test directory after all tests
process.on("beforeExit", async () => {
	await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
});
