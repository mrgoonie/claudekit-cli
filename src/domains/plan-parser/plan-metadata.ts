import { readFileSync, statSync } from "node:fs";
import matter from "gray-matter";
import type { PhaseStatus, PlanBoardStatus } from "./plan-types.js";

type FrontmatterRecord = Record<string, unknown>;

interface PlanMetadata {
	title?: string;
	description?: string;
	status?: PlanBoardStatus;
	priority?: "P1" | "P2" | "P3";
	effort?: string;
	branch?: string;
	tags: string[];
	blockedBy: string[];
	blocks: string[];
	created?: string;
	lastModified?: string;
}

interface PhaseMetadata {
	title?: string;
	status?: PhaseStatus;
	effort?: string;
	created?: string;
	completed?: string;
	lastModified?: string;
}

function readMatter(filePath: string): FrontmatterRecord {
	try {
		return matter(readFileSync(filePath, "utf8")).data;
	} catch {
		return {};
	}
}

function normalizePriority(value: unknown): "P1" | "P2" | "P3" | undefined {
	const normalized = String(value ?? "")
		.trim()
		.toUpperCase();
	if (normalized === "P1" || normalized === "HIGH" || normalized === "CRITICAL") return "P1";
	if (normalized === "P2" || normalized === "MEDIUM" || normalized === "NORMAL") return "P2";
	if (normalized === "P3" || normalized === "LOW") return "P3";
	return undefined;
}

function normalizeDateValue(value: unknown): string | undefined {
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return value.toISOString();
	}
	if (typeof value !== "string") return undefined;
	const normalized = value.trim();
	return normalized ? normalized : undefined;
}

function normalizeStringList(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.filter((item): item is string => typeof item === "string")
		.map((item) => item.trim())
		.filter(Boolean);
}

export function normalizePlanStatus(
	value: unknown,
	counts?: { total: number; completed: number; inProgress: number },
): PlanBoardStatus {
	const normalized = String(value ?? "")
		.trim()
		.toLowerCase();
	if (normalized.includes("cancel")) return "cancelled";
	if (normalized.includes("review")) return "in-review";
	if (normalized.includes("done") || normalized.includes("complete")) return "done";
	if (normalized.includes("progress") || normalized.includes("active")) return "in-progress";
	if (counts) {
		if (counts.total > 0 && counts.completed === counts.total) return "done";
		if (counts.inProgress > 0 || counts.completed > 0) return "in-progress";
	}
	return "pending";
}

export function normalizePhaseStatus(value: unknown): PhaseStatus | undefined {
	const normalized = String(value ?? "")
		.trim()
		.toLowerCase();
	if (!normalized) return undefined;
	if (normalized.includes("done") || normalized.includes("complete")) return "completed";
	if (normalized.includes("progress") || normalized.includes("active")) return "in-progress";
	return "pending";
}

export function parseEffortHours(value: unknown): number {
	const raw = String(value ?? "")
		.trim()
		.toLowerCase();
	if (!raw) return 0;
	const hours = raw.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)/);
	if (hours) return Number.parseFloat(hours[1]);
	const minutes = raw.match(/(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)/);
	if (minutes) return Number.parseFloat(minutes[1]) / 60;
	const days = raw.match(/(\d+(?:\.\d+)?)\s*(?:d|day|days)/);
	if (days) return Number.parseFloat(days[1]) * 8;
	return 0;
}

export function readPlanMetadata(
	planFile: string,
	counts?: { total: number; completed: number; inProgress: number },
): PlanMetadata {
	const frontmatter = readMatter(planFile);
	const stats = statSync(planFile);
	return {
		title: typeof frontmatter.title === "string" ? frontmatter.title : undefined,
		description: typeof frontmatter.description === "string" ? frontmatter.description : undefined,
		status: normalizePlanStatus(frontmatter.status, counts),
		priority: normalizePriority(frontmatter.priority),
		effort: typeof frontmatter.effort === "string" ? frontmatter.effort : undefined,
		branch:
			typeof frontmatter.branch === "string" ? frontmatter.branch.trim() || undefined : undefined,
		tags: normalizeStringList(frontmatter.tags),
		blockedBy: normalizeStringList(frontmatter.blockedBy),
		blocks: normalizeStringList(frontmatter.blocks),
		created: normalizeDateValue(frontmatter.created),
		lastModified: stats.mtime.toISOString(),
	};
}

export function readPhaseMetadata(phaseFile: string): PhaseMetadata {
	const frontmatter = readMatter(phaseFile);
	const stats = statSync(phaseFile);
	return {
		title: typeof frontmatter.title === "string" ? frontmatter.title : undefined,
		status: normalizePhaseStatus(frontmatter.status),
		effort: typeof frontmatter.effort === "string" ? frontmatter.effort : undefined,
		created: normalizeDateValue(frontmatter.created),
		completed: normalizeDateValue(frontmatter.completed),
		lastModified: stats.mtime.toISOString(),
	};
}
