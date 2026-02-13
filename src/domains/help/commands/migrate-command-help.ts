/**
 * Migrate Command Help
 *
 * Help definition for the 'migrate' command.
 */

import type { CommandHelp } from "../help-types.js";

export const migrateCommandHelp: CommandHelp = {
	name: "migrate",
	description: "Migrate agents, commands, skills, config, and rules to other providers",
	usage: "ck migrate [options]",
	examples: [
		{
			command: "ck migrate --agent codex --agent opencode",
			description: "Migrate all supported content to selected providers",
		},
		{
			command: "ck migrate --config --source ./CLAUDE.md",
			description: "Migrate only config from a specific source file",
		},
	],
	optionGroups: [
		{
			title: "Target Options",
			options: [
				{
					flags: "-a, --agent <provider>",
					description: "Target provider(s), can be specified multiple times",
				},
				{
					flags: "--all",
					description: "Migrate to all supported providers",
				},
				{
					flags: "-g, --global",
					description: "Install globally instead of project-level",
				},
				{
					flags: "-y, --yes",
					description: "Skip confirmation prompts",
				},
			],
		},
		{
			title: "Content Selection",
			options: [
				{
					flags: "--config",
					description: "Migrate CLAUDE.md config only",
				},
				{
					flags: "--rules",
					description: "Migrate .claude/rules only",
				},
				{
					flags: "--skip-config",
					description: "Skip config migration",
				},
				{
					flags: "--skip-rules",
					description: "Skip rules migration",
				},
				{
					flags: "--source <path>",
					description: "Custom CLAUDE.md source path",
				},
			],
		},
	],
};
