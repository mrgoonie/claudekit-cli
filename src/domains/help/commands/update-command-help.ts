/**
 * Update Command Help
 *
 * Help definition for the 'update' command.
 */

import type { CommandHelp } from "../help-types.js";

export const updateCommandHelp: CommandHelp = {
	name: "update",
	description: "Update ClaudeKit CLI to the latest version",
	usage: "ck update [options]",
	examples: [
		{
			command: "ck update --check",
			description: "Check for CLI updates without installing",
		},
		{
			command: "ck update --beta --yes",
			description: "Update to latest beta version without confirmation",
		},
	],
	optionGroups: [
		{
			title: "Update Options",
			options: [
				{
					flags: "-r, --release <version>",
					description: "Update to a specific version",
				},
				{
					flags: "--check",
					description: "Check for updates without installing",
				},
				{
					flags: "-y, --yes",
					description: "Skip confirmation prompt",
				},
				{
					flags: "--beta",
					description: "Update to the latest beta version",
				},
				{
					flags: "--registry <url>",
					description: "Custom npm registry URL",
				},
			],
		},
		{
			title: "Deprecated Options",
			options: [
				{
					flags: "--kit <kit>",
					description: "This option is no longer supported with 'ck update'",
					deprecated: {
						message: "Use 'ck init --kit <kit>' to update kit installations",
						alternative: "ck init --kit <kit>",
					},
				},
				{
					flags: "-g, --global",
					description: "This option is no longer supported with 'ck update'",
					deprecated: {
						message: "Use 'ck init --global' to update global kit",
						alternative: "ck init --global",
					},
				},
			],
		},
	],
	sections: [
		{
			title: "Note",
			content:
				"'ck update' now only updates the ClaudeKit CLI itself. To update a kit installation, use 'ck init'.",
		},
	],
};
