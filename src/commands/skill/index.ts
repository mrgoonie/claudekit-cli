/**
 * Skill command module
 *
 * Install ClaudeKit skills to other coding agents (Cursor, Codex, Goose, etc.)
 */

export { skillCommand } from "./skill-command.js";
export {
	agents,
	detectInstalledAgents,
	getAgentConfig,
	getInstallPath,
	isSkillInstalled,
} from "./agents.js";
export { discoverSkills, findSkillByName, getSkillSourcePath } from "./skill-discovery.js";
export {
	installSkillForAgent,
	installSkillToAgents,
	getInstallPreview,
} from "./skill-installer.js";
export type {
	AgentType,
	AgentConfig,
	SkillInfo,
	SkillCommandOptions,
	SkillContext,
	InstallResult,
} from "./types.js";
