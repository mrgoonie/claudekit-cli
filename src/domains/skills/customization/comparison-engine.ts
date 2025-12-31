import { relative } from "node:path";
import type { FileChange, SkillsManifest } from "@/types";
import { pathExists } from "fs-extra";
import { getAllFiles, hashDirectory, hashFile } from "./hash-calculator.js";

/**
 * Check if a skill is customized
 *
 * @param skillPath Path to skill directory
 * @param skillName Skill name
 * @param baselineSkillPath Baseline skill path (optional, undefined if not found)
 * @param hasBaseline Whether a baseline directory was provided for comparison
 * @param manifest Manifest with baseline hashes (optional)
 * @returns True if customized, false otherwise
 */
export async function isSkillCustomized(
	skillPath: string,
	skillName: string,
	baselineSkillPath: string | undefined,
	hasBaseline: boolean,
	manifest?: SkillsManifest,
): Promise<boolean> {
	// Try hash comparison first (fastest)
	if (manifest) {
		const currentHash = await hashDirectory(skillPath);
		const baselineHash = manifest.skills.find((s) => s.name === skillName)?.hash;

		if (baselineHash && currentHash !== baselineHash) {
			return true;
		}

		if (baselineHash && currentHash === baselineHash) {
			return false;
		}
	}

	// If baseline was provided but skill not found in it, it's custom
	if (hasBaseline && !baselineSkillPath) {
		return true;
	}

	// Fallback to file-by-file comparison if baseline path available
	if (baselineSkillPath) {
		// Compare directory contents
		return await compareDirectories(skillPath, baselineSkillPath);
	}

	// No baseline available, assume not customized
	return false;
}

/**
 * Compare two directories for differences
 *
 * @param dir1 First directory
 * @param dir2 Second directory
 * @returns True if directories differ, false if identical
 */
export async function compareDirectories(dir1: string, dir2: string): Promise<boolean> {
	const files1 = await getAllFiles(dir1);
	const files2 = await getAllFiles(dir2);

	// Different number of files
	if (files1.length !== files2.length) {
		return true;
	}

	// Compare file contents
	const relFiles1 = files1.map((f) => relative(dir1, f)).sort();
	const relFiles2 = files2.map((f) => relative(dir2, f)).sort();

	// Different file names
	if (JSON.stringify(relFiles1) !== JSON.stringify(relFiles2)) {
		return true;
	}

	// Compare file hashes
	for (let i = 0; i < files1.length; i++) {
		const hash1 = await hashFile(files1[i]);
		const hash2 = await hashFile(files2[i]);

		if (hash1 !== hash2) {
			return true;
		}
	}

	return false;
}

/**
 * Detect file changes between current and baseline
 *
 * @param currentSkillPath Current skill path
 * @param baselineSkillPath Baseline skill path
 * @returns Array of file changes
 */
export async function detectFileChanges(
	currentSkillPath: string,
	baselineSkillPath: string,
): Promise<FileChange[]> {
	const changes: FileChange[] = [];

	// Get all files in both directories
	const currentFiles = await getAllFiles(currentSkillPath);
	const baselineFiles = (await pathExists(baselineSkillPath))
		? await getAllFiles(baselineSkillPath)
		: [];

	// Create maps for comparison
	const currentFileMap = new Map(
		await Promise.all(
			currentFiles.map(async (f) => {
				const relPath = relative(currentSkillPath, f);
				const hash = await hashFile(f);
				return [relPath, hash] as [string, string];
			}),
		),
	);

	const baselineFileMap = new Map(
		await Promise.all(
			baselineFiles.map(async (f) => {
				const relPath = relative(baselineSkillPath, f);
				const hash = await hashFile(f);
				return [relPath, hash] as [string, string];
			}),
		),
	);

	// Find added and modified files
	for (const [file, currentHash] of currentFileMap.entries()) {
		const baselineHash = baselineFileMap.get(file);

		if (!baselineHash) {
			// File added
			changes.push({
				file,
				type: "added",
				newHash: currentHash,
			});
		} else if (baselineHash !== currentHash) {
			// File modified
			changes.push({
				file,
				type: "modified",
				oldHash: baselineHash,
				newHash: currentHash,
			});
		}
	}

	// Find deleted files
	for (const [file, baselineHash] of baselineFileMap.entries()) {
		if (!currentFileMap.has(file)) {
			changes.push({
				file,
				type: "deleted",
				oldHash: baselineHash,
			});
		}
	}

	return changes;
}
