/**
 * Watch Command Help
 *
 * Help definition for the 'watch' command.
 */

import type { CommandHelp } from "../help-types.js";

export const watchCommandHelp: CommandHelp = {
	name: "watch",
	description: "Watch GitHub issues and auto-respond with AI analysis",
	usage: "ck watch [options]",
	examples: [
		{
			command: "ck watch --dry-run",
			description: "Preview issue detection without posting responses",
		},
		{
			command: "ck watch --interval 60000",
			description: "Poll every 60 seconds instead of default 30s",
		},
	],
	optionGroups: [
		{
			title: "Options",
			options: [
				{
					flags: "--interval <ms>",
					description: "Poll interval in milliseconds",
					defaultValue: "30000",
				},
				{
					flags: "--dry-run",
					description: "Detect issues without posting responses",
				},
				{
					flags: "--force",
					description: "Kill existing watch process and start fresh",
				},
				{
					flags: "--verbose",
					description: "Enable verbose logging",
				},
			],
		},
	],
};
