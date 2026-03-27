/**
 * Projects command orchestrator - routes to appropriate handler
 */

import type { cac } from "cac";
import { handleAdd } from "./add-handler.js";
import { handleList } from "./list-handler.js";
import { handleRemove } from "./remove-handler.js";
import type { ProjectsAddOptions, ProjectsListOptions, ProjectsRemoveOptions } from "./types.js";

export function registerProjectsCommand(cli: ReturnType<typeof cac>): void {
	// Projects list subcommand
	cli
		.command("projects list", "List all registered projects")
		.alias("projects ls")
		.option("--json", "Output in JSON format")
		.option("--pinned", "Show only pinned projects")
		.action(async (options: ProjectsListOptions) => {
			await handleList(options);
		});

	// Projects add subcommand
	cli
		.command("projects add <path>", "Add a project to the registry")
		.option("--alias <alias>", "Custom alias for the project")
		.option("--pinned", "Pin this project")
		.option("--tags <tags>", "Comma-separated list of tags")
		.action(async (path: string, options: ProjectsAddOptions) => {
			await handleAdd(path, options);
		});

	// Projects remove subcommand
	cli
		.command("projects remove [alias]", "Remove a project from the registry")
		.alias("projects rm")
		.option("--id <id>", "Remove by project ID")
		.action(async (alias: string | undefined, options: ProjectsRemoveOptions) => {
			await handleRemove(alias, options);
		});
}
