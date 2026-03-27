/**
 * Commands Command Help
 *
 * Help definition for the 'commands' command.
 */

import type { CommandHelp } from "../help-types.js";

export const commandsCommandHelp: CommandHelp = {
	name: "commands",
	description: "Install, uninstall, and manage Claude commands across providers",
	usage: "ck commands [options]",
	examples: [
		{
			command: "ck commands --name plan --agent codex",
			description: "Install one slash command to Codex",
		},
		{
			command: "ck commands --list",
			description: "List available commands from source",
		},
	],
	optionGroups: [
		{
			title: "Mode Options",
			options: [
				{
					flags: "-l, --list",
					description: "List available commands from source",
				},
				{
					flags: "--installed",
					description: "When used with --list, show installed commands instead",
				},
				{
					flags: "-u, --uninstall",
					description: "Uninstall command(s) from providers",
				},
				{
					flags: "--sync",
					description: "Sync registry with filesystem (clean orphaned entries)",
				},
			],
		},
		{
			title: "Installation Options",
			options: [
				{
					flags: "-n, --name <command>",
					description: "Command name to install or uninstall",
				},
				{
					flags: "-a, --agent <provider>",
					description: "Target provider(s), can be specified multiple times",
				},
				{
					flags: "-g, --global",
					description: "Install globally instead of project-level",
				},
				{
					flags: "--all",
					description: "Install to all supported providers",
				},
				{
					flags: "-y, --yes",
					description: "Skip confirmation prompts",
				},
			],
		},
		{
			title: "Uninstall Options",
			options: [
				{
					flags: "--force",
					description: "Force uninstall even if not tracked in registry",
				},
			],
		},
	],
};
