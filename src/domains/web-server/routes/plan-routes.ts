import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { buildPlanSummary, parsePlanFile, validatePlanFile } from "@/domains/plan-parser/index.js";
/**
 * Plan API Routes
 * Endpoints for plan parsing, validation, and listing.
 * Used by the KanbanPage dashboard UI.
 */
import type { Express, Request, Response } from "express";

/**
 * Validate that a resolved path stays within the CWD boundary.
 * Prevents path traversal attacks via ?file= or ?dir= params.
 */
function isWithinCwd(filePath: string): boolean {
	const resolved = resolve(filePath);
	const cwd = process.cwd();
	return resolved.startsWith(`${cwd}/`) || resolved === cwd;
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
			res.status(404).json({ error: `File not found: ${file}` });
			return;
		}
		try {
			const { frontmatter, phases } = parsePlanFile(file);
			res.json({ file, frontmatter, phases });
		} catch (err) {
			res.status(500).json({ error: String(err) });
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
			res.status(404).json({ error: `File not found: ${file}` });
			return;
		}
		try {
			const result = validatePlanFile(file, strict);
			res.json(result);
		} catch (err) {
			res.status(500).json({ error: String(err) });
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
			res.status(404).json({ error: `Directory not found: ${dir}` });
			return;
		}
		try {
			const entries = readdirSync(dir)
				.filter((entry) => {
					try {
						return statSync(join(dir, entry)).isDirectory();
					} catch {
						return false;
					}
				})
				.map((entry) => join(dir, entry, "plan.md"))
				.filter(existsSync);

			const plans = entries.map((pf) => ({
				file: pf,
				name: basename(dirname(pf)),
			}));
			res.json({ dir, plans });
		} catch (err) {
			res.status(500).json({ error: String(err) });
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
			res.status(404).json({ error: `File not found: ${file}` });
			return;
		}
		try {
			const summary = buildPlanSummary(file);
			res.json(summary);
		} catch (err) {
			res.status(500).json({ error: String(err) });
		}
	});
}
