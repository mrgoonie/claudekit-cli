/**
 * Versions Command Help
 *
 * Help definition for the 'versions' command.
 */

import type { CommandHelp } from "../help-types.js";

export const versionsCommandHelp: CommandHelp = {
	name: "versions",
	description: "List available versions of ClaudeKit repositories",
	usage: "ck versions [options]",
	examples: [
		{
			command: "ck versions --kit engineer --limit 10",
			description: "Show latest 10 versions of engineer kit",
		},
		{
			command: "ck versions --all",
			description: "Show all releases including prereleases",
		},
	],
	optionGroups: [
		{
			title: "Filter Options",
			options: [
				{
					flags: "--kit <kit>",
					description: "Filter by specific kit (engineer, marketing)",
				},
				{
					flags: "--limit <number>",
					description: "Number of releases to show",
					defaultValue: "30",
				},
				{
					flags: "--all",
					description: "Show all releases including prereleases",
				},
			],
		},
	],
};
