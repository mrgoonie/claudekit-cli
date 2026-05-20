/**
 * Enhanced workflows hook that resolves skill commands dynamically from the skills API.
 * This ensures the command invocation syntax comes from the single source of truth
 * (the skill's SKILL.md triggers field) rather than being hardcoded in workflow data.
 */
import { useMemo } from "react";
import { ENGINEER_KIT_WORKFLOWS } from "../data/engineer-kit-workflows";
import type { ResolvedWorkflow, ResolvedWorkflowStep, Workflow } from "../types/workflow-types";
import type { SkillBrowserItem } from "./use-skills-browser";
import { useSkillsBrowser } from "./use-skills-browser";

/**
 * Build a lookup map from skill name to its primary trigger command.
 * Uses triggers[0] as the canonical invocation command.
 *
 * IMPORTANT: Some skills have "ck-" prefix in folder names (e.g., "ck-plan", "ck-debug")
 * but workflows reference them without prefix (e.g., "plan", "debug").
 * This function creates aliases for both forms to ensure lookups work either way.
 */
function buildSkillCommandMap(skills: SkillBrowserItem[]): Map<string, string> {
	const map = new Map<string, string>();
	for (const skill of skills) {
		if (skill.triggers && skill.triggers.length > 0) {
			const trigger = skill.triggers[0];
			// Map the actual skill name
			map.set(skill.name, trigger);

			// Create alias without "ck-" prefix for skills that have it
			// e.g., "ck-plan" -> also accessible as "plan"
			if (skill.name.startsWith("ck-")) {
				const shortName = skill.name.slice(3);
				if (!map.has(shortName)) {
					map.set(shortName, trigger);
				}
			}
		}
	}
	return map;
}

/**
 * Resolve a workflow's steps by looking up commands from the skills API.
 * Falls back to "/ck:{skill}" if skill not found in API.
 */
function resolveWorkflowSteps(
	workflow: Workflow,
	skillCommandMap: Map<string, string>,
): ResolvedWorkflowStep[] {
	return workflow.steps.map((step) => {
		// If step already has a command with args (e.g., "/ck:cook @plan.md"), preserve it
		const existingCommand = step.command;
		if (existingCommand?.includes(" ")) {
			return { ...step, command: existingCommand };
		}

		// Look up command from skills API
		const apiCommand = skillCommandMap.get(step.skill);
		if (apiCommand) {
			// Preserve any arguments from the original command
			const args = existingCommand?.split(" ").slice(1).join(" ") || "";
			return {
				...step,
				command: args ? `${apiCommand} ${args}` : apiCommand,
			};
		}

		// Fallback: use existing command or generate default
		return {
			...step,
			command: existingCommand || `/ck:${step.skill}`,
		};
	});
}

/**
 * Resolve all workflows with commands from the skills API.
 */
function resolveWorkflows(
	workflows: Workflow[],
	skillCommandMap: Map<string, string>,
): ResolvedWorkflow[] {
	return workflows.map((workflow) => ({
		...workflow,
		steps: resolveWorkflowSteps(workflow, skillCommandMap),
	}));
}

/**
 * Build a map to resolve short skill names to actual API skill names.
 * e.g., "plan" -> "ck-plan" (for skills with ck- prefix)
 *
 * IMPORTANT: Some skills have "ck-" prefix in folder names but are invoked
 * without the prefix in commands. This map enables correct URL navigation.
 */
function buildSkillNameResolver(skills: SkillBrowserItem[]): Map<string, string> {
	const map = new Map<string, string>();
	for (const skill of skills) {
		// Map actual name to itself
		map.set(skill.name, skill.name);

		// Create alias: short name -> actual name
		// e.g., "plan" -> "ck-plan"
		if (skill.name.startsWith("ck-")) {
			const shortName = skill.name.slice(3);
			if (!map.has(shortName)) {
				map.set(shortName, skill.name);
			}
		}
	}
	return map;
}

export interface UseWorkflowsEnhancedResult {
	workflows: ResolvedWorkflow[];
	loading: boolean;
	error: string | null;
	/** Resolve short skill name to actual API skill name (e.g., "plan" -> "ck-plan") */
	resolveSkillName: (shortName: string) => string;
}

/**
 * Hook that provides workflows with dynamically resolved commands from the skills API.
 * Commands are derived from each skill's triggers[0] field in SKILL.md.
 */
export function useWorkflowsEnhanced(): UseWorkflowsEnhancedResult {
	const { skills, loading, error } = useSkillsBrowser();

	const { workflows, resolveSkillName } = useMemo(() => {
		const skillCommandMap = buildSkillCommandMap(skills);
		const skillNameResolver = buildSkillNameResolver(skills);
		return {
			workflows: resolveWorkflows(ENGINEER_KIT_WORKFLOWS, skillCommandMap),
			resolveSkillName: (shortName: string) => skillNameResolver.get(shortName) || shortName,
		};
	}, [skills]);

	return { workflows, loading, error, resolveSkillName };
}
