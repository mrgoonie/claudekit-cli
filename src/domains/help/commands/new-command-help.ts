/**
 * New Command Help
 *
 * Help definition for the 'new' command.
 */

import type { CommandHelp } from "../help-types.js";
import { filterOptionsGroup, folderOptionsGroup } from "./common-options.js";

export const newCommandHelp: CommandHelp = {
	name: "new",
	description: "Bootstrap a new ClaudeKit project (with interactive version selection)",
	usage: "ck new [options]",
	examples: [
		{
			command: "ck new --kit engineer --dir ./my-project",
			description: "Create engineer kit project in specific directory",
		},
		{
			command: "ck new --beta --install-skills",
			description: "Create project with beta version and install skills dependencies",
		},
	],
	optionGroups: [
		{
			title: "Project Options",
			options: [
				{
					flags: "--dir <directory>",
					description: "Target directory for the new project",
					defaultValue: ".",
				},
				{
					flags: "--kit <kit>",
					description: "Kit to use (engineer, marketing)",
				},
				{
					flags: "-r, --release <version>",
					description: "Skip version selection, use specific version (e.g., latest, v1.0.0)",
				},
				{
					flags: "--force",
					description: "Overwrite existing files without confirmation",
				},
			],
		},
		filterOptionsGroup,
		{
			title: "Installation Options",
			options: [
				{
					flags: "--opencode",
					description: "Install OpenCode CLI package (non-interactive mode)",
				},
				{
					flags: "--gemini",
					description: "Install Google Gemini CLI package (non-interactive mode)",
				},
				{
					flags: "--install-skills",
					description: "Install skills dependencies (non-interactive mode)",
				},
				{
					flags: "--prefix",
					description: "Add /ck: prefix to all slash commands",
				},
			],
		},
		folderOptionsGroup,
	],
};
