/**
 * Agents Command Help
 *
 * Help definition for the 'agents' command.
 */

import type { CommandHelp } from "../help-types.js";

export const agentsCommandHelp: CommandHelp = {
	name: "agents",
	description: "Install, uninstall, and manage Claude Code agents across providers",
	usage: "ck agents [options]",
	examples: [
		{
			command: "ck agents --name maintainer --agent codex",
			description: "Install one agent to Codex",
		},
		{
			command: "ck agents --list --installed",
			description: "Show installed agents and locations",
		},
	],
	optionGroups: [
		{
			title: "Mode Options",
			options: [
				{
					flags: "-l, --list",
					description: "List available agents from source",
				},
				{
					flags: "--installed",
					description: "When used with --list, show installed agents instead",
				},
				{
					flags: "-u, --uninstall",
					description: "Uninstall agent(s) from providers",
				},
				{
					flags: "--sync",
					description: "Sync registry with filesystem (clean orphaned entries)",
				},
			],
		},
		{
			title: "Installation Options",
			options: [
				{
					flags: "-n, --name <agent>",
					description: "Agent name to install or uninstall",
				},
				{
					flags: "-a, --agent <provider>",
					description: "Target provider(s), can be specified multiple times",
				},
				{
					flags: "-g, --global",
					description: "Install globally instead of project-level",
				},
				{
					flags: "--all",
					description: "Install to all supported providers",
				},
				{
					flags: "-y, --yes",
					description: "Skip confirmation prompts",
				},
			],
		},
		{
			title: "Uninstall Options",
			options: [
				{
					flags: "--force",
					description: "Force uninstall even if not tracked in registry",
				},
			],
		},
	],
};
