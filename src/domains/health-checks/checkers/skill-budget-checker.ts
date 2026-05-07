import { join, resolve } from "node:path";
import { PathResolver } from "@/shared/path-resolver.js";
import type { ClaudeKitSetup } from "@/types";
import type { CheckResult } from "../types.js";
import type { SkillMeta } from "./skill-budget-scanner.js";
import { scanSkills } from "./skill-budget-scanner.js";
import {
	MAX_DESC_CHARS,
	MIN_BUDGET_FRACTION,
	RECOMMENDED_DESC_CHARS,
	type SettingsRead,
	applyBudgetDefaults,
	readProjectSettings,
} from "./skill-budget-settings.js";

export async function checkSkillBudget(
	setup: ClaudeKitSetup,
	projectDir: string,
): Promise<CheckResult[]> {
	const projectClaudeDir = resolve(projectDir, ".claude");
	const globalClaudeDir = PathResolver.getGlobalKitDir();
	const [projectSkills, globalSkills] = await Promise.all([
		scanSkills(join(projectClaudeDir, "skills")),
		scanSkills(join(globalClaudeDir, "skills")),
	]);

	if (!isEngineerLikeProject(setup, projectSkills)) return [];

	const settingsPath = join(projectClaudeDir, "settings.json");
	const settings = await readProjectSettings(settingsPath);
	return [
		buildBudgetSettingsCheck(settingsPath, projectClaudeDir, settings),
		buildDescriptionInventoryCheck(projectSkills),
		buildDuplicateInventoryCheck(projectSkills, globalSkills),
		buildAgentVisibilityCheck(projectSkills),
	];
}

function isEngineerLikeProject(setup: ClaudeKitSetup, projectSkills: SkillMeta[]): boolean {
	const metadataText = [
		setup.project.metadata?.name,
		setup.project.metadata?.description,
		setup.project.metadata?.repository?.url,
	]
		.filter(Boolean)
		.join(" ")
		.toLowerCase();
	return metadataText.includes("engineer") || projectSkills.length >= 20;
}

function buildBudgetSettingsCheck(
	settingsPath: string,
	projectClaudeDir: string,
	read: SettingsRead,
): CheckResult {
	if (read.error) {
		return {
			id: "ck-skill-listing-budget",
			name: "Skill Listing Budget",
			group: "claudekit",
			priority: "standard",
			status: "fail",
			message: "Invalid project settings",
			details: `${settingsPath}: ${read.error}`,
			suggestion: "Fix JSON syntax, then run: ck doctor --fix",
			autoFixable: false,
		};
	}

	const budget = read.settings?.skillListingBudgetFraction;
	const maxDesc = read.settings?.skillListingMaxDescChars;
	const problems = [
		typeof budget !== "number" || budget < MIN_BUDGET_FRACTION
			? `skillListingBudgetFraction >= ${MIN_BUDGET_FRACTION}`
			: "",
		typeof maxDesc !== "number" || maxDesc > MAX_DESC_CHARS
			? `skillListingMaxDescChars <= ${MAX_DESC_CHARS}`
			: "",
	].filter(Boolean);

	if (problems.length === 0) {
		return pass("ck-skill-listing-budget", "Skill Listing Budget", "Project defaults configured");
	}

	return {
		id: "ck-skill-listing-budget",
		name: "Skill Listing Budget",
		group: "claudekit",
		priority: "standard",
		status: "fail",
		message: `Needs ${problems.join(", ")}`,
		details: read.exists ? settingsPath : `${settingsPath} (missing)`,
		suggestion: "Run: ck doctor --fix",
		autoFixable: true,
		fix: {
			id: "fix-skill-listing-budget",
			description: "Merge safe Claude Code skill listing defaults into project settings",
			execute: async () => applyBudgetDefaults(settingsPath, projectClaudeDir),
		},
	};
}

function buildDescriptionInventoryCheck(projectSkills: SkillMeta[]): CheckResult {
	const totalChars = projectSkills.reduce((sum, skill) => sum + skill.description.length, 0);
	const overRecommended = projectSkills.filter(
		(skill) => skill.description.length > RECOMMENDED_DESC_CHARS,
	).length;
	const overCap = projectSkills.filter((skill) => skill.description.length > MAX_DESC_CHARS);
	if (overCap.length === 0) {
		return pass(
			"ck-skill-description-inventory",
			"Skill Description Inventory",
			`${projectSkills.length} skills, ${totalChars} chars, ${overRecommended} over ${RECOMMENDED_DESC_CHARS}`,
		);
	}
	return warn(
		"ck-skill-description-inventory",
		"Skill Description Inventory",
		`${overCap.length} skill description(s) over ${MAX_DESC_CHARS} chars`,
		overCap,
		"Update Engineer Kit or trim frontmatter descriptions; keep detail in the skill body.",
	);
}

function buildDuplicateInventoryCheck(
	projectSkills: SkillMeta[],
	globalSkills: SkillMeta[],
): CheckResult {
	const globalIds = new Set(globalSkills.map((skill) => skill.id));
	const duplicates = projectSkills.filter((skill) => globalIds.has(skill.id));
	if (duplicates.length === 0) {
		return pass("ck-skill-inventory", "Skill Inventory", "No duplicate project/global skills");
	}
	return warn(
		"ck-skill-inventory",
		"Skill Inventory",
		`${duplicates.length} duplicate project/global skill(s)`,
		duplicates,
		"Keep one installation scope per skill; inspect with: ck skills list --installed",
	);
}

function buildAgentVisibilityCheck(projectSkills: SkillMeta[]): CheckResult {
	const userVisible = projectSkills.filter((skill) => skill.userInvocable !== false);
	if (userVisible.length === 0) {
		return pass(
			"ck-skill-agent-visibility",
			"Skill Agent Visibility",
			"All project skills are agent-only",
		);
	}
	return warn(
		"ck-skill-agent-visibility",
		"Skill Agent Visibility",
		`${userVisible.length} project skill(s) still user-invocable`,
		userVisible,
		"Update Engineer Kit or set `user-invocable: false` in SKILL.md frontmatter.",
	);
}

function pass(id: string, name: string, message: string): CheckResult {
	return {
		id,
		name,
		group: "claudekit",
		priority: "standard",
		status: "pass",
		message,
		autoFixable: false,
	};
}

function warn(
	id: string,
	name: string,
	message: string,
	skills: SkillMeta[],
	suggestion: string,
): CheckResult {
	const details = skills
		.slice(0, 10)
		.map((skill) => `${skill.id}: ${skill.file}`)
		.join("\n");
	return {
		id,
		name,
		group: "claudekit",
		priority: "standard",
		status: "warn",
		message,
		details,
		suggestion,
		autoFixable: false,
	};
}
