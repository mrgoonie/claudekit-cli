/**
 * Migrate Command Help
 *
 * Help definition for the 'migrate' command.
 */

import type { CommandHelp } from "../help-types.js";

export const migrateCommandHelp: CommandHelp = {
	name: "migrate",
	description: "Migrate agents, commands, skills, config, rules, and hooks to other providers",
	usage: "ck migrate [options]",
	examples: [
		{
			command: "ck migrate --agent droid --agent codex",
			description: "Migrate to specific providers",
		},
		{
			command: "ck migrate --all --global",
			description: "Migrate globally to all supported providers",
		},
		{
			command: "ck migrate --dry-run",
			description: "Preview migration plan without writing files",
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
				{
					flags: "-f, --force",
					description: "Force reinstall deleted/edited items",
				},
				{
					flags: "--dry-run",
					description: "Preview plan without writing files",
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
					flags: "--hooks",
					description: "Migrate .claude/hooks only",
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
					flags: "--skip-hooks",
					description: "Skip hooks migration",
				},
				{
					flags: "--source <path>",
					description: "Custom CLAUDE.md source path",
				},
			],
		},
	],
};
