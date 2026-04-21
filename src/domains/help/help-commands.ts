/**
 * Help Command Definitions
 *
 * Facade file re-exporting all command help definitions.
 * Single source of truth for help output.
 */

import {
	agentsCommandHelp,
	apiCommandHelp,
	appCommandHelp,
	backupsCommandHelp,
	commandsCommandHelp,
	configCommandHelp,
	contentCommandHelp,
	doctorCommandHelp,
	initCommandHelp,
	migrateCommandHelp,
	newCommandHelp,
	planCommandHelp,
	projectsCommandHelp,
	setupCommandHelp,
	skillsCommandHelp,
	uninstallCommandHelp,
	updateCommandHelp,
	versionsCommandHelp,
	watchCommandHelp,
} from "./commands/index.js";
import type { CommandHelp, CommandRegistry } from "./help-types.js";

/**
 * Registry of all command help definitions
 */
export const HELP_REGISTRY: CommandRegistry = {
	agents: agentsCommandHelp,
	api: apiCommandHelp,
	app: appCommandHelp,
	backups: backupsCommandHelp,
	commands: commandsCommandHelp,
	config: configCommandHelp,
	content: contentCommandHelp,
	doctor: doctorCommandHelp,
	init: initCommandHelp,
	migrate: migrateCommandHelp,
	new: newCommandHelp,
	plan: planCommandHelp,
	projects: projectsCommandHelp,
	setup: setupCommandHelp,
	skills: skillsCommandHelp,
	uninstall: uninstallCommandHelp,
	update: updateCommandHelp,
	versions: versionsCommandHelp,
	watch: watchCommandHelp,
};

/**
 * Get help definition for a specific command
 */
export function getCommandHelp(command: string): CommandHelp | undefined {
	return HELP_REGISTRY[command];
}

/**
 * Get list of all command names
 */
export function getAllCommands(): string[] {
	return Object.keys(HELP_REGISTRY);
}

/**
 * Check if a command exists in the registry
 */
export function hasCommand(command: string): boolean {
	return command in HELP_REGISTRY;
}

// Re-export types and individual command helps for direct access
export type { CommandHelp, CommandRegistry } from "./help-types.js";
export {
	agentsCommandHelp,
	apiCommandHelp,
	appCommandHelp,
	backupsCommandHelp,
	commandsCommandHelp,
	configCommandHelp,
	contentCommandHelp,
	doctorCommandHelp,
	initCommandHelp,
	migrateCommandHelp,
	newCommandHelp,
	planCommandHelp,
	projectsCommandHelp,
	setupCommandHelp,
	skillsCommandHelp,
	uninstallCommandHelp,
	updateCommandHelp,
	versionsCommandHelp,
	watchCommandHelp,
} from "./commands/index.js";
