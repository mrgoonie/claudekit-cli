#!/usr/bin/env node

/**
 * CI gate: verify that deleted/renamed managed files are recorded in metadata.json deletions[].
 *
 * Managed paths: any file under .claude/ (agents, commands, rules, skills, hooks, etc.)
 * These files are distributed to users' .claude/ directories and must be tracked for cleanup.
 *
 * Usage: node scripts/check-metadata-deletions.js
 * Exit 0 = OK, Exit 1 = missing deletions entries
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = process.cwd();

// Paths relative to repo root that are distributed to users' .claude/ directories.
// Files deleted or renamed under these prefixes must appear in metadata.json deletions[].
const MANAGED_PATH_PREFIXES = [".claude/"];

// Location of metadata.json relative to repo root
const METADATA_PATH = join(REPO_ROOT, "metadata.json");

/**
 * Run git diff to find deleted and renamed files compared to origin/dev.
 * Returns array of file paths (original path for renames) that were removed.
 */
function getDeletedAndRenamedFiles() {
	let output;
	try {
		output = execSync("git diff --name-status origin/dev", {
			cwd: REPO_ROOT,
			encoding: "utf8",
			stdio: ["pipe", "pipe", "pipe"],
		});
	} catch (err) {
		// git diff failing means we can't check — warn but don't block CI
		console.error("[!] git diff failed:", err.message);
		console.error("[!] Skipping metadata-deletions check (cannot diff against origin/dev)");
		process.exit(0);
	}

	const removed = [];

	for (const line of output.split("\n")) {
		if (!line.trim()) continue;

		const parts = line.split("\t");
		const status = parts[0];

		if (status === "D") {
			// Deleted: D\tpath
			removed.push(parts[1]);
		} else if (status.startsWith("R")) {
			// Renamed: R100\told-path\tnew-path — old path is no longer available
			removed.push(parts[1]);
		}
	}

	return removed;
}

/**
 * Filter to only files under managed path prefixes.
 * Returns paths relative to repo root (e.g., ".claude/commands/old.md").
 */
function filterManagedPaths(files) {
	return files.filter((f) => MANAGED_PATH_PREFIXES.some((prefix) => f.startsWith(prefix)));
}

/**
 * Strip the managed path prefix to get the path relative to .claude/.
 * e.g. ".claude/commands/old.md" -> "commands/old.md"
 */
function toMetadataPath(filePath) {
	for (const prefix of MANAGED_PATH_PREFIXES) {
		if (filePath.startsWith(prefix)) {
			return filePath.slice(prefix.length);
		}
	}
	return filePath;
}

/**
 * Read and parse metadata.json deletions[].
 * Returns null if file does not exist.
 * Throws on parse error.
 */
function readDeletions() {
	if (!existsSync(METADATA_PATH)) {
		return null;
	}

	let raw;
	try {
		raw = readFileSync(METADATA_PATH, "utf8");
	} catch (err) {
		throw new Error(`Failed to read metadata.json: ${err.message}`);
	}

	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch (err) {
		throw new Error(`Failed to parse metadata.json: ${err.message}`);
	}

	if (!Array.isArray(parsed.deletions)) {
		// No deletions array — treat as empty
		return [];
	}

	if (!parsed.deletions.every((d) => typeof d === "string")) {
		throw new Error("[X] metadata.json deletions[] must be an array of strings");
	}

	return parsed.deletions;
}

function main() {
	// Step 1: find all deleted/renamed files in this PR
	const allRemoved = getDeletedAndRenamedFiles();

	// Step 2: filter to managed paths only
	const managedRemoved = filterManagedPaths(allRemoved);

	if (managedRemoved.length === 0) {
		console.log("[OK] No managed paths deleted or renamed — metadata-deletions check passed.");
		process.exit(0);
	}

	console.log(
		`[i] Found ${managedRemoved.length} deleted/renamed managed file(s):\n${managedRemoved.map((f) => `     - ${f}`).join("\n")}`,
	);

	// Step 3: read metadata.json deletions[]
	let deletions;
	try {
		deletions = readDeletions();
	} catch (err) {
		console.error(`[X] ${err.message}`);
		process.exit(1);
	}

	if (deletions === null) {
		console.error(
			"[X] metadata.json not found at repo root.\n" +
				"    Deleted managed files must be recorded in metadata.json deletions[].\n" +
				"    Create metadata.json with a deletions[] array listing the paths below.",
		);
		for (const f of managedRemoved) {
			console.error(`    Missing: ${toMetadataPath(f)}`);
		}
		process.exit(1);
	}

	// Step 4: check each managed deletion is in deletions[]
	const deletionSet = new Set(deletions);
	const missing = managedRemoved.filter((f) => !deletionSet.has(toMetadataPath(f)));

	if (missing.length === 0) {
		console.log(
			"[OK] All deleted/renamed managed paths are recorded in metadata.json deletions[].",
		);
		process.exit(0);
	}

	// Step 5: fail with clear error
	console.error(
		`[X] metadata-deletions-check FAILED: ${missing.length} deleted/renamed managed file(s) not in metadata.json deletions[].\n`,
	);
	console.error("    Add these paths to the deletions[] array in metadata.json:\n");
	for (const f of missing) {
		console.error(`      "${toMetadataPath(f)}"`);
	}
	console.error(
		`\n    Example metadata.json:\n    {\n      "deletions": [\n${missing.map((f) => `        "${toMetadataPath(f)}"`).join(",\n")}\n      ]\n    }`,
	);
	process.exit(1);
}

main();
