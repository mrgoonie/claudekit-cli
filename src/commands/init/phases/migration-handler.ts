/**
 * Skills migration phase
 * Handles skills directory migration detection and execution
 */

import { join } from "node:path";
import { SkillsMigrationDetector } from "@/domains/skills/skills-detector.js";
import { SkillsMigrator } from "@/domains/skills/skills-migrator.js";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
import { pathExists } from "fs-extra";
import type { InitContext } from "../types.js";

/**
 * Detect and perform skills migration if needed
 */
export async function handleMigration(ctx: InitContext): Promise<InitContext> {
	if (ctx.cancelled || !ctx.extractDir || !ctx.resolvedDir) return ctx;

	// Skip if fresh installation
	if (ctx.options.fresh) {
		logger.debug("Skipping skills migration (fresh installation)");
		return ctx;
	}

	// Archive always contains .claude/ directory
	const newSkillsDir = join(ctx.extractDir, ".claude", "skills");
	// Current skills location differs between global and local mode
	const currentSkillsDir = PathResolver.buildSkillsPath(ctx.resolvedDir, ctx.options.global);

	if (!(await pathExists(newSkillsDir)) || !(await pathExists(currentSkillsDir))) {
		return ctx;
	}

	logger.info("Checking for skills directory migration...");

	const migrationDetection = await SkillsMigrationDetector.detectMigration(
		newSkillsDir,
		currentSkillsDir,
	);

	if (migrationDetection.status === "recommended" || migrationDetection.status === "required") {
		logger.info("Skills migration detected");

		const migrationResult = await SkillsMigrator.migrate(newSkillsDir, currentSkillsDir, {
			interactive: !ctx.isNonInteractive,
			backup: true,
			dryRun: false,
		});

		if (!migrationResult.success) {
			logger.warning("Skills migration encountered errors but continuing with update");
		}
	} else {
		logger.debug("No skills migration needed");
	}

	return ctx;
}
