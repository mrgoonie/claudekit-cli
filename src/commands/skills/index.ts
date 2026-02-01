/**
 * Skills command module
 *
 * Install ClaudeKit skills to other coding agents (Cursor, Codex, Goose, etc.)
 */

export { skillsCommand } from "./skills-command.js";
export {
	agents,
	detectInstalledAgents,
	getAgentConfig,
	getInstallPath,
	isSkillInstalled,
} from "./agents.js";
export { discoverSkills, findSkillByName, getSkillSourcePath } from "./skills-discovery.js";
export {
	installSkillForAgent,
	installSkillToAgents,
	getInstallPreview,
} from "./skills-installer.js";
export {
	readRegistry,
	writeRegistry,
	addInstallation,
	removeInstallation,
	syncRegistry,
} from "./skills-registry.js";
export {
	uninstallSkillFromAgent,
	forceUninstallSkill,
	getInstalledSkills,
} from "./skills-uninstaller.js";
export type {
	AgentType,
	AgentConfig,
	SkillInfo,
	SkillCommandOptions,
	SkillContext,
	InstallResult,
	SkillInstallation,
} from "./types.js";
