/**
 * Plan Command Help
 *
 * Help definition for the 'plan' command and its 8 subcommands.
 * Source of truth for flags: src/cli/command-registry.ts lines 382-405.
 */

import type { CommandHelp } from "../help-types.js";

export const planCommandHelp: CommandHelp = {
	name: "plan",
	description:
		"Plan management: parse, validate, status, kanban, create, check, uncheck, add-phase",
	usage: "ck plan [action] [target] [options]",
	examples: [
		{
			command: "ck plan status",
			description: "Show progress summary for all plans in the current project",
		},
		{
			command: "ck plan create --title 'Auth feature' --phases setup,api,ui",
			description: "Scaffold a new plan directory with three phases",
		},
	],
	optionGroups: [
		{
			title: "Output Options",
			options: [
				{ flags: "--json", description: "Output in JSON format" },
				{ flags: "--strict", description: "Strict validation mode (validate action)" },
			],
		},
		{
			title: "Scope Options",
			options: [
				{
					flags: "-g, --global",
					description: "Use global plans scope (~/.claude/plans or configured global root)",
				},
			],
		},
	],
	subcommands: [
		{
			name: "parse",
			description: "Parse a plan.md and output an ASCII table or JSON of all phases",
			usage: "ck plan parse [target] [--json]",
			examples: [],
			optionGroups: [
				{
					title: "Output Options",
					options: [{ flags: "--json", description: "Output machine-readable JSON" }],
				},
			],
		},
		{
			name: "validate",
			description: "Validate plan.md syntax and structure",
			usage: "ck plan validate [target] [--strict] [--json]",
			examples: [],
			optionGroups: [
				{
					title: "Validation Options",
					options: [
						{ flags: "--strict", description: "Fail on warnings in addition to errors" },
						{ flags: "--json", description: "Output results as JSON" },
					],
				},
			],
		},
		{
			name: "status",
			description: "Show progress for plans in scope",
			usage: "ck plan status [--json] [-g]",
			examples: [],
			optionGroups: [
				{
					title: "Output Options",
					options: [{ flags: "--json", description: "Output in JSON format" }],
				},
				{
					title: "Scope Options",
					options: [{ flags: "-g, --global", description: "Show status for global plans scope" }],
				},
			],
		},
		{
			name: "kanban",
			description: "Launch interactive Kanban dashboard in the browser",
			usage: "ck plan kanban [--port <port>] [--no-open] [--dev]",
			examples: [],
			optionGroups: [
				{
					title: "Dashboard Options",
					options: [
						{ flags: "--port <port>", description: "Port to serve the Kanban dashboard on" },
						{ flags: "--no-open", description: "Do not auto-open the browser" },
						{ flags: "--dev", description: "Start dashboard in development mode" },
					],
				},
			],
		},
		{
			name: "create",
			description: "Scaffold a new plan directory with phase files",
			usage: "ck plan create [--title <title>] [--phases <phases>] [options]",
			examples: [],
			optionGroups: [
				{
					title: "Create Options",
					options: [
						{ flags: "--title <title>", description: "Plan title" },
						{
							flags: "--phases <phases>",
							description: "Comma-separated list of phase names",
						},
						{ flags: "--dir <dir>", description: "Plan output directory" },
						{
							flags: "--priority <priority>",
							description: "Priority level: P1, P2, or P3",
						},
						{ flags: "--issue <issue>", description: "GitHub issue number to link" },
						{
							flags: "--source <source>",
							description: "Creation source: skill | cli | dashboard",
						},
						{
							flags: "--session-id <id>",
							description: "Claude session ID for tracking",
						},
					],
				},
				{
					title: "Scope Options",
					options: [{ flags: "-g, --global", description: "Create plan in global plans scope" }],
				},
			],
		},
		{
			name: "check",
			description: "Mark a phase as completed (or in-progress with --start)",
			usage: "ck plan check <id> [--start]",
			examples: [],
			optionGroups: [
				{
					title: "Check Options",
					options: [
						{
							flags: "--start",
							description: "Mark phase as in-progress instead of completed",
						},
					],
				},
			],
		},
		{
			name: "uncheck",
			description: "Reset a phase back to pending status",
			usage: "ck plan uncheck <id>",
			examples: [],
			optionGroups: [],
		},
		{
			name: "add-phase",
			description: "Append a new phase to an existing plan",
			usage: "ck plan add-phase [target] [--after <id>]",
			examples: [],
			optionGroups: [
				{
					title: "Phase Options",
					options: [
						{
							flags: "--after <after>",
							description: "Insert the new phase after this phase ID",
						},
					],
				},
			],
		},
	],
};
