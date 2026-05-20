import type { CommandHelp } from "../help-types.js";

export const backupsCommandHelp: CommandHelp = {
	name: "backups",
	description: "List, restore, and prune ClaudeKit recovery backups",
	usage: "ck backups <list|restore|prune> [options]",
	examples: [
		{
			command: "ck backups list --limit 5",
			description: "Show the newest five recovery backups",
		},
		{
			command: "ck backups restore 2026-04-06T21-53-01-706-byrf --yes",
			description: "Restore a specific recovery backup without prompting",
		},
	],
	optionGroups: [
		{
			title: "Subcommands",
			options: [
				{
					flags: "list [--limit <n>] [--json]",
					description: "List recovery backups under ~/.claudekit/backups/",
				},
				{
					flags: "restore <id> [--yes] [--json]",
					description: "Restore a specific recovery backup to its original source root",
				},
				{
					flags: "prune [id] [--keep <n> | --all] [--yes] [--json]",
					description: "Delete one, many, or old recovery backups",
				},
			],
		},
		{
			title: "Shared Options",
			options: [
				{ flags: "--limit <n>", description: "Show only the newest N backups" },
				{ flags: "--keep <n>", description: "Keep the newest N backups when pruning" },
				{ flags: "--all", description: "Delete all recovery backups" },
				{ flags: "-y, --yes", description: "Skip confirmation prompts" },
				{ flags: "--json", description: "Output machine-readable JSON" },
			],
		},
	],
	subcommands: [
		{
			name: "list",
			description: "List recovery backups under ~/.claudekit/backups/",
			usage: "ck backups list [--limit <n>] [--json]",
			examples: [],
			optionGroups: [],
		},
		{
			name: "restore",
			description: "Restore a specific recovery backup to its original source root",
			usage: "ck backups restore <id> [--yes] [--json]",
			examples: [],
			optionGroups: [],
		},
		{
			name: "prune",
			description: "Delete one, many, or old recovery backups",
			usage: "ck backups prune [id] [--keep <n> | --all] [--yes] [--json]",
			examples: [],
			optionGroups: [],
		},
	],
	sections: [
		{
			title: "Backup Scope",
			content:
				"These backups contain only the ClaudeKit-managed files targeted by destructive operations, not the full ~/.claude/ directory.",
		},
		{
			title: "Automatic Retention",
			content:
				"ClaudeKit keeps the newest recovery backups automatically and prunes older ones after successful destructive operations.",
		},
	],
};
