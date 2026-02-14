/**
 * Port Command Help
 *
 * Help definition for the 'port' command.
 */

import type { CommandHelp } from "../help-types.js";

export const portCommandHelp: CommandHelp = {
	name: "port",
	description: "Port agents, commands, skills, config, and rules to other providers",
	usage: "ck port [options]",
	examples: [
		{
			command: "ck port --agent codex --agent opencode",
			description: "Port all supported content to selected providers",
		},
		{
			command: "ck port --config --source ./CLAUDE.md",
			description: "Port only config from a specific source file",
		},
	],
	optionGroups: [
		{
			title: "Target Options",
			options: [
				{
					flags: "-a, --agent <provider>",
					description: "Target provider(s), can be specified multiple times",
				},
				{
					flags: "--all",
					description: "Port to all supported providers",
				},
				{
					flags: "-g, --global",
					description: "Install globally instead of project-level",
				},
				{
					flags: "-y, --yes",
					description: "Skip confirmation prompts",
				},
			],
		},
		{
			title: "Content Selection",
			options: [
				{
					flags: "--config",
					description: "Port CLAUDE.md config only",
				},
				{
					flags: "--rules",
					description: "Port .claude/rules only",
				},
				{
					flags: "--skip-config",
					description: "Skip config porting",
				},
				{
					flags: "--skip-rules",
					description: "Skip rules porting",
				},
				{
					flags: "--source <path>",
					description: "Custom CLAUDE.md source path",
				},
			],
		},
	],
};
