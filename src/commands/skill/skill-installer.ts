import { existsSync } from "node:fs";
/**
 * Skill installer - copies skills to target agent directories
 */
import { cp, mkdir, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { agents, getInstallPath, isSkillInstalled } from "./agents.js";
import type { AgentType, InstallResult, SkillInfo } from "./types.js";

/**
 * Map Node.js error codes to user-friendly messages
 */
function getErrorMessage(error: unknown, targetPath: string): string {
	if (error instanceof Error && "code" in error) {
		const code = (error as NodeJS.ErrnoException).code;
		switch (code) {
			case "EACCES":
			case "EPERM":
				return `Permission denied: ${targetPath}`;
			case "ENOSPC":
				return "Disk full - no space left on device";
			case "ENOTDIR":
				return `Path exists as file, not directory: ${targetPath}`;
			case "EROFS":
				return `Read-only filesystem: ${targetPath}`;
			default:
				return error.message;
		}
	}
	return error instanceof Error ? error.message : "Unknown error";
}

/**
 * Install a skill to a specific agent
 */
export async function installSkillForAgent(
	skill: SkillInfo,
	agent: AgentType,
	options: { global: boolean },
): Promise<InstallResult> {
	const agentConfig = agents[agent];
	const targetPath = getInstallPath(skill.name, agent, options);
	const alreadyExists = isSkillInstalled(skill.name, agent, options);

	try {
		// Ensure parent directory exists
		const parentDir = dirname(targetPath);
		if (!existsSync(parentDir)) {
			await mkdir(parentDir, { recursive: true });
		}

		// Check if target exists as file (not directory) - would cause cp to fail
		if (existsSync(targetPath)) {
			const stats = await stat(targetPath);
			if (stats.isFile()) {
				return {
					agent,
					agentDisplayName: agentConfig.displayName,
					success: false,
					path: targetPath,
					error: `Cannot install: ${targetPath} exists as a file, not a directory`,
				};
			}
		}

		// Copy skill directory to target
		await cp(skill.path, targetPath, {
			recursive: true,
			force: true, // Overwrite if exists
		});

		return {
			agent,
			agentDisplayName: agentConfig.displayName,
			success: true,
			path: targetPath,
			overwritten: alreadyExists,
		};
	} catch (error) {
		return {
			agent,
			agentDisplayName: agentConfig.displayName,
			success: false,
			path: targetPath,
			error: getErrorMessage(error, targetPath),
		};
	}
}

/**
 * Install a skill to multiple agents
 */
export async function installSkillToAgents(
	skill: SkillInfo,
	targetAgents: AgentType[],
	options: { global: boolean },
): Promise<InstallResult[]> {
	const results: InstallResult[] = [];

	for (const agent of targetAgents) {
		const result = await installSkillForAgent(skill, agent, options);
		results.push(result);
	}

	return results;
}

/**
 * Get installation preview info for display
 */
export function getInstallPreview(
	skill: SkillInfo,
	targetAgents: AgentType[],
	options: { global: boolean },
): Array<{ agent: AgentType; displayName: string; path: string; exists: boolean }> {
	return targetAgents.map((agent) => {
		const config = agents[agent];
		const path = getInstallPath(skill.name, agent, options);
		const exists = isSkillInstalled(skill.name, agent, options);

		return {
			agent,
			displayName: config.displayName,
			path,
			exists,
		};
	});
}
