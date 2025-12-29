/**
 * Uninstall Command Help
 *
 * Help definition for the 'uninstall' command.
 */

import type { CommandHelp } from "../help-types.js";

export const uninstallCommandHelp: CommandHelp = {
	name: "uninstall",
	description: "Remove ClaudeKit installations (ownership-aware)",
	usage: "ck uninstall [options]",
	examples: [
		{
			command: "ck uninstall --local --yes",
			description: "Remove local installation without confirmation",
		},
		{
			command: "ck uninstall --dry-run",
			description: "Preview what would be removed without deleting",
		},
	],
	optionGroups: [
		{
			title: "Scope Options",
			options: [
				{
					flags: "-l, --local",
					description: "Uninstall only local installation (current project)",
				},
				{
					flags: "-g, --global",
					description: "Uninstall only global installation (~/.claude/)",
				},
				{
					flags: "-A, --all",
					description: "Uninstall from both local and global locations",
				},
				{
					flags: "-k, --kit <type>",
					description: "Uninstall specific kit only (engineer, marketing)",
				},
			],
		},
		{
			title: "Safety Options",
			options: [
				{
					flags: "--dry-run",
					description: "Preview what would be removed without deleting",
				},
				{
					flags: "--force-overwrite",
					description: "Delete even user-modified files (requires confirmation)",
				},
				{
					flags: "-y, --yes",
					description: "Skip confirmation prompt",
				},
			],
		},
	],
	sections: [
		{
			title: "Ownership-Aware Uninstall",
			content:
				"Uninstall preserves user customizations by default. Only CK-installed files that haven't been modified are removed. User-created files and modified files are preserved unless --force-overwrite is used.",
		},
	],
};
