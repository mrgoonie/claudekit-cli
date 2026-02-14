/**
 * Checksum utilities for portable registry v3.0 idempotency tracking
 * Uses SHA-256 for all content hashing
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

/**
 * Compute SHA-256 checksum of string content
 * @param content String content to hash
 * @returns Hex-encoded SHA-256 hash
 */
export function computeContentChecksum(content: string): string {
	const hash = createHash("sha256");
	hash.update(content, "utf-8");
	return hash.digest("hex");
}

/**
 * Check if Buffer content appears to be binary (contains null bytes)
 * @param buffer Buffer to check
 * @returns True if binary content detected
 */
export function isBinaryContent(buffer: Buffer): boolean {
	// Check first 8KB for null bytes (reliable binary indicator)
	const sample = buffer.subarray(0, 8192);
	return sample.includes(0);
}

/**
 * Compute SHA-256 checksum of file from disk (handles both text and binary)
 * @param filePath Absolute path to file
 * @returns Hex-encoded SHA-256 hash (12-char prefix)
 */
export async function computeFileChecksum(filePath: string): Promise<string> {
	const buffer = await readFile(filePath);
	return createHash("sha256").update(buffer).digest("hex").slice(0, 12);
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
