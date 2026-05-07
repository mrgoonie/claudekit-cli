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
					flags: "--full",
					description: "Include extended priority checks (slower but more thorough)",
				},
				{
					flags: "--json",
					description: "Output JSON format",
				},
			],
		},
	],
	sections: [
		{
			title: "Engineer skill budget checks",
			content:
				"`ck doctor` validates Claude Code skill listing defaults for Engineer Kit projects, reports over-cap descriptions, detects duplicate project/global skill names, and warns when project skills are explicitly not user-invocable. `ck doctor --fix` only merges safe project settings defaults: `skillListingBudgetFraction: 0.03` and `skillListingMaxDescChars: 512`.",
		},
	],
};
