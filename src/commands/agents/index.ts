/**
 * Agents command module
 *
 * Install Claude Code agents to other coding providers
 */
export { agentsCommand } from "./agents-command.js";
export { discoverAgents, findAgentByName, getAgentSourcePath } from "./agents-discovery.js";
export { getInstalledAgents, uninstallAgentFromProvider } from "./agents-uninstaller.js";
