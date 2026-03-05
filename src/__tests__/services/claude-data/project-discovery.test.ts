import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { clearHistoryCache } from "@/services/claude-data/history-parser.js";
import { mergeProjectDiscovery } from "@/services/claude-data/project-discovery.js";
import type { HistoryEntry } from "@/services/claude-data/types.js";

/**
 * Project Discovery Tests
 *
 * Tests for merging session + history project sources with deduplication.
 * Uses temp files in tmpdir with unique names for isolation.
 */

const TEST_DIR = join(tmpdir(), `ck-project-discovery-test-${Date.now()}-${process.pid}`);

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

describe("Project Discovery - Merge", () => {
	test("merges session + history projects correctly", async () => {
		const historyPath = join(TEST_DIR, `history-${randomUUID()}.jsonl`);
		const entries: HistoryEntry[] = [
			createEntry("/project/alpha", 1000),
			createEntry("/project/beta", 2000),
			createEntry("/project/gamma", 3000),
		];
		await createHistoryFile(historyPath, entries);

		const sessionProjects = [
			{ path: "/project/alpha", lastUsed: 500 }, // Overlaps with history
			{ path: "/project/delta" }, // Session-only
		];

		const result = await mergeProjectDiscovery(sessionProjects, false, historyPath);

		expect(result.projects).toHaveLength(4); // alpha, beta, gamma, delta
		expect(result.totalFromSessions).toBe(2);
		expect(result.totalFromHistory).toBe(3);
		expect(result.error).toBeUndefined();

		const alpha = result.projects.find((p) => p.path === "/project/alpha");
		const beta = result.projects.find((p) => p.path === "/project/beta");
		const gamma = result.projects.find((p) => p.path === "/project/gamma");
		const delta = result.projects.find((p) => p.path === "/project/delta");

		expect(alpha?.source).toBe("both");
		expect(beta?.source).toBe("history");
		expect(gamma?.source).toBe("history");
		expect(delta?.source).toBe("session");

		// Cleanup
		await rm(historyPath, { force: true });
	});

	test("deduplicates by path with source = 'both'", async () => {
		const historyPath = join(TEST_DIR, `history-${randomUUID()}.jsonl`);
		const entries: HistoryEntry[] = [createEntry("/project/shared", 2000)];
		await createHistoryFile(historyPath, entries);

		const sessionProjects = [{ path: "/project/shared", lastUsed: 1000 }];

		const result = await mergeProjectDiscovery(sessionProjects, false, historyPath);

		expect(result.projects).toHaveLength(1);
		const shared = result.projects[0];
		expect(shared.path).toBe("/project/shared");
		expect(shared.source).toBe("both");

		// Cleanup
		await rm(historyPath, { force: true });
	});

	test("prefers history lastUsed when more recent", async () => {
		const historyPath = join(TEST_DIR, `history-${randomUUID()}.jsonl`);
		const entries: HistoryEntry[] = [createEntry("/project/epsilon", 5000)];
		await createHistoryFile(historyPath, entries);

		const sessionProjects = [{ path: "/project/epsilon", lastUsed: 2000 }];

		const result = await mergeProjectDiscovery(sessionProjects, false, historyPath);

		expect(result.projects).toHaveLength(1);
		const epsilon = result.projects[0];
		expect(epsilon.lastUsed).toBe(5000); // History timestamp wins
		expect(epsilon.source).toBe("both");

		// Cleanup
		await rm(historyPath, { force: true });
	});

	test("filters non-existent paths when filterNonExistent=true", async () => {
		const historyPath = join(TEST_DIR, `history-${randomUUID()}.jsonl`);
		const entries: HistoryEntry[] = [
			createEntry("/definitely/does/not/exist/path1", 1000),
			createEntry("/another/fake/path2", 2000),
		];
		await createHistoryFile(historyPath, entries);

		const sessionProjects = [{ path: "/session/fake/path" }];

		const result = await mergeProjectDiscovery(sessionProjects, true, historyPath);

		// Session projects are assumed to exist (exists: true)
		// History projects should be filtered out since paths don't exist
		expect(result.projects).toHaveLength(1);
		expect(result.projects[0].path).toBe("/session/fake/path");
		expect(result.projects[0].source).toBe("session");

		// Cleanup
		await rm(historyPath, { force: true });
	});

	test("handles empty session projects", async () => {
		const historyPath = join(TEST_DIR, `history-${randomUUID()}.jsonl`);
		const entries: HistoryEntry[] = [
			createEntry("/project/theta", 1000),
			createEntry("/project/iota", 2000),
		];
		await createHistoryFile(historyPath, entries);

		const result = await mergeProjectDiscovery([], false, historyPath);

		expect(result.projects).toHaveLength(2);
		expect(result.totalFromSessions).toBe(0);
		expect(result.totalFromHistory).toBe(2);

		expect(result.projects[0].source).toBe("history");
		expect(result.projects[1].source).toBe("history");

		// Cleanup
		await rm(historyPath, { force: true });
	});

	test("handles empty history (missing file)", async () => {
		const missingPath = join(TEST_DIR, `nonexistent-${randomUUID()}.jsonl`);

		const sessionProjects = [
			{ path: "/project/kappa", lastUsed: 1000 },
			{ path: "/project/lambda", lastUsed: 2000 },
		];

		const result = await mergeProjectDiscovery(sessionProjects, false, missingPath);

		// Should fall back to session projects only
		expect(result.projects).toHaveLength(2);
		expect(result.totalFromSessions).toBe(2);
		expect(result.totalFromHistory).toBe(0);
		expect(result.error).toBeDefined();
		expect(result.error).toContain("Cannot read history.jsonl");

		const kappa = result.projects.find((p) => p.path === "/project/kappa");
		const lambda = result.projects.find((p) => p.path === "/project/lambda");

		expect(kappa?.source).toBe("session");
		expect(lambda?.source).toBe("session");
	});

	test("propagates errors from parseHistoryFile", async () => {
		// Set history path to a directory instead of file (will cause error)
		const dirPath = join(TEST_DIR, `error-test-${randomUUID()}`);
		await mkdir(dirPath, { recursive: true });

		const sessionProjects = [{ path: "/project/mu" }];

		const result = await mergeProjectDiscovery(sessionProjects, false, dirPath);

		// Should still return session projects despite error
		expect(result.projects).toHaveLength(1);
		expect(result.projects[0].path).toBe("/project/mu");
		expect(result.error).toBeDefined(); // Error propagated

		// Cleanup
		await rm(dirPath, { recursive: true, force: true });
	});

	test("sorts projects by lastUsed descending", async () => {
		const historyPath = join(TEST_DIR, `history-${randomUUID()}.jsonl`);
		const entries: HistoryEntry[] = [
			createEntry("/project/old", 1000),
			createEntry("/project/recent", 5000),
			createEntry("/project/middle", 3000),
		];
		await createHistoryFile(historyPath, entries);

		const result = await mergeProjectDiscovery([], false, historyPath);

		expect(result.projects).toHaveLength(3);
		expect(result.projects[0].path).toBe("/project/recent");
		expect(result.projects[0].lastUsed).toBe(5000);
		expect(result.projects[1].path).toBe("/project/middle");
		expect(result.projects[1].lastUsed).toBe(3000);
		expect(result.projects[2].path).toBe("/project/old");
		expect(result.projects[2].lastUsed).toBe(1000);

		// Cleanup
		await rm(historyPath, { force: true });
	});

	test("includes interactionCount from history", async () => {
		const historyPath = join(TEST_DIR, `history-${randomUUID()}.jsonl`);
		const entries: HistoryEntry[] = [
			createEntry("/project/nu", 1000),
			createEntry("/project/nu", 2000),
			createEntry("/project/nu", 3000),
			createEntry("/project/xi", 4000),
		];
		await createHistoryFile(historyPath, entries);

		const result = await mergeProjectDiscovery([], false, historyPath);

		const nu = result.projects.find((p) => p.path === "/project/nu");
		const xi = result.projects.find((p) => p.path === "/project/xi");

		expect(nu?.interactionCount).toBe(3);
		expect(xi?.interactionCount).toBe(1);

		// Cleanup
		await rm(historyPath, { force: true });
	});
});

// Cleanup test directory after all tests
afterAll(async () => {
	await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
});
