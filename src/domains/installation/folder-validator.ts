/**
 * Folder Validator
 * Validates local folder structure for ClaudeKit compatibility
 */

import { isAbsolute, join, resolve } from "node:path";
import { logger } from "@/shared/logger.js";
import { pathExists, readFile, stat } from "fs-extra";

export interface FolderValidationResult {
	valid: boolean;
	resolvedPath: string;
	version?: string;
	error?: string;
}

export class FolderValidator {
	/**
	 * Validate local folder for ClaudeKit structure
	 * Requirements:
	 * 1. Path must exist and be a directory
	 * 2. Must contain .claude directory
	 * 3. Must contain metadata.json
	 * 4. Must contain .release-manifest.json (for ownership tracking)
	 */
	static async validate(folderPath: string): Promise<FolderValidationResult> {
		// 1. Resolve to absolute path
		const resolvedPath = resolve(folderPath);

		// 2. Security: check for path traversal attempts
		if (folderPath.includes("..") && !isAbsolute(folderPath)) {
			return {
				valid: false,
				resolvedPath,
				error: "Path traversal not allowed. Use absolute path.",
			};
		}

		// 3. Check existence
		if (!(await pathExists(resolvedPath))) {
			return {
				valid: false,
				resolvedPath,
				error: `Folder does not exist: ${resolvedPath}`,
			};
		}

		// 4. Check it's a directory
		const stats = await stat(resolvedPath);
		if (!stats.isDirectory()) {
			return {
				valid: false,
				resolvedPath,
				error: `Path is not a directory: ${resolvedPath}`,
			};
		}

		// 5. Validate ClaudeKit structure - check for .claude directory
		const claudeDir = join(resolvedPath, ".claude");
		const hasClaudeDir = await pathExists(claudeDir);

		if (!hasClaudeDir) {
			return {
				valid: false,
				resolvedPath,
				error: `Invalid ClaudeKit folder: missing .claude directory at ${resolvedPath}`,
			};
		}

		// 6. Check for metadata.json
		const metadataPath = join(claudeDir, "metadata.json");
		const hasMetadata = await pathExists(metadataPath);

		if (!hasMetadata) {
			return {
				valid: false,
				resolvedPath,
				error: `Invalid ClaudeKit folder: missing metadata.json at ${claudeDir}`,
			};
		}

		// 7. Check for release manifest (required for ownership tracking)
		const manifestPath = join(resolvedPath, ".release-manifest.json");
		const hasManifest = await pathExists(manifestPath);

		if (!hasManifest) {
			return {
				valid: false,
				resolvedPath,
				error: `Invalid ClaudeKit folder: missing .release-manifest.json at ${resolvedPath}. This file is required for file ownership tracking.`,
			};
		}

		// 8. Extract version from metadata.json if available
		let version: string | undefined;
		try {
			const metadataContent = await readFile(metadataPath, "utf-8");
			const metadata = JSON.parse(metadataContent);
			version = metadata.version || "local";
		} catch (error) {
			logger.warning(
				`Failed to read version from metadata.json: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
			version = "local";
		}

		logger.verbose("Folder validation", {
			path: resolvedPath,
			hasClaudeDir,
			hasMetadata,
			hasManifest,
			version,
		});

		return { valid: true, resolvedPath, version };
	}
}
