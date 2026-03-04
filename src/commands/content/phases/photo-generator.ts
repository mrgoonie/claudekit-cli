/**
 * Generate social media photos via Claude CLI.
 * Spawns Claude with a photo prompt and resolves the output image path.
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ContentConfig, Platform } from "../types.js";
import type { ContentLogger } from "./content-logger.js";
import type { ContentContext } from "./context-builder.js";
import type { GeneratedContent } from "./output-parser.js";
import { parseClaudeJsonOutput } from "./output-parser.js";
import { buildPhotoPrompt } from "./prompt-templates.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PhotoResult {
	path: string;
	width: number;
	height: number;
	format: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Invoke Claude CLI to generate a photo for the given content item.
 * Returns null if generation fails or produces no image file.
 */
export async function generatePhoto(
	_content: GeneratedContent,
	context: ContentContext,
	config: ContentConfig,
	platform: Platform,
	contentId: number,
	contentLogger: ContentLogger,
): Promise<PhotoResult | null> {
	const mediaDir = join(config.contentDir.replace(/^~/, homedir()), "media", String(contentId));
	if (!existsSync(mediaDir)) {
		mkdirSync(mediaDir, { recursive: true });
	}

	const prompt = buildPhotoPrompt(context, platform);
	const dimensions =
		platform === "facebook" ? { width: 1200, height: 630 } : { width: 1200, height: 675 };

	try {
		contentLogger.debug(`Generating photo for content ${contentId}...`);

		const result = execSync("claude -p --output-format text --max-turns 20", {
			input: prompt,
			stdio: ["pipe", "pipe", "pipe"],
			timeout: 600000,
			cwd: mediaDir,
		})
			.toString()
			.trim();

		// Try to extract an explicit imagePath from Claude's JSON response
		const parsed = parseClaudeJsonOutput(result);
		if (
			parsed &&
			typeof parsed === "object" &&
			"imagePath" in (parsed as Record<string, unknown>)
		) {
			const imagePath = String((parsed as Record<string, unknown>).imagePath);
			if (existsSync(imagePath)) {
				return { path: imagePath, ...dimensions, format: "png" };
			}
		}

		// Fall back: scan the media directory for any image file Claude created
		const files = readdirSync(mediaDir);
		const imageFile = files.find((f) => /\.(png|jpg|jpeg|webp)$/i.test(f));
		if (imageFile) {
			const ext = imageFile.split(".").pop() ?? "png";
			return { path: join(mediaDir, imageFile), ...dimensions, format: ext };
		}

		contentLogger.warn(`Photo generation produced no image for content ${contentId}`);
		return null;
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		contentLogger.error(`Photo generation failed for content ${contentId}: ${msg}`);
		return null;
	}
}
