import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ProjectsRegistryManager } from "@/domains/claudekit-data/index.js";
import { PathResolver } from "@/shared/path-resolver.js";
import type { HookDiagnosticsResult, HookDiagnosticsSummary, HookLogEntry } from "./types.js";

export interface HookDiagnosticsOptions {
	scope: "global" | "project";
	projectId?: string;
	limit?: number;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function createEmptySummary(): HookDiagnosticsSummary {
	return {
		total: 0,
		parseErrors: 0,
		lastEventAt: null,
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
	if (!Number.isFinite(limit) || !limit) return DEFAULT_LIMIT;
	return Math.min(Math.max(1, Math.trunc(limit)), MAX_LIMIT);
}

async function resolveProjectPath(projectId?: string): Promise<string | null> {
	if (!projectId) return null;
	if (projectId === "current") return process.cwd();
	if (projectId === "global") return PathResolver.getGlobalKitDir();
	if (projectId.startsWith("discovered-")) {
		try {
			return Buffer.from(projectId.slice("discovered-".length), "base64url").toString("utf-8");
		} catch {
			return null;
		}
	}

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
		const parsed = JSON.parse(line) as HookLogEntry;
		if (!parsed || typeof parsed !== "object" || typeof parsed.hook !== "string") {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

export async function readHookDiagnostics(
	options: HookDiagnosticsOptions,
): Promise<HookDiagnosticsResult> {
	const scope = options.scope;
	const basePath =
		scope === "global"
			? PathResolver.getGlobalKitDir()
			: await resolveProjectPath(options.projectId);

	if (!basePath) {
		throw new Error("Project not found");
	}

	const path = getHookLogPath(scope, basePath);
	const summary = createEmptySummary();
	if (!existsSync(path)) {
		return {
			scope,
			projectId: options.projectId ?? null,
			path,
			exists: false,
			entries: [],
			summary,
		};
	}

	const raw = await readFile(path, "utf-8");
	const lines = raw.split("\n").filter(Boolean);
	const parsedEntries: HookLogEntry[] = [];

	for (const line of lines) {
		const entry = parseEntry(line);
		if (!entry) {
			summary.parseErrors += 1;
			continue;
		}
		parsedEntries.push(entry);
	}

	parsedEntries.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
	const entries = parsedEntries.slice(0, clampLimit(options.limit));

	for (const entry of parsedEntries) {
		summary.total += 1;
		increment(summary.statusCounts, entry.status);
		increment(summary.hookCounts, entry.hook);
		increment(summary.toolCounts, entry.tool);
		if (
			!summary.lastEventAt ||
			new Date(entry.ts).getTime() > new Date(summary.lastEventAt).getTime()
		) {
			summary.lastEventAt = entry.ts;
		}
	}

	return {
		scope,
		projectId: options.projectId ?? null,
		path,
		exists: true,
		entries,
		summary,
	};
}
