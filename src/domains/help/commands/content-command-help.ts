/**
 * Content Command Help
 *
 * Help definition for the 'content' command.
 */

import type { CommandHelp } from "../help-types.js";

export const contentCommandHelp: CommandHelp = {
	name: "content",
	description: "Multi-channel content automation engine",
	usage: "ck content [action] [id] [options]",
	examples: [
		{
			command: "ck content start",
			description: "Start the content daemon (default action)",
		},
		{
			command: "ck content setup",
			description: "Interactive configuration wizard",
		},
		{
			command: "ck content queue",
			description: "List pending content items for review",
		},
	],
	optionGroups: [
		{
			title: "Actions",
			options: [
				{
					flags: "start",
					description: "Start the content daemon (default when no action specified)",
				},
				{
					flags: "stop",
					description: "Stop the running content daemon",
				},
				{
					flags: "status",
					description: "Show daemon status and recent activity",
				},
				{
					flags: "logs",
					description: "View content daemon logs",
				},
				{
					flags: "setup",
					description: "Interactive configuration wizard",
				},
				{
					flags: "queue",
					description: "List pending content items",
				},
				{
					flags: "approve <id>",
					description: "Approve a content item for publishing",
				},
				{
					flags: "reject <id>",
					description: "Reject a content item",
				},
			],
		},
		{
			title: "Options",
			options: [
				{
					flags: "--dry-run",
					description: "Generate content without publishing",
				},
				{
					flags: "--verbose",
					description: "Enable verbose logging",
				},
				{
					flags: "--force",
					description: "Kill existing process and start fresh",
				},
				{
					flags: "--tail",
					description: "Follow log output in real-time (for logs action)",
				},
				{
					flags: "--reason <reason>",
					description: "Rejection reason (for reject action)",
				},
			],
		},
	],
	subcommands: [
		{
			name: "start",
			description: "Start the content daemon (default when no action specified)",
			usage: "ck content start",
			examples: [],
			optionGroups: [],
		},
		{
			name: "stop",
			description: "Stop the running content daemon",
			usage: "ck content stop",
			examples: [],
			optionGroups: [],
		},
		{
			name: "status",
			description: "Show daemon status and recent activity",
			usage: "ck content status",
			examples: [],
			optionGroups: [],
		},
		{
			name: "logs",
			description: "View content daemon logs",
			usage: "ck content logs [--tail]",
			examples: [],
			optionGroups: [],
		},
		{
			name: "setup",
			description: "Interactive configuration wizard",
			usage: "ck content setup",
			examples: [],
			optionGroups: [],
		},
		{
			name: "queue",
			description: "List pending content items",
			usage: "ck content queue",
			examples: [],
			optionGroups: [],
		},
		{
			name: "approve",
			description: "Approve a content item for publishing",
			usage: "ck content approve <id>",
			examples: [],
			optionGroups: [],
		},
		{
			name: "reject",
			description: "Reject a content item",
			usage: "ck content reject <id> [--reason <reason>]",
			examples: [],
			optionGroups: [],
		},
	],
	sections: [
		{
			title: "Notes",
			content:
				"Requires content config in .ck.json. Run 'ck content setup' for guided configuration. Review mode can be 'auto' or 'manual' (default: manual).",
		},
	],
};
