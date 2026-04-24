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
			command: "ck migrate --install",
			description: "Pick items to install interactively (install picker mode)",
		},
		{
			command: "ck migrate --agent codex --dry-run",
			description: "Preview the destination-aware reconcile plan before writing files",
		},
		{
			command: "ck migrate --respect-deletions",
			description: "Preserve empty directories — do not auto-reinstall deleted items",
		},
	],
	optionGroups: [
		{
			title: "Mode Options",
			options: [
				{
					flags: "--install",
					description:
						"Opt-in install picker mode — interactively select which items to install (default when registry is empty or has unknown checksums)",
				},
				{
					flags: "--reconcile",
					description:
						"Force reconcile mode — compute diff vs registry and apply only changes (default when registry is valid)",
				},
				{
					flags: "--reinstall-empty-dirs",
					description:
						"Reinstall all items when their type directory is empty or missing (default: true). Use --respect-deletions to disable.",
				},
				{
					flags: "--respect-deletions",
					description:
						"Preserve deletion even when a type directory is empty — skip reinstall heuristic. Mutually exclusive with --reinstall-empty-dirs.",
				},
			],
		},
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
	sections: [
		{
			title: "Gotchas",
			content: [
				"  --install and --reconcile are mutually exclusive — pass only one",
				"  --reinstall-empty-dirs and --respect-deletions are mutually exclusive — pass only one",
				"  Default mode is smart-detected: no/stale registry → install, valid registry → reconcile",
				"  --respect-deletions disables the auto-reinstall heuristic for empty directories",
				"  --force overrides skip decisions per item; --reinstall-empty-dirs is a per-directory heuristic",
			].join("\n"),
		},
	],
};
