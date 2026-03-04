/**
 * Plan Scanner — discover plan.md files in a directory structure.
 * Shared by CLI commands and API routes.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Scan a directory for plan.md files in immediate subdirectories only.
 * Does not recurse deeper — each plan is expected at <dir>/<name>/plan.md.
 */
export function scanPlanDir(dir: string): string[] {
	if (!existsSync(dir)) return [];
	try {
		return readdirSync(dir)
			.filter((entry) => {
				const full = join(dir, entry);
				return statSync(full).isDirectory();
			})
			.map((entry) => join(dir, entry, "plan.md"))
			.filter(existsSync);
	} catch {
		return [];
	}
}
