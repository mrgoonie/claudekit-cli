import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { HeatmapCell, HeatmapData } from "./plan-types.js";

const DAY_MS = 86_400_000;
const CELL_COUNT = 84;

interface ActivitySample {
	dateKey: string;
	files: Set<string>;
	commitCount: number;
	fileModCount: number;
}

function startOfDay(date: Date): Date {
	const copy = new Date(date);
	copy.setHours(0, 0, 0, 0);
	return copy;
}

const MAX_DEPTH = 10; // Prevent stack overflow from deeply nested directories

function enumerateMarkdownFiles(dir: string, depth = 0): string[] {
	if (depth >= MAX_DEPTH) return []; // Guard against deep recursion
	const entries = readdirSync(dir, { withFileTypes: true });
	return entries.flatMap((entry) => {
		const entryPath = join(dir, entry.name);
		if (entry.isDirectory()) return enumerateMarkdownFiles(entryPath, depth + 1);
		return entry.name.endsWith(".md") ? [entryPath] : [];
	});
}

function createRange(): Date[] {
	const today = startOfDay(new Date());
	const start = new Date(today.getTime() - DAY_MS * (CELL_COUNT - 1));
	return Array.from({ length: CELL_COUNT }, (_, index) =>
		startOfDay(new Date(start.getTime() + DAY_MS * index)),
	);
}

function getGitSamples(dir: string, samples: Map<string, ActivitySample>): void {
	const since = createRange()[0].toISOString();
	const result = spawnSync(
		"git",
		[
			"-C",
			process.cwd(),
			"log",
			`--since=${since}`,
			"--format=__CK__%aI",
			"--name-only",
			"--",
			dir,
		],
		{ encoding: "utf8" },
	);
	if (result.status !== 0 || !result.stdout.trim()) return;

	let activeDateKey = "";
	for (const line of result.stdout.split("\n")) {
		if (line.startsWith("__CK__")) {
			activeDateKey = startOfDay(new Date(line.slice(6))).toISOString();
			const sample = samples.get(activeDateKey);
			if (sample) sample.commitCount += 1;
			continue;
		}
		if (!line.trim() || !activeDateKey) continue;
		samples.get(activeDateKey)?.files.add(line.trim());
	}
}

function getMtimeSamples(dir: string, samples: Map<string, ActivitySample>): void {
	for (const file of enumerateMarkdownFiles(dir)) {
		const mtimeKey = startOfDay(statSync(file).mtime).toISOString();
		const sample = samples.get(mtimeKey);
		if (!sample) continue;
		sample.fileModCount += 1;
		// Cross-platform: use path.relative() instead of string replace with hardcoded separator
		sample.files.add(relative(process.cwd(), file));
	}
}

function computeLevel(value: number, max: number): 0 | 1 | 2 | 3 {
	if (value <= 0 || max <= 0) return 0;
	const ratio = value / max;
	if (ratio >= 0.75) return 3;
	if (ratio >= 0.35) return 2;
	return 1;
}

export async function buildHeatmapData(
	dir: string,
	source: "git" | "mtime" | "both" = "both",
): Promise<HeatmapData> {
	const range = createRange();
	const samples = new Map<string, ActivitySample>(
		range.map((date) => [
			date.toISOString(),
			{
				dateKey: date.toISOString(),
				files: new Set<string>(),
				commitCount: 0,
				fileModCount: 0,
			},
		]),
	);

	if (source === "git" || source === "both") getGitSamples(dir, samples);
	if (source === "mtime" || source === "both") getMtimeSamples(dir, samples);

	const cells = range.map((date, index) => {
		const sample = samples.get(date.toISOString());
		if (!sample) {
			throw new Error(`Missing activity sample for ${date.toISOString()}`);
		}
		const totalActivity =
			source === "git"
				? sample.commitCount
				: source === "mtime"
					? sample.fileModCount
					: sample.commitCount + sample.fileModCount;
		return {
			date: sample.dateKey,
			weekIndex: Math.floor(index / 7),
			dayIndex: index % 7,
			commitCount: sample.commitCount,
			fileModCount: sample.fileModCount,
			totalActivity,
			level: 0,
			files: [...sample.files].slice(0, 5),
		} satisfies HeatmapCell;
	});

	const maxActivity = cells.reduce((max, cell) => Math.max(max, cell.totalActivity), 0);
	return {
		rangeStart: range[0].toISOString(),
		rangeEnd: range[range.length - 1]?.toISOString() ?? range[0].toISOString(),
		source,
		maxActivity,
		cells: cells.map((cell) => ({ ...cell, level: computeLevel(cell.totalActivity, maxActivity) })),
	};
}
