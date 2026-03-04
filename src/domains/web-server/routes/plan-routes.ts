/**
 * Plan API Routes
 * Endpoints for plan parsing, validation, and listing.
 * Used by the KanbanPage dashboard UI.
 */
import { existsSync, realpathSync } from "node:fs";
import { basename, dirname, resolve, sep } from "node:path";
import {
	buildPlanSummary,
	parsePlanFile,
	scanPlanDir,
	validatePlanFile,
} from "@/domains/plan-parser/index.js";
import type { Express, Request, Response } from "express";

/**
 * Validate that a resolved path stays within the CWD boundary.
 * Prevents path traversal attacks via ?file= or ?dir= params.
 * Uses realpathSync to follow symlinks — a symlink inside CWD pointing
 * outside (e.g. /etc/passwd) would otherwise pass a lexical-only check.
 */
function isWithinCwd(filePath: string): boolean {
	const cwd = process.cwd();
	const resolved = resolve(filePath);

	// Phase 1 (lexical): fast check using normalized paths and platform separator.
	// Appending sep prevents "/foo/bar" matching "/foo/barbaz".
	const cwdPrefix = cwd.endsWith(sep) ? cwd : `${cwd}${sep}`;
	if (!resolved.startsWith(cwdPrefix) && resolved !== cwd) return false;

	// Phase 2 (physical): follow symlinks to catch links that point outside CWD
	if (existsSync(resolved)) {
		try {
			const real = realpathSync(resolved);
			return real.startsWith(cwdPrefix) || real === cwd;
		} catch {
			return false;
		}
	}

	// TOCTOU trade-off: a symlink could be created between this check and the
	// route handler's existsSync. Acceptable for a local dev server — the route
	// will 404 for non-existent paths regardless.
	return true;
}

/**
 * Sanitize error messages before sending to client.
 * Prevents leaking internal paths and stack traces.
 */
function sanitizeError(err: unknown): string {
	if (err instanceof Error) {
		// Mask filesystem errors that leak internal paths (ENOENT, EACCES, etc.)
		if (/^(ENOENT|EACCES|EPERM|EISDIR)/.test(err.message)) {
			return "File operation failed";
		}
		// Strip absolute paths that libraries (gray-matter, etc.) may embed in errors
		return err.message.split("\n")[0].replace(/\/[^\s]+/g, "[path]");
	}
	return "Internal server error";
}

export function registerPlanRoutes(app: Express): void {
	/**
	 * GET /api/plan/parse?file=<path>
	 * Returns parsed phases JSON for a plan.md file
	 */
	app.get("/api/plan/parse", (req: Request, res: Response) => {
		const file = String(req.query.file ?? "");
		if (!file) {
			res.status(400).json({ error: "Missing ?file= parameter" });
			return;
		}
		if (!isWithinCwd(file)) {
			res.status(403).json({ error: "Path must be within current working directory" });
			return;
		}
		if (!existsSync(file)) {
			res.status(404).json({ error: "File not found" });
			return;
		}
		try {
			const { frontmatter, phases } = parsePlanFile(file);
			res.json({ file, frontmatter, phases });
		} catch (err) {
			res.status(500).json({ error: sanitizeError(err) });
		}
	});

	/**
	 * GET /api/plan/validate?file=<path>&strict=true
	 * Returns validation result for a plan.md file
	 */
	app.get("/api/plan/validate", (req: Request, res: Response) => {
		const file = String(req.query.file ?? "");
		const strict = String(req.query.strict ?? "") === "true";
		if (!file) {
			res.status(400).json({ error: "Missing ?file= parameter" });
			return;
		}
		if (!isWithinCwd(file)) {
			res.status(403).json({ error: "Path must be within current working directory" });
			return;
		}
		if (!existsSync(file)) {
			res.status(404).json({ error: "File not found" });
			return;
		}
		try {
			const result = validatePlanFile(file, strict);
			res.json(result);
		} catch (err) {
			res.status(500).json({ error: sanitizeError(err) });
		}
	});

	/**
	 * GET /api/plan/list?dir=<path>
	 * Scans for plan.md files in plans/ subdirectories (one level deep)
	 */
	app.get("/api/plan/list", (req: Request, res: Response) => {
		const dir = String(req.query.dir ?? "");
		if (!dir) {
			res.status(400).json({ error: "Missing ?dir= parameter" });
			return;
		}
		if (!isWithinCwd(dir)) {
			res.status(403).json({ error: "Path must be within current working directory" });
			return;
		}
		if (!existsSync(dir)) {
			res.status(404).json({ error: "Directory not found" });
			return;
		}
		try {
			const entries = scanPlanDir(dir).filter((pf) => isWithinCwd(pf));
			const plans = entries.map((pf) => ({
				file: pf,
				name: basename(dirname(pf)),
			}));
			res.json({ dir, plans });
		} catch (err) {
			res.status(500).json({ error: sanitizeError(err) });
		}
	});

	/**
	 * GET /api/plan/summary?file=<path>
	 * Returns PlanSummary with progress stats for a plan.md file
	 */
	app.get("/api/plan/summary", (req: Request, res: Response) => {
		const file = String(req.query.file ?? "");
		if (!file) {
			res.status(400).json({ error: "Missing ?file= parameter" });
			return;
		}
		if (!isWithinCwd(file)) {
			res.status(403).json({ error: "Path must be within current working directory" });
			return;
		}
		if (!existsSync(file)) {
			res.status(404).json({ error: "File not found" });
			return;
		}
		try {
			const summary = buildPlanSummary(file);
			res.json(summary);
		} catch (err) {
			res.status(500).json({ error: sanitizeError(err) });
		}
	});
}
