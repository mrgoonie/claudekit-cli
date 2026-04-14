/**
 * Plan API routes for the dashboard, reader, timeline, heatmap, and action layer.
 */
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { CkConfigManager } from "@/domains/config/index.js";
import { executeAction } from "@/domains/plan-actions/action-executor.js";
import {
	readActionSignal,
	updateActionStatus,
	writeActionSignal,
} from "@/domains/plan-actions/action-signal.js";
import {
	buildHeatmapData,
	buildPlanSummaries,
	buildPlanSummary,
	buildTimelineData,
	parsePlanFile,
	resolveGlobalPlansDir,
	scanPlanDir,
	validatePlanFile,
} from "@/domains/plan-parser/index.js";
import { CkConfigSchema, normalizeCkConfigInput } from "@/types";
import type { Express, Request, Response } from "express";
import matter from "gray-matter";
import { z } from "zod";

const PaginationQuerySchema = z.object({
	limit: z.coerce.number().int().min(1).max(500).default(100),
	offset: z.coerce.number().int().min(0).default(0),
});

const ActionRequestSchema = z.object({
	action: z.enum(["complete", "start", "reset", "validate", "start-next"]),
	planDir: z.string().min(1),
	phaseId: z.string().min(1).optional(),
});

function sanitizeError(err: unknown): string {
	if (err instanceof Error) {
		if (/^(ENOENT|EACCES|EPERM|EISDIR)/.test(err.message)) return "File operation failed";
		// Match both forward slashes (Unix) and backslashes (Windows) to prevent path leakage
		return err.message.split("\n")[0].replace(/[/\\][^\s]+/g, "[path]");
	}
	return "Internal server error";
}

function isWithinBase(targetPath: string, baseDir: string): boolean {
	const resolvedTarget = resolve(targetPath);
	const resolvedBase = resolve(baseDir);
	const basePrefix = resolvedBase.endsWith(sep) ? resolvedBase : `${resolvedBase}${sep}`;
	// Check logical path first
	if (resolvedTarget !== resolvedBase && !resolvedTarget.startsWith(basePrefix)) return false;
	// Check real path to prevent symlink attacks
	if (existsSync(resolvedTarget)) {
		try {
			const realTarget = realpathSync(resolvedTarget);
			const realBase = existsSync(resolvedBase) ? realpathSync(resolvedBase) : resolvedBase;
			const realBasePrefix = realBase.endsWith(sep) ? realBase : `${realBase}${sep}`;
			return realTarget === realBase || realTarget.startsWith(realBasePrefix);
		} catch {
			return false;
		}
	}
	return true;
}

function getGlobalPlanRoot(): string {
	try {
		const configPath = CkConfigManager.getGlobalConfigPath();
		if (!existsSync(configPath)) {
			return resolveGlobalPlansDir();
		}
		const raw = JSON.parse(readFileSync(configPath, "utf8"));
		const parsed = CkConfigSchema.parse(normalizeCkConfigInput(raw));
		return resolveGlobalPlansDir(parsed);
	} catch {
		return resolveGlobalPlansDir();
	}
}

function isWithinAllowedRoots(targetPath: string): boolean {
	return [process.cwd(), getGlobalPlanRoot()].some((baseDir) => isWithinBase(targetPath, baseDir));
}

function getSafePath(value: string, kind: "file" | "directory", res: Response): string | null {
	if (!value) {
		res.status(400).json({ error: `Missing ?${kind === "file" ? "file" : "dir"}= parameter` });
		return null;
	}
	if (!isWithinAllowedRoots(value)) {
		res
			.status(403)
			.json({ error: "Path must stay within the project or configured global plans root" });
		return null;
	}
	if (!existsSync(value)) {
		res.status(404).json({
			error: kind === "file" ? "File not found" : "Directory not found",
		});
		return null;
	}
	// Return canonical path to prevent TOCTOU race with symlinks
	try {
		return realpathSync(resolve(value));
	} catch {
		res.status(403).json({ error: "Cannot resolve path" });
		return null;
	}
}

function getPlanDirPath(value: string, res: Response): string | null {
	return getSafePath(value, "directory", res);
}

function getPlanFilePath(value: string, res: Response): string | null {
	return getSafePath(value, "file", res);
}

export function registerPlanRoutes(app: Express): void {
	app.get("/api/plan/parse", (req: Request, res: Response) => {
		const file = getPlanFilePath(String(req.query.file ?? ""), res);
		if (!file) return;
		try {
			const { frontmatter, phases } = parsePlanFile(file);
			res.json({ file: relative(process.cwd(), file), frontmatter, phases });
		} catch (err) {
			res.status(500).json({ error: sanitizeError(err) });
		}
	});

	app.get("/api/plan/validate", (req: Request, res: Response) => {
		const file = getPlanFilePath(String(req.query.file ?? ""), res);
		if (!file) return;
		try {
			const strict = String(req.query.strict ?? "") === "true";
			res.json(validatePlanFile(file, strict));
		} catch (err) {
			res.status(500).json({ error: sanitizeError(err) });
		}
	});

	app.get("/api/plan/list", (req: Request, res: Response) => {
		const dir = getPlanDirPath(String(req.query.dir ?? ""), res);
		if (!dir) return;
		try {
			const { limit, offset } = PaginationQuerySchema.parse(req.query);
			const entries = scanPlanDir(dir).filter((planFile) => isWithinAllowedRoots(planFile));
			const summaries = buildPlanSummaries(entries.slice(offset, offset + limit));
			const plans = summaries.map((summary) => ({
				file: relative(process.cwd(), summary.planFile),
				name: basename(dirname(summary.planFile)),
				slug: basename(dirname(summary.planFile)),
				summary: {
					...summary,
					planDir: relative(process.cwd(), summary.planDir),
					planFile: relative(process.cwd(), summary.planFile),
				},
			}));
			res.json({
				dir: relative(process.cwd(), dir),
				total: entries.length,
				limit,
				offset,
				plans,
			});
		} catch (err) {
			res.status(500).json({ error: sanitizeError(err) });
		}
	});

	app.get("/api/plan/summary", (req: Request, res: Response) => {
		const file = getPlanFilePath(String(req.query.file ?? ""), res);
		if (!file) return;
		try {
			res.json(buildPlanSummary(file));
		} catch (err) {
			res.status(500).json({ error: sanitizeError(err) });
		}
	});

	app.get("/api/plan/timeline", (req: Request, res: Response) => {
		const dir = getPlanDirPath(String(req.query.dir ?? ""), res);
		if (!dir) return;
		try {
			const planFile = join(dir, "plan.md");
			res.json({
				plan: buildPlanSummary(planFile),
				timeline: buildTimelineData(dir),
			});
		} catch (err) {
			res.status(500).json({ error: sanitizeError(err) });
		}
	});

	app.get("/api/plan/heatmap", async (req: Request, res: Response) => {
		const dir = getPlanDirPath(String(req.query.dir ?? ""), res);
		if (!dir) return;
		try {
			const source = z.enum(["git", "mtime", "both"]).catch("both").parse(req.query.source);
			res.json(await buildHeatmapData(dir, source));
		} catch (err) {
			res.json({
				rangeStart: new Date(0).toISOString(),
				rangeEnd: new Date(0).toISOString(),
				source: "both",
				maxActivity: 0,
				cells: [],
				error: sanitizeError(err),
			});
		}
	});

	app.get("/api/plan/file", (req: Request, res: Response) => {
		const file = getPlanFilePath(String(req.query.file ?? ""), res);
		if (!file) return;
		const dir = req.query.dir ? resolve(String(req.query.dir)) : null;
		if (dir && (!isWithinAllowedRoots(dir) || !isWithinBase(file, dir))) {
			res.status(403).json({ error: "File must stay within the selected plan directory" });
			return;
		}
		try {
			const raw = readFileSync(file, "utf8");
			const parsed = matter(raw);
			res.json({
				file: relative(process.cwd(), file),
				frontmatter: parsed.data,
				content: parsed.content,
				raw,
			});
		} catch (err) {
			res.status(500).json({ error: sanitizeError(err) });
		}
	});

	app.post("/api/plan/action", async (req: Request, res: Response) => {
		const parsed = ActionRequestSchema.safeParse(req.body ?? {});
		if (!parsed.success) {
			res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" });
			return;
		}
		const planDir = getPlanDirPath(parsed.data.planDir, res);
		if (!planDir) return;
		let signalId = "";
		try {
			const signal = writeActionSignal({ ...parsed.data, planDir });
			signalId = signal.id;
			updateActionStatus(signal.id, "processing");
			const result = await executeAction(signal);
			const next = updateActionStatus(signal.id, "completed", result);
			res.status(200).json(next ?? { ...signal, status: "completed", result });
		} catch (err) {
			const next = signalId
				? updateActionStatus(signalId, "failed", undefined, sanitizeError(err))
				: null;
			res.status(500).json(next ?? { error: sanitizeError(err) });
		}
	});

	app.get("/api/plan/action/status", (req: Request, res: Response) => {
		const id = String(req.query.id ?? "");
		if (!id) {
			res.status(400).json({ error: "Missing ?id= parameter" });
			return;
		}
		const signal = readActionSignal(id);
		if (!signal) {
			res.status(404).json({ error: "Action not found" });
			return;
		}
		res.json(signal);
	});
}
