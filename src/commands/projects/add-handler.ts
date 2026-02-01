/**
 * Handler for `ck projects add <path>` command
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { ProjectsRegistryManager } from "@/domains/claudekit-data/index.js";
import { logger } from "@/shared/logger.js";
import { intro, log, outro } from "@/shared/safe-prompts.js";
import picocolors from "picocolors";
import type { ProjectsAddOptions } from "./types.js";

export async function handleAdd(projectPath: string, options: ProjectsAddOptions): Promise<void> {
	logger.debug(`Adding project: ${projectPath}, options: ${JSON.stringify(options)}`);

	intro("Add Project");

	// Resolve path
	const absolutePath = resolve(projectPath);

	// Validate path exists
	if (!existsSync(absolutePath)) {
		log.error(`Path does not exist: ${absolutePath}`);
		process.exitCode = 1;
		return;
	}

	// Check if already registered
	const isRegistered = await ProjectsRegistryManager.isRegistered(absolutePath);
	if (isRegistered) {
		log.warn(`Project already registered: ${absolutePath}`);
		const existing = await ProjectsRegistryManager.getProject(absolutePath);
		if (existing) {
			console.log();
			console.log(picocolors.dim("  Existing registration:"));
			console.log(picocolors.dim(`    Alias: ${picocolors.cyan(existing.alias)}`));
			console.log(picocolors.dim(`    Path:  ${existing.path}`));
			console.log(picocolors.dim(`    ID:    ${existing.id}`));
			console.log();
		}
		process.exitCode = 1;
		return;
	}

	// Parse tags from comma-separated string
	const tags = options.tags
		? options.tags
				.split(",")
				.map((t) => t.trim())
				.filter((t) => t.length > 0)
		: undefined;

	// Add to registry
	try {
		const project = await ProjectsRegistryManager.addProject(absolutePath, {
			alias: options.alias,
			pinned: options.pinned,
			tags,
		});

		log.success("Project registered successfully");
		console.log();
		console.log(picocolors.dim("  Details:"));
		console.log(picocolors.dim(`    Alias:  ${picocolors.cyan(project.alias)}`));
		console.log(picocolors.dim(`    Path:   ${project.path}`));
		console.log(picocolors.dim(`    ID:     ${project.id}`));
		if (project.pinned) {
			console.log(picocolors.dim(`    Pinned: ${picocolors.yellow("Yes")}`));
		}
		if (project.tags?.length) {
			console.log(picocolors.dim(`    Tags:   ${project.tags.join(", ")}`));
		}
		console.log();

		outro("Done!");
	} catch (error) {
		log.error(`Failed to add project: ${error instanceof Error ? error.message : "Unknown error"}`);
		process.exitCode = 1;
	}
}
