#!/usr/bin/env bun
/**
 * Generate release manifest for CK kit
 * This manifest tracks all CK-owned files with checksums for ownership verification
 *
 * Usage: bun scripts/generate-release-manifest.ts [source-dir]
 * Output: release-manifest.json in source-dir or CWD
 */
import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { writeFile } from "fs-extra";
import { OwnershipChecker } from "../src/lib/ownership-checker.js";

interface ReleaseManifest {
	version: string;
	generatedAt: string;
	files: {
		path: string;
		checksum: string;
		size: number;
	}[];
}

// Directories to skip
const SKIP_DIRS = ["node_modules", ".git", "dist", "build", "__pycache__"];

// Files to skip (hidden files except specific ones)
const INCLUDE_HIDDEN = [".gitignore", ".repomixignore", ".mcp.json"];

/**
 * Recursively scan directory and collect files
 */
async function scanDirectory(dir: string, baseDir: string): Promise<string[]> {
	const files: string[] = [];

	let entries: string[];
	try {
		entries = await readdir(dir);
	} catch {
		return files;
	}

	for (const entry of entries) {
		const fullPath = join(dir, entry);

		let stats;
		try {
			stats = await stat(fullPath);
		} catch {
			continue;
		}

		if (stats.isDirectory()) {
			// Skip excluded directories
			if (SKIP_DIRS.includes(entry)) continue;
			files.push(...(await scanDirectory(fullPath, baseDir)));
		} else if (stats.isFile()) {
			// Skip hidden files except allowed ones
			if (entry.startsWith(".") && !INCLUDE_HIDDEN.includes(entry)) {
				continue;
			}
			files.push(fullPath);
		}
	}

	return files;
}

async function main() {
	// Get source directory from args or use CWD/.claude
	const sourceDir = process.argv[2] || join(process.cwd(), ".claude");
	const outputPath = join(
		process.argv[2] ? process.argv[2] : process.cwd(),
		"release-manifest.json",
	);

	console.log(`Scanning: ${sourceDir}`);

	// Check if directory exists
	try {
		await stat(sourceDir);
	} catch {
		console.error(`Directory not found: ${sourceDir}`);
		process.exit(1);
	}

	const files = await scanDirectory(sourceDir, sourceDir);
	console.log(`Found ${files.length} files`);

	const manifest: ReleaseManifest = {
		version: process.env.npm_package_version || "unknown",
		generatedAt: new Date().toISOString(),
		files: [],
	};

	for (const file of files) {
		const relativePath = relative(sourceDir, file).replace(/\\/g, "/");
		const checksum = await OwnershipChecker.calculateChecksum(file);
		const stats = await stat(file);

		manifest.files.push({
			path: relativePath,
			checksum,
			size: stats.size,
		});
	}

	await writeFile(outputPath, JSON.stringify(manifest, null, 2));

	console.log(`Generated: ${outputPath}`);
	console.log(`Total files: ${manifest.files.length}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
