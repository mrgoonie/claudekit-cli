/**
 * Config Command Help
 *
 * Help definition for the 'config' command.
 */

import type { CommandHelp } from "../help-types.js";

export const configCommandHelp: CommandHelp = {
	name: "config",
	description: "Manage ClaudeKit configuration",
	usage: "ck config <subcommand> [options]",
	examples: [
		{
			command: "ck config show",
			description: "Show all config with sources",
		},
		{
			command: "ck config set defaults.kit marketing --global",
			description: "Set global default kit",
		},
		{
			command: "ck config get defaults.kit",
			description: "Get a specific config value",
		},
		{
			command: "ck config validate",
			description: "Validate current configuration",
		},
	],
	optionGroups: [
		{
			title: "Subcommands",
			options: [
				{
					flags: "show",
					description: "Display all configuration with source badges",
				},
				{
					flags: "get <key>",
					description: "Get a specific config value",
				},
				{
					flags: "set <key> <value>",
					description: "Set a config value",
				},
				{
					flags: "unset <key>",
					description: "Remove a config value",
				},
				{
					flags: "reset [section]",
					description: "Reset config to defaults",
				},
				{
					flags: "schema",
					description: "Show configuration schema",
				},
				{
					flags: "validate",
					description: "Validate current configuration",
				},
				{
					flags: "preview",
					description: "Preview merged configuration",
				},
				{
					flags: "edit",
					description: "Open config in $EDITOR",
				},
				{
					flags: "ui",
					description: "Launch web dashboard (Phase 4)",
				},
			],
		},
		{
			title: "Options",
			options: [
				{
					flags: "--global, -g",
					description: "Use global config (~/.claudekit/config.json)",
				},
				{
					flags: "--json",
					description: "Output as JSON",
				},
				{
					flags: "--yes, -y",
					description: "Skip confirmation prompts",
				},
			],
		},
	],
};
