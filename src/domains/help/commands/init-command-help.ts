/**
 * Init Command Help
 *
 * Help definition for the 'init' command.
 */

import type { CommandHelp } from "../help-types.js";
import { folderOptionsGroup } from "./common-options.js";

export const initCommandHelp: CommandHelp = {
	name: "init",
	description: "Initialize or update ClaudeKit project (with interactive version selection)",
	usage: "ck init [options]",
	examples: [
		{
			command: "ck init --kit engineer",
			description: "Update local project with latest engineer kit",
		},
		{
			command: "ck init -y",
			description: "Non-interactive mode with sensible defaults (kit: engineer, dir: .)",
		},
	],
	optionGroups: [
		{
			title: "Mode Options",
			options: [
				{
					flags: "-y, --yes",
					description:
						"Non-interactive mode with sensible defaults (kit: engineer, dir: ., version: latest)",
				},
			],
		},
		{
			title: "Project Options",
			options: [
				{
					flags: "--dir <directory>",
					description: "Target directory to initialize/update",
					defaultValue: ".",
				},
				{
					flags: "--kit <kit>",
					description: "Kit to use (engineer, marketing)",
				},
				{
					flags: "-r, --release <version>",
					description: "Skip version selection, use specific version",
				},
				{
					flags: "-g, --global",
					description: "Use platform-specific user configuration directory",
				},
				{
					flags: "--fresh",
					description:
						"Completely remove .claude directory before downloading (requires confirmation)",
				},
			],
		},
		{
			title: "Filter Options",
			options: [
				{
					flags: "--exclude <pattern>",
					description: "Exclude files matching glob pattern (can be used multiple times)",
				},
				{
					flags: "--only <pattern>",
					description: "Include only files matching glob pattern (can be used multiple times)",
				},
				{
					flags: "--beta",
					description: "Show beta versions in selection prompt",
				},
				{
					flags: "--refresh",
					description: "Bypass release cache to fetch latest versions from GitHub",
				},
			],
		},
		{
			title: "Installation Options",
			options: [
				{
					flags: "--install-skills",
					description: "Install skills dependencies (non-interactive mode)",
				},
				{
					flags: "--prefix",
					description: "Add /ck: prefix to all slash commands",
				},
				{
					flags: "--dry-run",
					description: "Preview changes without applying them (requires --prefix)",
				},
				{
					flags: "--force-overwrite",
					description: "Override ownership protections and delete user-modified files",
				},
			],
		},
		folderOptionsGroup,
	],
};
