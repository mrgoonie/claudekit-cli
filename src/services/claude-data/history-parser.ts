/**
 * Streaming JSONL parser for ~/.claude/history.jsonl
 * mtime-based caching to avoid re-parsing unchanged files
 */

import { createReadStream, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import type {
	HistoryCacheEntry,
	HistoryEntry,
	HistoryParseResult,
	HistoryProject,
} from "./types.js";

const cache = new Map<string, HistoryCacheEntry>();
const locks = new Map<string, Promise<HistoryParseResult>>();

export function getHistoryPath(): string {
	return process.env.CLAUDE_HISTORY_PATH ?? join(homedir(), ".claude", "history.jsonl");
}

function emptyResult(parseTimeMs: number, error?: string): HistoryParseResult {
	return { projects: [], totalEntries: 0, errorCount: 0, parseTimeMs, error };
}

export async function parseHistoryFile(filePath?: string): Promise<HistoryParseResult> {
	const path = filePath ?? getHistoryPath();

	// Check if parsing is already in progress for this path
	const existingLock = locks.get(path);
	if (existingLock) return existingLock;

	// Check cache first (outside lock)
	const start = Date.now();
	let mtime: number;
	try {
		const stats = statSync(path);
		mtime = stats.mtimeMs;
		const cached = cache.get(path);
		if (cached && cached.mtime === mtime) {
			return cached.result;
		}
	} catch (err) {
		const msg = err instanceof Error ? err.message : "File not found";
		return emptyResult(Date.now() - start, `Cannot read history.jsonl: ${msg}`);
	}

	// Create parsing promise with lock
	const parsePromise = (async (): Promise<HistoryParseResult> => {
		try {
			// Stream parse
			const projectMap = new Map<string, HistoryProject>();
			let totalEntries = 0;
			let errorCount = 0;

			try {
				const fileStream = createReadStream(path);
				const rl = createInterface({ input: fileStream, crlfDelay: Number.POSITIVE_INFINITY });

				for await (const line of rl) {
					if (!line.trim()) continue;
					totalEntries++;

					try {
						const entry = JSON.parse(line) as HistoryEntry;
						if (!entry.project) continue;

						const existing = projectMap.get(entry.project);
						if (existing) {
							existing.interactionCount++;
							if (entry.timestamp > existing.lastUsed) {
								existing.lastUsed = entry.timestamp;
							}
						} else {
							projectMap.set(entry.project, {
								path: entry.project,
								lastUsed: entry.timestamp,
								interactionCount: 1,
							});
						}
					} catch {
						errorCount++;
					}
				}
			} catch (err) {
				const msg = err instanceof Error ? err.message : "Parse error";
				return emptyResult(Date.now() - start, `Failed to parse history.jsonl: ${msg}`);
			}

			const result: HistoryParseResult = {
				projects: Array.from(projectMap.values()).sort((a, b) => b.lastUsed - a.lastUsed),
				totalEntries,
				errorCount,
				parseTimeMs: Date.now() - start,
			};

			// Update cache
			cache.set(path, { mtime, result });

			return result;
		} finally {
			locks.delete(path);
		}
	})();

	locks.set(path, parsePromise);
	return parsePromise;
}

export function clearHistoryCache(): void {
	cache.clear();
	locks.clear();
}
