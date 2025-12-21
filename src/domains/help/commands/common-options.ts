/**
 * Common Options
 *
 * Shared option groups used across multiple command help definitions.
 */

import type { OptionGroup } from "../help-types.js";

/**
 * Project options group (shared between new and init commands)
 */
export const projectOptionsGroup: OptionGroup = {
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
	],
};

/**
 * Filter options group (shared between new and init commands)
 */
export const filterOptionsGroup: OptionGroup = {
	title: "Filter Options",
	options: [
		{
			flags: "--exclude <pattern>",
			description: "Exclude files matching glob pattern (can be used multiple times)",
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
};

/**
 * Folder options group (shared between new and init commands)
 */
export const folderOptionsGroup: OptionGroup = {
	title: "Folder Options",
	options: [
		{
			flags: "--docs-dir <name>",
			description: "Custom docs folder name to avoid conflicts with existing folders",
			defaultValue: "docs",
		},
		{
			flags: "--plans-dir <name>",
			description: "Custom plans folder name to avoid conflicts with existing folders",
			defaultValue: "plans",
		},
	],
};
