import { join, resolve } from "node:path";
import { PathResolver } from "@/shared/path-resolver.js";
import type { ClaudeKitSetup } from "@/types";
import type { CheckResult } from "../types.js";
import type { SkillMeta } from "./skill-budget-scanner.js";
import { scanSkills } from "./skill-budget-scanner.js";
import {
	CHARS_PER_TOKEN,
	CK_RECOMMENDED_MAX_DESC_CHARS,
	CONTEXT_FLOOR_TOKENS,
	RECOMMENDED_DESC_CHARS,
	type SettingsRead,
	applyBudgetDefaults,
	estimateListingChars,
	readProjectSettings,
	requiredBudgetFraction,
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
	const activeSkills = [...projectSkills, ...globalSkills];
	const listingSkills = uniqueSkills(activeSkills);
	const maxDescForEstimate = validMaxDesc(settings.settings?.skillListingMaxDescChars)
		? Math.min(settings.settings.skillListingMaxDescChars, CK_RECOMMENDED_MAX_DESC_CHARS)
		: CK_RECOMMENDED_MAX_DESC_CHARS;
	const listingChars = estimateListingChars(listingSkills, maxDescForEstimate);
	const requiredFraction = requiredBudgetFraction(listingChars);
	return [
		buildBudgetSettingsCheck(
			settingsPath,
			projectClaudeDir,
			settings,
			listingChars,
			requiredFraction,
		),
		buildDescriptionInventoryCheck(activeSkills),
		buildDuplicateInventoryCheck(projectSkills, globalSkills),
		buildSkillOverridesCheck(settingsPath, settings),
		buildUserInvocationCheck(activeSkills),
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
	listingChars: number,
	requiredFraction: number,
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
		!validBudgetFraction(budget) || budget < requiredFraction
			? `skillListingBudgetFraction >= ${formatFraction(requiredFraction)}`
			: "",
		!validMaxDesc(maxDesc) || maxDesc > CK_RECOMMENDED_MAX_DESC_CHARS
			? `skillListingMaxDescChars <= ${CK_RECOMMENDED_MAX_DESC_CHARS}`
			: "",
	].filter(Boolean);
	const details = [
		read.exists ? settingsPath : `${settingsPath} (missing)`,
		`estimated active project/global skill listing: ${listingChars} chars (~${Math.ceil(
			listingChars / CHARS_PER_TOKEN,
		)} tokens), ${formatPercent(requiredFraction)} of a ${CONTEXT_FLOOR_TOKENS.toLocaleString()} token context floor`,
	].join("\n");

	if (problems.length === 0) {
		return {
			...pass("ck-skill-listing-budget", "Skill Listing Budget", "Project defaults configured"),
			details,
		};
	}

	return {
		id: "ck-skill-listing-budget",
		name: "Skill Listing Budget",
		group: "claudekit",
		priority: "standard",
		status: "fail",
		message: `Needs ${problems.join(", ")}`,
		details,
		suggestion: "Run: ck doctor --fix",
		autoFixable: true,
		fix: {
			id: "fix-skill-listing-budget",
			description: "Merge ClaudeKit skill listing budget settings into project settings",
			execute: async () => applyBudgetDefaults(settingsPath, projectClaudeDir, requiredFraction),
		},
	};
}

function buildDescriptionInventoryCheck(activeSkills: SkillMeta[]): CheckResult {
	const totalChars = activeSkills.reduce((sum, skill) => sum + skill.description.length, 0);
	const overRecommended = activeSkills.filter(
		(skill) => skill.description.length > RECOMMENDED_DESC_CHARS,
	).length;
	const overCap = activeSkills.filter(
		(skill) => skill.description.length > CK_RECOMMENDED_MAX_DESC_CHARS,
	);
	if (overCap.length === 0) {
		return pass(
			"ck-skill-description-inventory",
			"Skill Description Inventory",
			`${activeSkills.length} active project/global skills, ${totalChars} chars, ${overRecommended} over ${RECOMMENDED_DESC_CHARS}`,
		);
	}
	return warn(
		"ck-skill-description-inventory",
		"Skill Description Inventory",
		`${overCap.length} skill description(s) over ${CK_RECOMMENDED_MAX_DESC_CHARS} chars`,
		overCap,
		"Update Engineer Kit or trim frontmatter descriptions to the ClaudeKit recommended cap; keep detail in the skill body.",
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

function buildSkillOverridesCheck(settingsPath: string, read: SettingsRead): CheckResult {
	if (!read.settings || !Object.prototype.hasOwnProperty.call(read.settings, "skillOverrides")) {
		return pass(
			"ck-skill-overrides-policy",
			"Skill Overrides Policy",
			"No skillOverrides configured",
		);
	}
	return warn(
		"ck-skill-overrides-policy",
		"Skill Overrides Policy",
		"Project settings contain skillOverrides",
		[{ id: "skillOverrides", description: "", file: settingsPath }],
		"Remove skillOverrides and manage listing pressure with skillListingBudgetFraction, skillListingMaxDescChars, and inventory cleanup.",
	);
}

function buildUserInvocationCheck(activeSkills: SkillMeta[]): CheckResult {
	const disabled = activeSkills.filter((skill) => skill.userInvocable === false);
	if (disabled.length === 0) {
		return pass(
			"ck-skill-agent-visibility",
			"Skill User Invocation",
			"All active project/global skills are user-invocable",
		);
	}
	return warn(
		"ck-skill-agent-visibility",
		"Skill User Invocation",
		`${disabled.length} active project/global skill(s) explicitly not user-invocable`,
		disabled,
		"Update Engineer Kit or set `user-invocable: true` in SKILL.md frontmatter.",
	);
}

function uniqueSkills(skills: SkillMeta[]): SkillMeta[] {
	const seen = new Set<string>();
	const unique: SkillMeta[] = [];
	for (const skill of skills) {
		if (seen.has(skill.id)) continue;
		seen.add(skill.id);
		unique.push(skill);
	}
	return unique;
}

function validBudgetFraction(value: unknown): value is number {
	return typeof value === "number" && value > 0 && value <= 1;
}

function validMaxDesc(value: unknown): value is number {
	return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function formatFraction(value: number): string {
	return Number(value.toFixed(3)).toString();
}

function formatPercent(value: number): string {
	return `${Number((value * 100).toFixed(1))}%`;
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
