import { join } from "node:path";
import { scanSkills } from "@/domains/health-checks/checkers/skill-budget-scanner.js";
import { PathResolver } from "@/shared/path-resolver.js";

export type ClaudeSkillScope = "project" | "global";

export interface ActiveClaudeSkillInstallation {
	skill: string;
	scope: ClaudeSkillScope;
	path: string;
	duplicateAcrossScopes: boolean;
}

export interface ActiveClaudeSkillInventoryOptions {
	projectDir?: string;
	globalDir?: string;
}

const SCOPE_SORT_ORDER: Record<ClaudeSkillScope, number> = {
	project: 0,
	global: 1,
};

export async function getActiveClaudeSkillInstallations(
	options: ActiveClaudeSkillInventoryOptions = {},
): Promise<ActiveClaudeSkillInstallation[]> {
	const projectDir = options.projectDir ?? process.cwd();
	const globalDir = options.globalDir ?? PathResolver.getGlobalKitDir();
	const [projectSkills, globalSkills] = await Promise.all([
		scanSkills(join(projectDir, ".claude", "skills")),
		scanSkills(join(globalDir, "skills")),
	]);
	const projectIds = new Set(projectSkills.map((skill) => skill.id));
	const globalIds = new Set(globalSkills.map((skill) => skill.id));

	return [
		...projectSkills.map((skill) => ({
			skill: skill.id,
			scope: "project" as const,
			path: skill.file,
			duplicateAcrossScopes: globalIds.has(skill.id),
		})),
		...globalSkills.map((skill) => ({
			skill: skill.id,
			scope: "global" as const,
			path: skill.file,
			duplicateAcrossScopes: projectIds.has(skill.id),
		})),
	].sort(
		(a, b) =>
			a.skill.localeCompare(b.skill) || SCOPE_SORT_ORDER[a.scope] - SCOPE_SORT_ORDER[b.scope],
	);
}
