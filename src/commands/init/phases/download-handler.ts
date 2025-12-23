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
	if (ctx.cancelled || !ctx.release || !ctx.kit) return ctx;

	const result = await downloadAndExtract({
		release: ctx.release,
		kit: ctx.kit,
		exclude: ctx.options.exclude,
	});

	return {
		...ctx,
		tempDir: result.tempDir,
		archivePath: result.archivePath,
		extractDir: result.extractDir,
	};
}
