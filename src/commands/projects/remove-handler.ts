/**
 * Handler for `ck projects remove [alias]` command
 */

import { ProjectsRegistryManager } from "@/domains/claudekit-data/index.js";
import { logger } from "@/shared/logger.js";
import { confirm, intro, isCancel, log, outro, select } from "@/shared/safe-prompts.js";
import picocolors from "picocolors";
import type { ProjectsRemoveOptions } from "./types.js";

export async function handleRemove(
	aliasOrPath?: string,
	options?: ProjectsRemoveOptions,
): Promise<void> {
	logger.debug(`Removing project: ${aliasOrPath}, options: ${JSON.stringify(options)}`);

	intro("Remove Project");

	// If --id flag is provided, use it directly
	let identifier = aliasOrPath;
	if (options?.id) {
		identifier = options.id;
	}

	// If no identifier provided, show selection prompt
	if (!identifier) {
		const projects = await ProjectsRegistryManager.listProjects();

		if (projects.length === 0) {
			log.warn("No projects registered");
			console.log();
			return;
		}

		const selected = await select({
			message: "Select a project to remove",
			options: projects.map((p) => ({
				value: p.id,
				label: `${picocolors.cyan(p.alias)} ${picocolors.dim(`(${p.path})`)}`,
			})),
		});

		if (isCancel(selected)) {
			log.warn("Operation cancelled");
			console.log();
			return;
		}

		identifier = selected as string;
	}

	// Get project details
	const project = await ProjectsRegistryManager.getProject(identifier);
	if (!project) {
		log.error(`Project not found: ${identifier}`);
		process.exitCode = 1;
		return;
	}

	// Confirm removal
	console.log();
	console.log(picocolors.dim("  Project to remove:"));
	console.log(picocolors.dim(`    Alias: ${picocolors.cyan(project.alias)}`));
	console.log(picocolors.dim(`    Path:  ${project.path}`));
	console.log(picocolors.dim(`    ID:    ${project.id}`));
	console.log();

	const confirmed = await confirm({
		message: "Are you sure you want to remove this project?",
		initialValue: false,
	});

	if (isCancel(confirmed) || !confirmed) {
		log.warn("Operation cancelled");
		console.log();
		return;
	}

	// Remove from registry
	try {
		const removed = await ProjectsRegistryManager.removeProject(identifier);

		if (removed) {
			log.success(`Project removed: ${project.alias}`);
			outro("Done!");
		} else {
			log.error("Failed to remove project");
			process.exitCode = 1;
		}
	} catch (error) {
		log.error(
			`Failed to remove project: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
		process.exitCode = 1;
	}
}
