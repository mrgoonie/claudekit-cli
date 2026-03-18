import { access } from "node:fs/promises";
import { open } from "node:fs/promises";
import { join } from "node:path";
import { ProjectsRegistryManager, scanClaudeProjects } from "@/domains/claudekit-data/index.js";
import { PathResolver } from "@/shared/path-resolver.js";
import {
	type HookDiagnosticsResult,
	type HookDiagnosticsSummary,
	type HookLogEntry,
	HookLogEntrySchema,
} from "./types.js";

export interface HookDiagnosticsOptions {
	scope: "global" | "project";
	projectId?: string;
	limit?: number;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MAX_INSPECTED_LINES = 2_000;
const MAX_READ_BYTES = 512 * 1024;

export class HookDiagnosticsError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
		this.name = "HookDiagnosticsError";
	}
}

function createEmptySummary(): HookDiagnosticsSummary {
	return {
		total: 0,
		parseErrors: 0,
		lastEventAt: null,
		inspectedLines: 0,
		truncated: false,
		statusCounts: {},
		hookCounts: {},
		toolCounts: {},
	};
}

function increment(map: Record<string, number>, key?: string): void {
	if (!key) return;
	map[key] = (map[key] ?? 0) + 1;
}

function clampLimit(limit?: number): number {
	// Treat zero/invalid values as the default window; this endpoint does not expose summary-only mode.
	if (!Number.isFinite(limit) || !limit) return DEFAULT_LIMIT;
	return Math.min(Math.max(1, Math.trunc(limit)), MAX_LIMIT);
}

function resolveDiscoveredProjectPath(projectId: string): string | null {
	try {
		const decoded = Buffer.from(projectId.slice("discovered-".length), "base64url").toString(
			"utf-8",
		);
		if (!decoded) return null;
		const discoveredPaths = new Set(scanClaudeProjects().map((project) => project.path));
		return discoveredPaths.has(decoded) ? decoded : null;
	} catch {
		return null;
	}
}

async function resolveProjectPath(projectId?: string): Promise<string | null> {
	if (!projectId) return null;
	if (projectId.startsWith("discovered-")) return resolveDiscoveredProjectPath(projectId);

	const registered = await ProjectsRegistryManager.getProject(projectId);
	return registered?.path ?? null;
}

function getHookLogPath(scope: "global" | "project", basePath: string): string {
	if (scope === "global") {
		return join(basePath, "hooks", ".logs", "hook-log.jsonl");
	}
	return join(basePath, ".claude", "hooks", ".logs", "hook-log.jsonl");
}

function parseEntry(line: string): HookLogEntry | null {
	try {
		const parsed = HookLogEntrySchema.safeParse(JSON.parse(line));
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

async function readLogTail(path: string): Promise<{ lines: string[]; truncated: boolean }> {
	const handle = await open(path, "r");
	try {
		const stats = await handle.stat();
		if (stats.size === 0) return { lines: [], truncated: false };

		const bytesToRead = Math.min(stats.size, MAX_READ_BYTES);
		const start = stats.size - bytesToRead;
		const buffer = Buffer.alloc(bytesToRead);
		await handle.read(buffer, 0, bytesToRead, start);

		let raw = buffer.toString("utf-8");
		let truncated = start > 0;
		if (truncated) {
			const firstNewline = raw.indexOf("\n");
			raw = firstNewline === -1 ? "" : raw.slice(firstNewline + 1);
		}

		let lines = raw.split("\n").filter(Boolean);
		if (lines.length > MAX_INSPECTED_LINES) {
			lines = lines.slice(-MAX_INSPECTED_LINES);
			truncated = true;
		}

		return { lines, truncated };
	} finally {
		await handle.close();
	}
}

export async function readHookDiagnostics(
	options: HookDiagnosticsOptions,
): Promise<HookDiagnosticsResult> {
	const scope =
		options.scope === "project" && options.projectId !== "global" ? "project" : "global";
	const projectId = scope === "project" ? (options.projectId ?? null) : null;
	const basePath =
		scope === "global"
			? PathResolver.getGlobalKitDir()
			: await resolveProjectPath(options.projectId);

	if (!basePath) {
		throw new HookDiagnosticsError("Project not found", 404);
	}

	const path = getHookLogPath(scope, basePath);
	const summary = createEmptySummary();
	try {
		await access(path);
	} catch {
		return {
			scope,
			projectId,
			path,
			exists: false,
			entries: [],
			summary,
		};
	}

	const { lines, truncated } = await readLogTail(path);
	// Counts raw lines inspected from the bounded tail, including malformed JSONL entries.
	summary.inspectedLines = lines.length;
	summary.truncated = truncated;
	const parsedEntries: Array<{ entry: HookLogEntry; time: number }> = [];

	for (const line of lines) {
		const entry = parseEntry(line);
		if (!entry) {
			summary.parseErrors += 1;
			continue;
		}
		parsedEntries.push({ entry, time: Date.parse(entry.ts) });
	}

	parsedEntries.sort((a, b) => b.time - a.time);
	const entries = parsedEntries.slice(0, clampLimit(options.limit)).map(({ entry }) => entry);
	let lastEventTime: number | null = null;

	for (const { entry, time } of parsedEntries) {
		summary.total += 1;
		increment(summary.statusCounts, entry.status);
		increment(summary.hookCounts, entry.hook);
		increment(summary.toolCounts, entry.tool);
		if (lastEventTime === null || time > lastEventTime) {
			summary.lastEventAt = entry.ts;
			lastEventTime = time;
		}
	}

	return {
		scope,
		projectId,
		path,
		exists: true,
		entries,
		summary,
	};
}
