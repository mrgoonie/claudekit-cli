/**
 * Setup Command Help
 *
 * Help definition for the 'setup' command.
 */

import type { CommandHelp } from "../help-types.js";

export const setupCommandHelp: CommandHelp = {
	name: "setup",
	description: "Run guided setup for API keys and optional packages",
	usage: "ck setup [options]",
	examples: [
		{
			command: "ck setup",
			description: "Run setup wizard in current project",
		},
		{
			command: "ck setup --global --skip-packages",
			description: "Configure global setup without package installation",
		},
	],
	optionGroups: [
		{
			title: "Options",
			options: [
				{
					flags: "--global",
					description: "Configure in global Claude directory (~/.claude/)",
				},
				{
					flags: "--skip-packages",
					description: "Skip optional package installation",
				},
				{
					flags: "--dir <dir>",
					description: "Target directory for setup",
					defaultValue: "current directory",
				},
			],
		},
	],
};
