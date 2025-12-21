/**
 * Doctor Command Help
 *
 * Help definition for the 'doctor' command.
 */

import type { CommandHelp } from "../help-types.js";

export const doctorCommandHelp: CommandHelp = {
	name: "doctor",
	description: "Comprehensive health check for ClaudeKit",
	usage: "ck doctor [options]",
	examples: [
		{
			command: "ck doctor",
			description: "Run full health check interactively",
		},
		{
			command: "ck doctor --fix",
			description: "Auto-fix all fixable issues",
		},
		{
			command: "ck doctor --check-only",
			description: "CI mode: exit 1 on failures, no prompts",
		},
	],
	optionGroups: [
		{
			title: "Options",
			options: [
				{
					flags: "--report",
					description: "Generate shareable diagnostic report",
				},
				{
					flags: "--fix",
					description: "Auto-fix all fixable issues",
				},
				{
					flags: "--check-only",
					description: "CI mode: no prompts, exit 1 on failures",
				},
				{
					flags: "--json",
					description: "Output JSON format",
				},
			],
		},
	],
};
