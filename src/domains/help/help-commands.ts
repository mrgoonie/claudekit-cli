/**
 * Help Command Definitions
 *
 * Facade file re-exporting all command help definitions.
 * Single source of truth for help output.
 */

import {
	agentsCommandHelp,
	commandsCommandHelp,
	configCommandHelp,
	doctorCommandHelp,
	initCommandHelp,
	newCommandHelp,
	migrateCommandHelp,
	projectsCommandHelp,
	setupCommandHelp,
	skillsCommandHelp,
	uninstallCommandHelp,
	updateCommandHelp,
	versionsCommandHelp,
} from "./commands/index.js";
import type { CommandHelp, CommandRegistry } from "./help-types.js";

/**
 * Registry of all command help definitions
 */
export const HELP_REGISTRY: CommandRegistry = {
	new: newCommandHelp,
	init: initCommandHelp,
	config: configCommandHelp,
	projects: projectsCommandHelp,
	setup: setupCommandHelp,
	update: updateCommandHelp,
	versions: versionsCommandHelp,
	doctor: doctorCommandHelp,
	uninstall: uninstallCommandHelp,
	skills: skillsCommandHelp,
	agents: agentsCommandHelp,
	commands: commandsCommandHelp,
	migrate: migrateCommandHelp,
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
	commandsCommandHelp,
	configCommandHelp,
	doctorCommandHelp,
	initCommandHelp,
	newCommandHelp,
	migrateCommandHelp,
	projectsCommandHelp,
	setupCommandHelp,
	skillsCommandHelp,
	uninstallCommandHelp,
	updateCommandHelp,
	versionsCommandHelp,
} from "./commands/index.js";
