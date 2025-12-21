import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import type { ClaudeKitSetup } from "@/types";
import type { CheckResult } from "../types.js";

/**
 * Check CLAUDE.md existence and health (global + project)
 */
export function checkClaudeMd(setup: ClaudeKitSetup, projectDir: string): CheckResult[] {
	const results: CheckResult[] = [];

	// Global CLAUDE.md
	if (setup.global.path) {
		const globalClaudeMd = join(setup.global.path, "CLAUDE.md");
		results.push(checkClaudeMdFile(globalClaudeMd, "Global CLAUDE.md", "ck-global-claude-md"));
	}

	// Project CLAUDE.md - check in .claude directory
	const projectClaudeMd = join(projectDir, ".claude", "CLAUDE.md");
	results.push(checkClaudeMdFile(projectClaudeMd, "Project CLAUDE.md", "ck-project-claude-md"));

	return results;
}

/**
 * Helper to check a single CLAUDE.md file
 */
export function checkClaudeMdFile(path: string, name: string, id: string): CheckResult {
	if (!existsSync(path)) {
		return {
			id,
			name,
			group: "claudekit",
			priority: "standard",
			status: "warn",
			message: "Missing",
			suggestion: "Create CLAUDE.md with project instructions",
			autoFixable: false,
		};
	}

	try {
		const stat = statSync(path);
		const sizeKB = (stat.size / 1024).toFixed(1);

		if (stat.size === 0) {
			return {
				id,
				name,
				group: "claudekit",
				priority: "standard",
				status: "warn",
				message: "Empty (0 bytes)",
				details: path,
				suggestion: "Add project instructions to CLAUDE.md",
				autoFixable: false,
			};
		}

		return {
			id,
			name,
			group: "claudekit",
			priority: "standard",
			status: "pass",
			message: `Found (${sizeKB}KB)`,
			details: path,
			autoFixable: false,
		};
	} catch {
		return {
			id,
			name,
			group: "claudekit",
			priority: "standard",
			status: "warn",
			message: "Unreadable",
			details: path,
			suggestion: "Check file permissions",
			autoFixable: false,
		};
	}
}
