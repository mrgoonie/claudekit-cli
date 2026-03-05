/**
 * Skills Command Help
 *
 * Help definition for the 'skills' command.
 * Handles cross-agent skill distribution for 14 coding agents.
 */

import type { CommandHelp } from "../help-types.js";

export const skillsCommandHelp: CommandHelp = {
	name: "skills",
	description: "Install, uninstall, and manage ClaudeKit skills across coding agents",
	usage: "ck skills [options]",
	examples: [
		{
			command: "ck skills --name frontend-design --agent claude-code -g",
			description: "Install skill to Claude Code globally",
		},
		{
			command: "ck skills --list --installed",
			description: "Show all installed skills with their locations",
		},
	],
	optionGroups: [
		{
			title: "Mode Options",
			options: [
				{
					flags: "-l, --list",
					description: "List available skills from ClaudeKit source",
				},
				{
					flags: "--installed",
					description: "When used with --list, show installed skills instead",
				},
				{
					flags: "-u, --uninstall",
					description: "Uninstall skill(s) from agent(s)",
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
					flags: "-n, --name <skill>",
					description: "Skill name to install or uninstall",
				},
				{
					flags: "-a, --agent <agent>",
					description:
						"Target agent(s) - can be specified multiple times. Valid: claude-code, cursor, codex, opencode, goose, gemini-cli, antigravity, github-copilot, amp, kilo, roo, windsurf, cline, openhands",
				},
				{
					flags: "-g, --global",
					description: "Install to user's home directory (available across projects)",
				},
				{
					flags: "--all",
					description: "Install to all supported agents",
				},
				{
					flags: "-y, --yes",
					description: "Non-interactive mode (skip confirmations)",
				},
			],
		},
		{
			title: "Uninstall Options",
			options: [
				{
					flags: "-f, --force",
					description: "Force uninstall even if skill not in registry (requires --agent)",
				},
			],
		},
	],
	sections: [
		{
			title: "Supported Agents",
			content: `  claude-code     Claude Code CLI
  cursor          Cursor IDE
  codex           Codex CLI
  opencode        OpenCode
  goose           Goose AI
  gemini-cli      Gemini CLI
  antigravity     Antigravity Agent
  github-copilot  GitHub Copilot
  amp             Amp
  kilo            Kilo Code
  roo             Roo Code
  windsurf        Windsurf IDE
  cline           Cline
  openhands       OpenHands`,
		},
		{
			title: "Notes",
			content: `  • Skills are installed from ~/.claude/skills (ClaudeKit Engineer source)
  • Registry stored at ~/.claudekit/skill-registry.json
  • Project installs go to ./<agent>/skills, global to ~/<agent>/skills`,
		},
	],
};
