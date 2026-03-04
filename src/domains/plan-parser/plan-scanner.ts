/**
 * Plan Scanner — discover plan.md files in a directory structure.
 * Shared by CLI commands and API routes.
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Scan a directory for plan subdirectories containing plan.md files.
 * Only checks immediate subdirectories (depth 1): `<dir>/<subdir>/plan.md`.
 * Does not recurse into nested directories.
 */
export function scanPlanDir(dir: string): string[] {
	if (!existsSync(dir)) return [];
	try {
		return readdirSync(dir, { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => join(dir, entry.name, "plan.md"))
			.filter(existsSync);
	} catch {
		return [];
	}
}
