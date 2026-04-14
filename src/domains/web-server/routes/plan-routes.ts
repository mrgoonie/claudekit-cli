/**
 * Plan API routes for the dashboard, reader, timeline, heatmap, and action layer.
 */
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { ProjectsRegistryManager } from "@/domains/claudekit-data/index.js";
import { scanClaudeProjects } from "@/domains/claudekit-data/index.js";
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
	resolveProjectPlansDir,
	scanPlanDir,
	validatePlanFile,
} from "@/domains/plan-parser/index.js";
import type {
	MultiProjectPlansResponse,
	PlanSummary,
	ProjectPlanListItem,
	ProjectPlansEntry,
} from "@/domains/plan-parser/plan-types.js";
import { CkConfigSchema, normalizeCkConfigInput } from "@/types";
import type { Express, Request, Response } from "express";
import matter from "gray-matter";
import pLimit from "p-limit";
import { z } from "zod";

const PaginationQuerySchema = z.object({
	limit: z.coerce.number().int().min(1).max(500).default(100),
	offset: z.coerce.number().int().min(0).default(0),
});

const ActionRequestSchema = z.object({
	action: z.enum(["complete", "start", "reset", "validate", "start-next"]),
	planDir: z.string().min(1),
	phaseId: z.string().min(1).optional(),
	projectId: z.string().min(1).optional(),
});

const GLOBAL_PLAN_ROOT_CACHE_TTL_MS = 5_000;
const PROJECT_SCAN_CONCURRENCY = 5;
const PROJECT_SCAN_TIMEOUT_MS = 10_000;
let cachedGlobalPlanRoot: { value: string; expiresAt: number } | null = null;
let cachedDiscoveredProjectKeys: { value: Set<string>; expiresAt: number } | null = null;

export function clearPlanRouteCaches(): void {
	cachedGlobalPlanRoot = null;
	cachedDiscoveredProjectKeys = null;
}

interface ProjectScanTarget {
	id: string;
	name: string;
	path: string;
}

function sanitizeError(err: unknown): string {
	if (err instanceof Error) {
		if (/^(ENOENT|EACCES|EPERM|EISDIR)/.test(err.message)) return "File operation failed";
		// Match both forward slashes (Unix) and backslashes (Windows) to prevent path leakage
		return err.message.split("\n")[0].replace(/[/\\][^\s]+/g, "[path]");
	}
	return "Internal server error";
}

function hasBasePrefix(targetPath: string, baseDir: string): boolean {
	const basePrefix = baseDir.endsWith(sep) ? baseDir : `${baseDir}${sep}`;
	return targetPath === baseDir || targetPath.startsWith(basePrefix);
}

function isWithinBase(targetPath: string, baseDir: string): boolean {
	const resolvedTarget = resolve(targetPath);
	const resolvedBase = resolve(baseDir);
	const logicalMatch = hasBasePrefix(resolvedTarget, resolvedBase);
	// Existing targets must satisfy the canonical realpath check so symlink escapes
	// are rejected, while still allowing macOS /var <-> /private/var aliases.
	if (existsSync(resolvedTarget)) {
		try {
			const realTarget = realpathSync(resolvedTarget);
			const realBase = existsSync(resolvedBase) ? realpathSync(resolvedBase) : resolvedBase;
			return hasBasePrefix(realTarget, realBase);
		} catch {
			return false;
		}
	}
	if (!logicalMatch && existsSync(resolvedBase)) {
		try {
			return hasBasePrefix(resolvedTarget, realpathSync(resolvedBase));
		} catch {
			return false;
		}
	}
	return logicalMatch;
}

function getGlobalPlanRoot(): string {
	const now = Date.now();
	if (cachedGlobalPlanRoot && cachedGlobalPlanRoot.expiresAt > now) {
		return cachedGlobalPlanRoot.value;
	}

	let value: string;
	try {
		const configPath = CkConfigManager.getGlobalConfigPath();
		if (!existsSync(configPath)) {
			value = resolveGlobalPlansDir();
		} else {
			const raw = JSON.parse(readFileSync(configPath, "utf8"));
			const parsed = CkConfigSchema.parse(normalizeCkConfigInput(raw));
			value = resolveGlobalPlansDir(parsed);
		}
	} catch {
		value = resolveGlobalPlansDir();
	}
	cachedGlobalPlanRoot = {
		value,
		expiresAt: now + GLOBAL_PLAN_ROOT_CACHE_TTL_MS,
	};
	return value;
}

async function getProjectPathForRequest(projectId?: string): Promise<string | null> {
	if (!projectId) return null;
	if (projectId === "current") return process.cwd();
	if (projectId === "global") return null;
	if (projectId.startsWith("discovered-")) {
		try {
			const decodedPath = Buffer.from(projectId.slice("discovered-".length), "base64url").toString(
				"utf-8",
			);
			if (!decodedPath) return null;
			const now = Date.now();
			const discoveredPaths =
				cachedDiscoveredProjectKeys && cachedDiscoveredProjectKeys.expiresAt > now
					? cachedDiscoveredProjectKeys.value
					: new Set(scanClaudeProjects().map((project) => toProjectPathKey(project.path)));
			if (!cachedDiscoveredProjectKeys || cachedDiscoveredProjectKeys.expiresAt <= now) {
				cachedDiscoveredProjectKeys = {
					value: discoveredPaths,
					expiresAt: now + GLOBAL_PLAN_ROOT_CACHE_TTL_MS,
				};
			}
			const projectPath = toProjectPathKey(decodedPath);
			return discoveredPaths.has(projectPath) ? projectPath : null;
		} catch {
			return null;
		}
	}
	const registered = await ProjectsRegistryManager.getProject(projectId);
	return registered?.path ?? null;
}

async function getAllowedRoots(projectId?: string): Promise<string[]> {
	const roots = [process.cwd(), getGlobalPlanRoot()];
	const projectPath = await getProjectPathForRequest(projectId);
	if (!projectPath) return roots;

	try {
		const { config } = await CkConfigManager.loadFull(projectPath);
		const projectPlansDir = projectId?.startsWith("discovered-")
			? resolveSafeDiscoveredProjectPlansDir(projectPath, config)
			: resolveProjectPlansDir(projectPath, config);
		roots.push(projectPlansDir);
		roots.push(getGlobalPlanRoot());
	} catch {
		// Ignore config loading errors — route guards will fall back to default roots.
	}

	return Array.from(new Set(roots.map((root) => resolve(root))));
}

async function isWithinAllowedRoots(targetPath: string, projectId?: string): Promise<boolean> {
	const allowedRoots = await getAllowedRoots(projectId);
	return allowedRoots.some((baseDir) => isWithinBase(targetPath, baseDir));
}

async function getSafePath(
	value: string,
	kind: "file" | "directory",
	res: Response,
	projectId?: string,
): Promise<string | null> {
	if (!value) {
		res.status(400).json({ error: `Missing ?${kind === "file" ? "file" : "dir"}= parameter` });
		return null;
	}
	if (!(await isWithinAllowedRoots(value, projectId))) {
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

function getPlanDirPath(value: string, res: Response, projectId?: string): Promise<string | null> {
	return getSafePath(value, "directory", res, projectId);
}

function getPlanFilePath(value: string, res: Response, projectId?: string): Promise<string | null> {
	return getSafePath(value, "file", res, projectId);
}

function toProjectPathKey(projectPath: string): string {
	const resolvedPath = resolve(projectPath);
	if (!existsSync(resolvedPath)) {
		return resolvedPath;
	}
	try {
		return realpathSync(resolvedPath);
	} catch {
		return resolvedPath;
	}
}

function createDiscoveredProjectId(projectPath: string): string {
	return `discovered-${Buffer.from(projectPath).toString("base64url")}`;
}

function toProjectPlanListItem(summary: PlanSummary, plansDir: string): ProjectPlanListItem {
	return {
		file: relative(plansDir, summary.planFile),
		name: basename(dirname(summary.planFile)),
		slug: basename(dirname(summary.planFile)),
		summary: {
			...summary,
			planDir: relative(plansDir, summary.planDir),
			planFile: relative(plansDir, summary.planFile),
		},
	};
}

async function buildProjectPlansEntry(target: ProjectScanTarget): Promise<ProjectPlansEntry> {
	const projectPath = toProjectPathKey(target.path);
	const { config } = await CkConfigManager.loadFull(projectPath);
	const plansDir = target.id.startsWith("discovered-")
		? resolveSafeDiscoveredProjectPlansDir(projectPath, config)
		: resolveProjectPlansDir(projectPath, config);
	const plans = buildPlanSummaries(scanPlanDir(plansDir)).map((summary) =>
		toProjectPlanListItem(summary, plansDir),
	);
	// Intentionally return an absolute plansDir. The UI passes this value back as the
	// `dir` query param for detail navigation, and downstream routes validate it via
	// getAllowedRoots instead of assuming a cwd-relative path.
	return {
		id: target.id,
		name: target.name,
		path: projectPath,
		plansDir,
		plans,
	};
}

function withTimeout<T>(
	promiseFactory: () => Promise<T>,
	timeoutMs: number,
	label: string,
): Promise<T> {
	return new Promise<T>((resolvePromise, rejectPromise) => {
		const timer = setTimeout(() => {
			rejectPromise(new Error(`${label} scan timed out`));
		}, timeoutMs);

		void promiseFactory().then(
			(value) => {
				clearTimeout(timer);
				resolvePromise(value);
			},
			(error) => {
				clearTimeout(timer);
				rejectPromise(error);
			},
		);
	});
}

function isCurrentProjectFallbackCandidate(currentPath: string, globalProjectKey: string): boolean {
	if (toProjectPathKey(currentPath) === globalProjectKey) return false;
	if (toProjectPathKey(currentPath) === toProjectPathKey(homedir())) return false;
	return (
		existsSync(join(currentPath, ".git")) ||
		existsSync(CkConfigManager.getProjectConfigPath(currentPath)) ||
		existsSync(join(currentPath, "plans"))
	);
}

function resolveSafeDiscoveredProjectPlansDir(
	projectPath: string,
	config: Parameters<typeof resolveProjectPlansDir>[1],
): string {
	const configuredPlansDir = resolveProjectPlansDir(projectPath, config);
	return isWithinBase(configuredPlansDir, projectPath)
		? configuredPlansDir
		: resolveProjectPlansDir(projectPath);
}

export function registerPlanRoutes(app: Express): void {
	app.get("/api/plan/parse", async (req: Request, res: Response) => {
		const projectId = String(req.query.projectId ?? "") || undefined;
		const file = await getPlanFilePath(String(req.query.file ?? ""), res, projectId);
		if (!file) return;
		try {
			const { frontmatter, phases } = parsePlanFile(file);
			res.json({ file: relative(process.cwd(), file), frontmatter, phases });
		} catch (err) {
			res.status(500).json({ error: sanitizeError(err) });
		}
	});

	app.get("/api/plan/validate", async (req: Request, res: Response) => {
		const projectId = String(req.query.projectId ?? "") || undefined;
		const file = await getPlanFilePath(String(req.query.file ?? ""), res, projectId);
		if (!file) return;
		try {
			const strict = String(req.query.strict ?? "") === "true";
			res.json(validatePlanFile(file, strict));
		} catch (err) {
			res.status(500).json({ error: sanitizeError(err) });
		}
	});

	app.get("/api/plan/list", async (req: Request, res: Response) => {
		const projectId = String(req.query.projectId ?? "") || undefined;
		const dir = await getPlanDirPath(String(req.query.dir ?? ""), res, projectId);
		if (!dir) return;
		try {
			const { limit, offset } = PaginationQuerySchema.parse(req.query);
			const entries = (
				await Promise.all(
					scanPlanDir(dir).map(async (planFile) =>
						(await isWithinAllowedRoots(planFile, projectId)) ? planFile : null,
					),
				)
			).filter((planFile): planFile is string => planFile !== null);
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

	app.get("/api/plan/list-all", async (_req: Request, res: Response) => {
		try {
			// Intentionally uncached. Plan status, registry membership, and cwd-scoped
			// fallback can change between requests, so global dashboard reads should
			// reflect current filesystem state instead of a short-lived aggregate cache.
			const globalProjectKey = toProjectPathKey(join(homedir(), ".claude"));
			const seenProjectKeys = new Set<string>();
			const scanTargets: ProjectScanTarget[] = [];

			for (const project of await ProjectsRegistryManager.listProjects()) {
				if (!existsSync(resolve(project.path))) continue;
				const projectKey = toProjectPathKey(project.path);
				if (projectKey === globalProjectKey || seenProjectKeys.has(projectKey)) continue;
				seenProjectKeys.add(projectKey);
				scanTargets.push({
					id: project.id,
					name: project.alias,
					path: project.path,
				});
			}

			for (const project of scanClaudeProjects()) {
				const projectKey = toProjectPathKey(project.path);
				if (projectKey === globalProjectKey || seenProjectKeys.has(projectKey)) continue;
				seenProjectKeys.add(projectKey);
				scanTargets.push({
					id: createDiscoveredProjectId(project.path),
					name: basename(project.path),
					path: project.path,
				});
			}

			const currentPath = resolve(process.cwd());
			const currentProjectKey = toProjectPathKey(currentPath);
			if (
				isCurrentProjectFallbackCandidate(currentPath, globalProjectKey) &&
				!seenProjectKeys.has(currentProjectKey)
			) {
				scanTargets.push({
					id: "current",
					name: basename(currentPath),
					path: currentPath,
				});
			}

			if (scanTargets.length === 0) {
				res.json({ projects: [], totalPlans: 0 } satisfies MultiProjectPlansResponse);
				return;
			}

			const limit = pLimit(PROJECT_SCAN_CONCURRENCY);
			const results = await Promise.allSettled(
				scanTargets.map((target) =>
					limit(() =>
						withTimeout(() => buildProjectPlansEntry(target), PROJECT_SCAN_TIMEOUT_MS, target.name),
					),
				),
			);

			const projects = results.flatMap((result, index) => {
				if (result.status === "fulfilled") {
					return [result.value];
				}
				return [
					{
						id: scanTargets[index]?.id ?? `unknown-${index}`,
						name: scanTargets[index]?.name ?? `Project ${index + 1}`,
						path: scanTargets[index]?.path ?? "",
						plansDir: resolveProjectPlansDir(scanTargets[index]?.path ?? process.cwd()),
						plans: [],
						error: sanitizeError(result.reason),
					} satisfies ProjectPlansEntry,
				];
			});

			const response = {
				projects,
				totalPlans: projects.reduce((total, project) => total + project.plans.length, 0),
			} satisfies MultiProjectPlansResponse;
			res.json(response);
		} catch (err) {
			res.status(500).json({ error: sanitizeError(err) });
		}
	});

	app.get("/api/plan/summary", async (req: Request, res: Response) => {
		const projectId = String(req.query.projectId ?? "") || undefined;
		const file = await getPlanFilePath(String(req.query.file ?? ""), res, projectId);
		if (!file) return;
		try {
			res.json(buildPlanSummary(file));
		} catch (err) {
			res.status(500).json({ error: sanitizeError(err) });
		}
	});

	app.get("/api/plan/timeline", async (req: Request, res: Response) => {
		const projectId = String(req.query.projectId ?? "") || undefined;
		const dir = await getPlanDirPath(String(req.query.dir ?? ""), res, projectId);
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
		const projectId = String(req.query.projectId ?? "") || undefined;
		const dir = await getPlanDirPath(String(req.query.dir ?? ""), res, projectId);
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

	app.get("/api/plan/file", async (req: Request, res: Response) => {
		const projectId = String(req.query.projectId ?? "") || undefined;
		const file = await getPlanFilePath(String(req.query.file ?? ""), res, projectId);
		if (!file) return;
		const dir = req.query.dir ? resolve(String(req.query.dir)) : null;
		if (dir && (!(await isWithinAllowedRoots(dir, projectId)) || !isWithinBase(file, dir))) {
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
		const planDir = await getPlanDirPath(parsed.data.planDir, res, parsed.data.projectId);
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
