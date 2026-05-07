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
				"`ck doctor` validates Claude Code skill listing settings for Engineer Kit projects, estimates active project/global skill listing pressure against a 200k context floor, reports descriptions over ClaudeKit's 512-char recommended cap, detects duplicate project/global skill names, reports existing `skillOverrides`, and warns when active project/global skills are explicitly not user-invocable. `ck doctor --fix` ensures the computed `skillListingBudgetFraction` and normalizes missing, invalid, or too-high `skillListingMaxDescChars` values to 512.",
		},
	],
};
