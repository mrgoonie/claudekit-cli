import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CheckResult } from "../types.js";

/**
 * Check active-plan file points to valid plan
 */
export function checkActivePlan(projectDir: string): CheckResult {
	const activePlanPath = join(projectDir, ".claude", "active-plan");

	if (!existsSync(activePlanPath)) {
		return {
			id: "ck-active-plan",
			name: "Active Plan",
			group: "claudekit",
			priority: "standard",
			status: "info",
			message: "None",
			autoFixable: false,
		};
	}

	try {
		const targetPath = readFileSync(activePlanPath, "utf-8").trim();
		const fullPath = join(projectDir, targetPath);

		if (!existsSync(fullPath)) {
			return {
				id: "ck-active-plan",
				name: "Active Plan",
				group: "claudekit",
				priority: "standard",
				status: "warn",
				message: "Orphaned (target missing)",
				details: targetPath,
				suggestion: "Run: rm .claude/active-plan",
				autoFixable: false,
			};
		}

		return {
			id: "ck-active-plan",
			name: "Active Plan",
			group: "claudekit",
			priority: "standard",
			status: "pass",
			message: targetPath,
			autoFixable: false,
		};
	} catch {
		return {
			id: "ck-active-plan",
			name: "Active Plan",
			group: "claudekit",
			priority: "standard",
			status: "warn",
			message: "Unreadable",
			details: activePlanPath,
			autoFixable: false,
		};
	}
}
