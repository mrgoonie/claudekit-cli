import { constants } from "node:fs";
/**
 * Extraction validation utilities
 */
import { access, readdir } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "@/shared/logger.js";
import { ExtractionError } from "@/types";

/**
 * Validate extraction results
 * @param extractDir - Directory to validate
 * @throws {ExtractionError} If validation fails
 */
export async function validateExtraction(extractDir: string): Promise<void> {
	try {
		// Check if extract directory exists and is not empty
		const entries = await readdir(extractDir, { encoding: "utf8" });
		logger.debug(`Extracted files: ${entries.join(", ")}`);

		if (entries.length === 0) {
			throw new ExtractionError("Extraction resulted in no files");
		}

		// Verify critical paths exist
		const criticalPaths = [".claude", "CLAUDE.md"];
		const missingPaths: string[] = [];

		for (const path of criticalPaths) {
			try {
				await access(join(extractDir, path), constants.F_OK);
				logger.debug(`Found: ${path}`);
			} catch {
				logger.warning(`Expected path not found: ${path}`);
				missingPaths.push(path);
			}
		}

		// Warn if critical paths are missing but don't fail validation
		if (missingPaths.length > 0) {
			logger.warning(
				`Some expected paths are missing: ${missingPaths.join(", ")}. This may not be a ClaudeKit project.`,
			);
		}

		logger.debug("Extraction validation passed");
	} catch (error) {
		if (error instanceof ExtractionError) {
			throw error;
		}
		throw new ExtractionError(
			`Validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}
