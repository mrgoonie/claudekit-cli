/**
 * Download and extraction phase
 * Handles archive download from GitHub and extraction to temp directory
 */

import { downloadAndExtract } from "@/domains/installation/download-extractor.js";
import type { InitContext } from "../types.js";

/**
 * Download and extract release archive
 */
export async function handleDownload(ctx: InitContext): Promise<InitContext> {
	// Skip if cancelled or missing kit
	if (ctx.cancelled || !ctx.kit) return ctx;

	// Release is required unless using offline methods (--archive or --kit-path)
	const usingOfflineMethod = ctx.options.archive || ctx.options.kitPath;
	if (!ctx.release && !usingOfflineMethod) return ctx;

	const result = await downloadAndExtract({
		release: ctx.release,
		kit: ctx.kit,
		exclude: ctx.options.exclude,
		useGit: ctx.options.useGit,
		isNonInteractive: ctx.isNonInteractive,
		archive: ctx.options.archive,
		kitPath: ctx.options.kitPath,
	});

	return {
		...ctx,
		tempDir: result.tempDir,
		archivePath: result.archivePath,
		extractDir: result.extractDir,
	};
}
