/**
 * Handler for `ck projects list` command
 */

import { ProjectsRegistryManager } from "@/domains/claudekit-data/index.js";
import { logger } from "@/shared/logger.js";
import picocolors from "picocolors";
import type { ProjectsListOptions } from "./types.js";

export async function handleList(options: ProjectsListOptions): Promise<void> {
	logger.debug(`Listing projects: ${JSON.stringify(options)}`);

	const projects = await ProjectsRegistryManager.listProjects({
		pinned: options.pinned,
	});

	if (options.json) {
		console.log(JSON.stringify(projects, null, 2));
		return;
	}

	if (projects.length === 0) {
		console.log();
		console.log(picocolors.yellow("No projects registered yet."));
		console.log();
		console.log(picocolors.dim("  Add a project with:"));
		console.log(picocolors.dim("    ck projects add <path>"));
		console.log();
		return;
	}

	console.log();
	console.log(picocolors.bold(`Registered Projects (${projects.length})`));
	console.log();

	// Calculate column widths
	const aliasWidth = Math.max(5, ...projects.map((p) => p.alias.length));
	const pathWidth = Math.max(4, ...projects.map((p) => p.path.length));

	// Header
	console.log(
		picocolors.dim(`  ${"ALIAS".padEnd(aliasWidth)}  ${"PATH".padEnd(pathWidth)}  PINNED  TAGS`),
	);
	console.log(picocolors.dim(`  ${"-".repeat(aliasWidth + pathWidth + 20)}`));

	// Rows
	for (const project of projects) {
		const alias = picocolors.cyan(project.alias.padEnd(aliasWidth));
		const path = picocolors.dim(project.path.padEnd(pathWidth));
		const pinned = project.pinned ? picocolors.yellow("📌") : "  ";
		const tags = project.tags?.length
			? picocolors.gray(project.tags.join(", "))
			: picocolors.dim("-");

		console.log(`  ${alias}  ${path}  ${pinned}      ${tags}`);
	}

	console.log();
}
