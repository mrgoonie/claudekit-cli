import { existsSync } from "node:fs";
/**
 * Skill installer - copies skills to target agent directories
 */
import { cp, mkdir, rm, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { agents, getInstallPath, isSkillInstalled } from "./agents.js";
import { addInstallation, readRegistry, writeRegistry } from "./skills-registry.js";
import type { AgentType, InstallResult, SkillInfo } from "./types.js";

/** Legacy paths that were consolidated to .agents/skills — keyed by agent type */
const LEGACY_SKILL_PATHS: Partial<Record<AgentType, { project: string; global: string }>> = {
	"gemini-cli": {
		project: ".gemini/skills",
		global: join(homedir(), ".gemini/skills"),
	},
};

/**
 * Check if two paths resolve to the same location
 */
function isSamePath(path1: string, path2: string): boolean {
	try {
		return resolve(path1) === resolve(path2);
	} catch {
		return false;
	}
}

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
 * Remove legacy skill copy from old path and update registry entry
 * Called during install to clean up after path consolidation (e.g., .gemini/skills -> .agents/skills)
 */
async function cleanupLegacySkillPath(
	skillName: string,
	agent: AgentType,
	global: boolean,
): Promise<void> {
	const legacy = LEGACY_SKILL_PATHS[agent];
	if (!legacy) return;

	const legacyBase = global ? legacy.global : legacy.project;
	const legacyPath = join(legacyBase, skillName);

	if (!existsSync(legacyPath)) return;

	// Remove old directory
	await rm(legacyPath, { recursive: true, force: true });

	// Update registry: rewrite any entries still pointing to old path
	const registry = await readRegistry();
	let changed = false;
	for (const entry of registry.installations) {
		if (entry.skill === skillName && entry.agent === agent && entry.global === global) {
			if (entry.path === legacyPath) {
				const newBase = global ? agents[agent].globalPath : agents[agent].projectPath;
				entry.path = join(newBase, skillName);
				changed = true;
			}
		}
	}
	if (changed) {
		await writeRegistry(registry);
	}
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

	// Skip if source and target are the same location (e.g., installing Claude Code skill to Claude Code)
	if (isSamePath(skill.path, targetPath)) {
		return {
			agent,
			agentDisplayName: agentConfig.displayName,
			success: true,
			path: targetPath,
			skipped: true,
			skipReason: "Skill already exists at source location",
		};
	}

	try {
		// Clean up legacy skill path if this agent was consolidated (e.g., .gemini/skills -> .agents/skills)
		await cleanupLegacySkillPath(skill.name, agent, options.global);

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

		// Register installation in central registry
		await addInstallation(skill.name, agent, options.global, targetPath, skill.path);

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
 * Install a skill to multiple agents (parallelized for performance)
 */
export async function installSkillToAgents(
	skill: SkillInfo,
	targetAgents: AgentType[],
	options: { global: boolean },
): Promise<InstallResult[]> {
	// Parallelize installations since each agent has independent paths
	return Promise.all(targetAgents.map((agent) => installSkillForAgent(skill, agent, options)));
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
