#!/usr/bin/env bun
/**
 * Generate release manifest for CK kit
 * This manifest tracks all CK-owned files with checksums for ownership verification
 *
 * Checksums are calculated AFTER applying global path transformation ($HOME/.claude/)
 * so they match installed files after `ck init -g` transforms paths.
 *
 * Usage: bun scripts/generate-release-manifest.ts [source-dir]
 * Output: release-manifest.json in source-dir or CWD
 */
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { writeFile } from "fs-extra";
import {
	shouldTransformFile,
	transformContent,
} from "../src/services/transformers/global-path-transformer.js";

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
const SKIP_DIRS = [
	// Build/package artifacts
	"node_modules",
	".venv",
	"venv",
	".test-venv",
	"__pycache__",
	".git",
	".svn",
	"dist",
	"build",
	// Claude Code internal directories (not ClaudeKit files)
	"debug",
	"projects",
	"shell-snapshots",
	"file-history",
	"todos",
	"session-env",
	"statsig",
	".anthropic",
];

// Files to skip (hidden files except specific ones)
const INCLUDE_HIDDEN = [".gitignore", ".repomixignore", ".mcp.json"];

/**
 * Calculate SHA-256 checksum from content string
 */
function calculateChecksumFromContent(content: string): string {
	return createHash("sha256").update(content, "utf-8").digest("hex");
}

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

	let transformedCount = 0;
	let skippedCount = 0;
	for (const file of files) {
		const relativePath = relative(sourceDir, file).replace(/\\/g, "/");
		const stats = await stat(file);

		let checksum: string;
		try {
			if (shouldTransformFile(relativePath)) {
				// Read content, apply path transformation, then checksum
				// This ensures manifest checksums match files after `ck init -g` transforms paths
				const content = await readFile(file, "utf-8");
				const { transformed, changes } = transformContent(content);
				checksum = calculateChecksumFromContent(transformed);
				if (changes > 0) transformedCount++;
			} else {
				// Binary/non-transformable files: checksum directly
				const content = await readFile(file);
				checksum = createHash("sha256").update(content).digest("hex");
			}
		} catch (err) {
			// Handle file read errors (permission denied, encoding issues, etc.)
			const error = err as NodeJS.ErrnoException;
			console.warn(`Warning: Skipping ${relativePath}: ${error.message}`);
			skippedCount++;
			continue;
		}

		manifest.files.push({
			path: relativePath,
			checksum,
			size: stats.size,
		});
	}

	if (transformedCount > 0) {
		console.log(`Transformed ${transformedCount} files before checksumming`);
	}
	if (skippedCount > 0) {
		console.warn(`Skipped ${skippedCount} files due to read errors`);
	}

	await writeFile(outputPath, JSON.stringify(manifest, null, 2));

	console.log(`Generated: ${outputPath}`);
	console.log(`Total files: ${manifest.files.length}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
