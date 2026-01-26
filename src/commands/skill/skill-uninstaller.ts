/**
 * Skill uninstaller - removes skills from agent directories
 */
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { agents } from "./agents.js";
import { findInstallation, readRegistry, removeInstallation } from "./skill-registry.js";
import type { AgentType, SkillInstallation } from "./types.js";

export interface UninstallResult {
	skill: string;
	agent: AgentType;
	agentDisplayName: string;
	global: boolean;
	path: string;
	success: boolean;
	error?: string;
	wasOrphaned?: boolean; // Entry existed in registry but file was already gone
}

/**
 * Uninstall a skill from a specific agent
 */
export async function uninstallSkillFromAgent(
	skill: string,
	agent: AgentType,
	global: boolean,
): Promise<UninstallResult> {
	const agentConfig = agents[agent];
	const registry = await readRegistry();

	// Find installation in registry
	const installations = findInstallation(registry, skill, agent, global);

	if (installations.length === 0) {
		return {
			skill,
			agent,
			agentDisplayName: agentConfig.displayName,
			global,
			path: "",
			success: false,
			error: "Skill not found in registry. Use --force to remove anyway.",
		};
	}

	const installation = installations[0];
	const path = installation.path;

	// Check if file actually exists
	const fileExists = existsSync(path);

	try {
		// Remove from filesystem if exists
		if (fileExists) {
			await rm(path, { recursive: true, force: true });
		}

		// Remove from registry
		await removeInstallation(skill, agent, global);

		return {
			skill,
			agent,
			agentDisplayName: agentConfig.displayName,
			global,
			path,
			success: true,
			wasOrphaned: !fileExists,
		};
	} catch (error) {
		return {
			skill,
			agent,
			agentDisplayName: agentConfig.displayName,
			global,
			path,
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Force uninstall a skill (bypasses registry, uses computed path)
 */
export async function forceUninstallSkill(
	skill: string,
	agent: AgentType,
	global: boolean,
): Promise<UninstallResult> {
	const agentConfig = agents[agent];
	const basePath = global ? agentConfig.globalPath : agentConfig.projectPath;
	const path = `${basePath}/${skill}`;

	if (!existsSync(path)) {
		return {
			skill,
			agent,
			agentDisplayName: agentConfig.displayName,
			global,
			path,
			success: false,
			error: "Skill directory not found",
		};
	}

	try {
		await rm(path, { recursive: true, force: true });

		// Also try to remove from registry if it exists there
		await removeInstallation(skill, agent, global);

		return {
			skill,
			agent,
			agentDisplayName: agentConfig.displayName,
			global,
			path,
			success: true,
		};
	} catch (error) {
		return {
			skill,
			agent,
			agentDisplayName: agentConfig.displayName,
			global,
			path,
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Get list of installed skills from registry
 */
export async function getInstalledSkills(
	agent?: AgentType,
	global?: boolean,
): Promise<SkillInstallation[]> {
	const registry = await readRegistry();

	return registry.installations.filter((i) => {
		if (agent && i.agent !== agent) return false;
		if (global !== undefined && i.global !== global) return false;
		return true;
	});
}
