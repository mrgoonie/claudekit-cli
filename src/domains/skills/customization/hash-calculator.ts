import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { BUILD_ARTIFACT_DIRS } from "@/shared/skip-directories.js";

/**
 * Get all files in a directory recursively
 *
 * @param dirPath Directory path
 * @returns Array of file paths
 */
export async function getAllFiles(dirPath: string): Promise<string[]> {
	const files: string[] = [];
	const entries = await readdir(dirPath, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = join(dirPath, entry.name);

		// Skip hidden files, build artifacts (node_modules, .venv, etc.), and symlinks
		if (
			entry.name.startsWith(".") ||
			BUILD_ARTIFACT_DIRS.includes(entry.name) ||
			entry.isSymbolicLink()
		) {
			continue;
		}

		if (entry.isDirectory()) {
			const subFiles = await getAllFiles(fullPath);
			files.push(...subFiles);
		} else if (entry.isFile()) {
			files.push(fullPath);
		}
	}

	return files;
}

/**
 * Hash a single file using streaming for memory efficiency
 *
 * @param filePath File path
 * @returns SHA-256 hash
 */
export async function hashFile(filePath: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const hash = createHash("sha256");
		const stream = createReadStream(filePath);

		stream.on("data", (chunk) => hash.update(chunk));
		stream.on("end", () => {
			resolve(hash.digest("hex"));
		});
		stream.on("error", (error) => {
			stream.destroy(); // Only needed in error handler for cleanup
			reject(error);
		});
	});
}

/**
 * Hash directory contents
 *
 * @param dirPath Directory path
 * @returns SHA-256 hash
 */
export async function hashDirectory(dirPath: string): Promise<string> {
	const hash = createHash("sha256");
	const files = await getAllFiles(dirPath);

	// Sort for consistent hashing
	files.sort();

	for (const file of files) {
		const relativePath = relative(dirPath, file);
		const content = await readFile(file);

		hash.update(relativePath);
		hash.update(content);
	}

	return hash.digest("hex");
}
