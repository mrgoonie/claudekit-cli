/**
 * OpenCode directory handling phase
 * Relocates .opencode/ to correct global path during global installation
 */

import { cp, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { transformPathsForGlobalOpenCode } from "@/services/transformers/opencode-path-transformer.js";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
import { ensureDir, pathExists } from "fs-extra";
import type { InitContext } from "../types.js";

/**
 * Handle .opencode directory during installation
 * - Global mode: relocate to ~/.config/opencode/ (Unix) or %APPDATA%\opencode\ (Windows)
 * - Local mode: keep at project root (no action)
 */
export async function handleOpenCode(ctx: InitContext): Promise<InitContext> {
	if (ctx.cancelled || !ctx.extractDir || !ctx.resolvedDir) {
		return ctx;
	}

	const openCodeSource = join(ctx.extractDir, ".opencode");

	// Check if .opencode exists in extracted archive
	if (!(await pathExists(openCodeSource))) {
		logger.debug("No .opencode directory in archive, skipping");
		return ctx;
	}

	logger.info("Processing .opencode configuration...");

	if (ctx.options.global) {
		// Global mode: relocate to platform global path
		const targetDir = PathResolver.getOpenCodeDir(true);

		logger.verbose(`Relocating .opencode to ${targetDir}`);

		// Transform paths in .opencode files before relocation
		const transformResult = await transformPathsForGlobalOpenCode(openCodeSource, {
			verbose: logger.isVerbose(),
		});

		if (transformResult.totalChanges > 0) {
			logger.success(
				`Transformed ${transformResult.totalChanges} OpenCode path(s) in ${transformResult.filesTransformed} file(s)`,
			);
		}

		// Ensure target directory exists
		await ensureDir(targetDir);

		// Copy contents (not the .opencode folder itself)
		const entries = await readdir(openCodeSource, { withFileTypes: true });
		for (const entry of entries) {
			const sourcePath = join(openCodeSource, entry.name);
			const targetPath = join(targetDir, entry.name);

			// Skip if target exists and we're not force overwriting
			if (await pathExists(targetPath)) {
				if (!ctx.options.forceOverwrite) {
					logger.verbose(`Skipping existing: ${entry.name}`);
					continue;
				}
			}

			await cp(sourcePath, targetPath, { recursive: true });
			logger.verbose(`Copied: ${entry.name}`);
		}

		// Remove .opencode from extract dir so it's not merged again
		await rm(openCodeSource, { recursive: true, force: true });

		logger.success(`OpenCode config installed to ${targetDir}`);
	} else {
		// Local mode: .opencode stays at project root
		// The merge handler will copy it naturally
		logger.debug("Local mode: .opencode will be placed at project root");
	}

	return ctx;
}
