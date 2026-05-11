import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { ClaudeKitSetup } from "@/types";
import type { CheckResult } from "../types.js";

/**
 * Check if project configuration is complete (not just CLAUDE.md).
 *
 * Only fails when the user has opted into a project-level install
 * (signalled by metadata.json — same gate used by installation-checker
 * and skills-checker). Otherwise the project is treated as "using global"
 * and the check is informational, not a failure.
 */
export async function checkProjectConfigCompleteness(
	setup: ClaudeKitSetup,
	projectDir: string,
): Promise<CheckResult> {
	const baseResult = {
		id: "ck-project-config-complete" as const,
		name: "Project Config Completeness",
		group: "claudekit" as const,
		priority: "standard" as const,
		autoFixable: false,
	};

	// Inside the global dir itself — check is N/A
	if (setup.project.path === setup.global.path) {
		return {
			...baseResult,
			status: "info",
			message: "Not in a project directory",
		};
	}

	const hasGlobalInstall = !!setup.global.metadata;
	const hasProjectOptIn = !!setup.project.metadata;

	// User never ran `ck init` here. Don't flag missing dirs as a failure —
	// global install (if present) covers them. Surface as info so users
	// understand it's intentional, not broken.
	if (!hasProjectOptIn) {
		if (hasGlobalInstall) {
			return {
				...baseResult,
				status: "info",
				message: "Using global ClaudeKit (no project override)",
				details: "Run 'ck init' here only if you want project-specific agents/skills/rules",
			};
		}
		return {
			...baseResult,
			status: "warn",
			message: "ClaudeKit not installed",
			suggestion: "Run 'ck init' (choose global or project scope when prompted)",
		};
	}

	// Project opted in via `ck init` — verify expected dirs exist.
	const projectClaudeDir = join(projectDir, ".claude");
	const requiredDirs = ["agents", "commands", "skills"];
	const missingDirs: string[] = [];

	for (const dir of requiredDirs) {
		if (!existsSync(join(projectClaudeDir, dir))) {
			missingDirs.push(dir);
		}
	}

	// Backward compat: rules OR workflows satisfies the "rules" requirement
	const hasRulesOrWorkflows =
		existsSync(join(projectClaudeDir, "rules")) || existsSync(join(projectClaudeDir, "workflows"));

	if (!hasRulesOrWorkflows) {
		missingDirs.push("rules");
	}

	const files = await readdir(projectClaudeDir).catch(() => []);
	const hasOnlyClaudeMd = files.length === 1 && (files as string[]).includes("CLAUDE.md");
	const totalRequired = requiredDirs.length + 1; // +1 for rules/workflows

	if (hasOnlyClaudeMd || missingDirs.length === totalRequired) {
		return {
			...baseResult,
			status: "fail",
			message: "Incomplete configuration",
			details: "Only CLAUDE.md found - missing agents, commands, rules, skills",
			suggestion: "Run 'ck init' to install complete ClaudeKit in project",
		};
	}

	if (missingDirs.length > 0) {
		return {
			...baseResult,
			status: "warn",
			message: `Missing ${missingDirs.length} directories`,
			details: `Missing: ${missingDirs.join(", ")}`,
			suggestion: "Run 'ck init' to update project configuration",
		};
	}

	return {
		...baseResult,
		status: "pass",
		message: "Complete configuration",
		details: projectClaudeDir,
	};
}
