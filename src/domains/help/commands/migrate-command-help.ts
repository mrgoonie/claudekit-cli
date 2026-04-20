/**
 * Migrate Command Help
 *
 * Help definition for the 'migrate' command.
 */

import type { CommandHelp } from "../help-types.js";

export const migrateCommandHelp: CommandHelp = {
	name: "migrate",
	description:
		"Migrate Claude Code agents, commands, skills, config, rules, and hooks to other providers",
	usage: "ck migrate [options]",
	examples: [
		{
			command: "ck migrate --agent codex --dry-run",
			description: "Preview the destination-aware migration plan before writing files",
		},
		{
			command: "ck migrate --agent codex -g",
			description: "Write to Codex global paths such as ~/.codex/ and ~/.agents/skills",
		},
		{
			command: "CK_FORCE_ASCII=1 ck migrate --agent codex",
			description: "Force ASCII borders on legacy Windows terminals (cmd.exe, older PowerShell)",
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
					description: "Install globally instead of the default project-level scope",
				},
				{
					flags: "-y, --yes",
					description: "Skip confirmation prompts after the pre-flight summary",
				},
				{
					flags: "-f, --force",
					description: "Force reinstall deleted or edited managed items",
				},
				{
					flags: "--dry-run",
					description: "Preview plan, destinations, and next steps without writing files",
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
