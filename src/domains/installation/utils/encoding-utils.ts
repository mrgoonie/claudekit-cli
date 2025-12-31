/**
 * Encoding utilities for handling character encoding in archive entries
 * Handles Mojibake issues with ZIP and TAR archives from various sources
 */
import { Buffer } from "node:buffer";
import { TextDecoder } from "node:util";
import { logger } from "@/shared/logger.js";

const UTF8_DECODER = new TextDecoder("utf-8", { fatal: false });

/**
 * Normalize ZIP entry name to handle encoding issues
 * ZIP files may contain entries with non-UTF8 encoding that need repair
 * @param entryName - Entry name as Buffer or string
 * @returns Normalized UTF-8 string
 */
export function normalizeZipEntryName(entryName: Buffer | string): string {
	if (entryName instanceof Uint8Array) {
		const decoded = UTF8_DECODER.decode(entryName);
		return decoded;
	}

	if (typeof entryName === "string") {
		if (/[ÃÂâ]/u.test(entryName)) {
			try {
				const repaired = Buffer.from(entryName, "latin1").toString("utf8");
				if (!repaired.includes("\uFFFD")) {
					logger.debug(`Recovered zip entry name: ${entryName} -> ${repaired}`);
					return repaired;
				}
			} catch (error) {
				logger.debug(
					`Failed to repair zip entry name ${entryName}: ${error instanceof Error ? error.message : "Unknown error"}`,
				);
			}
		}
		return entryName;
	}

	return String(entryName);
}

/**
 * Decode percent-encoded file paths to handle Mojibake issues
 *
 * GitHub tarballs may contain percent-encoded paths (e.g., %20 for space, %C3%A9 for e)
 * that need to be decoded to prevent character encoding corruption.
 *
 * @param path - File path that may contain URL-encoded characters
 * @returns Decoded path, or original path if decoding fails
 */
export function decodeFilePath(path: string): string {
	// Early exit for non-encoded paths (performance optimization)
	if (!path.includes("%")) {
		return path;
	}

	try {
		// Only decode if path contains valid percent-encoding pattern (%XX)
		if (/%[0-9A-F]{2}/i.test(path)) {
			const decoded = decodeURIComponent(path);
			logger.debug(`Decoded path: ${path} -> ${decoded}`);
			return decoded;
		}
		return path;
	} catch (error) {
		// If decoding fails (malformed encoding), return original path
		logger.warning(
			`Failed to decode path "${path}": ${error instanceof Error ? error.message : "Unknown error"}`,
		);
		return path;
	}
}
