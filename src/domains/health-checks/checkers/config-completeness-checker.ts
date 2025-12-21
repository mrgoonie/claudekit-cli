import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { ClaudeKitSetup } from "@/types";
import type { CheckResult } from "../types.js";

/**
 * Check if project configuration is complete (not just CLAUDE.md)
 */
export async function checkProjectConfigCompleteness(
	setup: ClaudeKitSetup,
	projectDir: string,
): Promise<CheckResult> {
	// Only check if we're in a project directory
	if (setup.project.path === setup.global.path) {
		return {
			id: "ck-project-config-complete",
			name: "Project Config Completeness",
			group: "claudekit",
			priority: "standard",
			status: "info",
			message: "Not in a project directory",
			autoFixable: false,
		};
	}

	const projectClaudeDir = join(projectDir, ".claude");
	const requiredDirs = ["agents", "commands", "workflows", "skills"];
	const missingDirs: string[] = [];

	// Check if required directories exist
	for (const dir of requiredDirs) {
		const dirPath = join(projectClaudeDir, dir);
		if (!existsSync(dirPath)) {
			missingDirs.push(dir);
		}
	}

	// Check if only CLAUDE.md exists (minimal config)
	const files = await readdir(projectClaudeDir).catch(() => []);
	const hasOnlyClaudeMd = files.length === 1 && (files as string[]).includes("CLAUDE.md");

	if (hasOnlyClaudeMd || missingDirs.length === requiredDirs.length) {
		return {
			id: "ck-project-config-complete",
			name: "Project Config Completeness",
			group: "claudekit",
			priority: "standard",
			status: "fail",
			message: "Incomplete configuration",
			details: "Only CLAUDE.md found - missing agents, commands, workflows, skills",
			suggestion: "Run 'ck init' to install complete ClaudeKit in project",
			autoFixable: false,
		};
	}

	if (missingDirs.length > 0) {
		return {
			id: "ck-project-config-complete",
			name: "Project Config Completeness",
			group: "claudekit",
			priority: "standard",
			status: "warn",
			message: `Missing ${missingDirs.length} directories`,
			details: `Missing: ${missingDirs.join(", ")}`,
			suggestion: "Run 'ck init' to update project configuration",
			autoFixable: false,
		};
	}

	return {
		id: "ck-project-config-complete",
		name: "Project Config Completeness",
		group: "claudekit",
		priority: "standard",
		status: "pass",
		message: "Complete configuration",
		details: projectClaudeDir,
		autoFixable: false,
	};
}
