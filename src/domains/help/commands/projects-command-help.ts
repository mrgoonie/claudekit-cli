/**
 * Projects Command Help
 *
 * Help definition for the 'projects' command group.
 */

import type { CommandHelp } from "../help-types.js";

export const projectsCommandHelp: CommandHelp = {
	name: "projects",
	description: "Manage local ClaudeKit project registry entries",
	usage: "ck projects <subcommand> [options]",
	examples: [
		{
			command: "ck projects list --pinned",
			description: "Show only pinned projects",
		},
		{
			command: "ck projects add . --alias engine --pinned",
			description: "Add current directory with an alias and pin it",
		},
	],
	optionGroups: [
		{
			title: "Subcommands",
			options: [
				{
					flags: "list | ls",
					description: "List projects in registry",
				},
				{
					flags: "add <path>",
					description: "Add project path to registry",
				},
				{
					flags: "remove [alias] | rm [alias]",
					description: "Remove project by alias or ID",
				},
			],
		},
		{
			title: "List Options",
			options: [
				{
					flags: "--json",
					description: "Output in JSON format",
				},
				{
					flags: "--pinned",
					description: "Filter to pinned projects only",
				},
			],
		},
		{
			title: "Add/Remove Options",
			options: [
				{
					flags: "--alias <alias>",
					description: "Custom alias for project (add)",
				},
				{
					flags: "--tags <tags>",
					description: "Comma-separated tags (add)",
				},
				{
					flags: "--id <id>",
					description: "Remove by project ID (remove)",
				},
			],
		},
	],
};
