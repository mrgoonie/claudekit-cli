/**
 * File I/O operations for settings files
 */
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { logger } from "@/shared/logger.js";
import { pathExists, readFile, rename, unlink, writeFile } from "fs-extra";
import type { SettingsJson } from "./types.js";

/**
 * Strip UTF-8 BOM if present
 * Windows editors (especially Notepad) add this invisible character
 */
function stripBOM(content: string): string {
	return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
}

/**
 * Read and parse settings.json file
 * Returns null if file doesn't exist, is empty, or contains invalid JSON
 */
export async function readSettingsFile(filePath: string): Promise<SettingsJson | null> {
	try {
		if (!(await pathExists(filePath))) {
			return null;
		}
		const rawContent = await readFile(filePath, "utf-8");
		const content = stripBOM(rawContent);
		const parsed: unknown = JSON.parse(content);

		// Basic runtime validation - ensure it's an object
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			logger.warning(`Invalid settings file format (expected object): ${filePath}`);
			return null;
		}

		return parsed as SettingsJson;
	} catch (error) {
		logger.warning(`Failed to parse settings file: ${filePath} - ${error}`);
		return null;
	}
}

/**
 * Atomic file write using temp file + rename
 *
 * @param filePath - Target file path
 * @param content - Content to write
 * @throws Error if write or rename fails
 */
export async function atomicWriteFile(filePath: string, content: string): Promise<void> {
	const dir = dirname(filePath);
	const tempPath = join(dir, `.settings-${randomUUID()}.tmp`);

	try {
		// Write to temp file first
		await writeFile(tempPath, content, "utf-8");
		// Atomic rename (same filesystem)
		await rename(tempPath, filePath);
	} catch (error) {
		// Clean up temp file on failure
		try {
			if (await pathExists(tempPath)) {
				await unlink(tempPath);
			}
		} catch {
			// Ignore cleanup errors
		}
		throw error;
	}
}

/**
 * Write settings.json file with proper formatting using atomic write
 *
 * Uses write-to-temp-then-rename pattern for safe atomic writes:
 * 1. Write content to a temp file in the same directory
 * 2. Rename temp file to target (atomic on POSIX, near-atomic on Windows)
 * 3. Clean up temp file on failure
 *
 * This avoids creating .backup files while ensuring data integrity.
 */
export async function writeSettingsFile(filePath: string, settings: SettingsJson): Promise<void> {
	const content = JSON.stringify(settings, null, 2);
	await atomicWriteFile(filePath, content);
}
