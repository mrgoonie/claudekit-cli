/**
 * Checksum utilities for portable registry v3.0 idempotency tracking
 * Uses SHA-256 for all content hashing
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const CHECKSUM_HEX_LENGTH = 64;
const BINARY_DETECTION_SAMPLE_BYTES = 8 * 1024;

/**
 * Use full SHA-256 hex for all checksum sources (content + file reads).
 * Mixing truncated and full-length hashes causes false change detection.
 */
function computeSha256Hex(input: string | Buffer): string {
	const hash = createHash("sha256");
	if (typeof input === "string") {
		hash.update(input, "utf-8");
	} else {
		hash.update(input);
	}
	return hash.digest("hex").slice(0, CHECKSUM_HEX_LENGTH);
}

/**
 * Compute SHA-256 checksum of string content
 * @param content String content to hash
 * @returns Hex-encoded SHA-256 hash
 */
export function computeContentChecksum(content: string): string {
	return computeSha256Hex(content);
}

/**
 * Check if Buffer content appears to be binary (contains null bytes)
 * @param buffer Buffer to check
 * @returns True if binary content detected
 */
export function isBinaryContent(buffer: Buffer): boolean {
	// Check first 8KB for null bytes (reliable binary indicator)
	const sample = buffer.subarray(0, BINARY_DETECTION_SAMPLE_BYTES);
	return sample.includes(0);
}

/**
 * Compute SHA-256 checksum of file from disk (handles both text and binary)
 * @param filePath Absolute path to file
 * @returns Hex-encoded SHA-256 hash
 */
export async function computeFileChecksum(filePath: string): Promise<string> {
	const buffer = await readFile(filePath);
	return computeSha256Hex(buffer);
}

/**
 * Compute checksums for multiple named sections
 * Used for merge targets (merge-single, yaml-merge, json-merge)
 * @param sections Array of {name, content} objects
 * @returns Map of section name -> checksum
 */
export function computeSectionChecksums(
	sections: Array<{ name: string; content: string }>,
): Record<string, string> {
	const checksums: Record<string, string> = {};
	for (const section of sections) {
		checksums[section.name] = computeContentChecksum(section.content);
	}
	return checksums;
}
