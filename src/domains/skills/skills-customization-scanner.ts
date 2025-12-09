import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join, normalize, relative } from "node:path";
import { pathExists } from "fs-extra";
import { logger } from "../../shared/logger.js";
import type { CustomizationDetection, FileChange, SkillsManifest } from "../../types/index.js";
import { SkillsMigrationError } from "../../types/index.js";

/**
 * Validate path input to prevent security issues
 */
function validatePath(path: string, paramName: string): void {
	if (!path || typeof path !== "string") {
		throw new SkillsMigrationError(`${paramName} must be a non-empty string`);
	}

	// Check for path traversal attempts before normalization
	if (path.includes("..")) {
		const normalized = normalize(path);
		// After normalization, if it still goes up directories relative to current, it's suspicious
		if (normalized.startsWith("..")) {
			throw new SkillsMigrationError(`${paramName} contains invalid path traversal: ${path}`);
		}
	}
}

/**
 * Scans skills for user customizations by comparing with baseline
 * Detects added, modified, and deleted files
 */
export class SkillsCustomizationScanner {
	/**
	 * Scan skills for customizations
	 *
	 * @param currentSkillsDir Current project skills directory
	 * @param baselineSkillsDir Baseline skills directory from release (optional)
	 * @param manifest Manifest with baseline hashes (optional)
	 * @returns Array of customization detections
	 */
	static async scanCustomizations(
		currentSkillsDir: string,
		baselineSkillsDir?: string,
		manifest?: SkillsManifest,
	): Promise<CustomizationDetection[]> {
		validatePath(currentSkillsDir, "currentSkillsDir");
		if (baselineSkillsDir) {
			validatePath(baselineSkillsDir, "baselineSkillsDir");
		}

		logger.debug("Scanning skills for customizations...");

		const customizations: CustomizationDetection[] = [];

		// Get list of skills in current directory
		const [, skillNames] = await SkillsCustomizationScanner.scanSkillsDirectory(currentSkillsDir);

		for (const skillName of skillNames) {
			// Find actual skill path (handles flat and categorized)
			const skillInfo = await SkillsCustomizationScanner.findSkillPath(currentSkillsDir, skillName);

			if (!skillInfo) {
				logger.warning(`Skill directory not found: ${skillName}`);
				continue;
			}

			const { path: skillPath, category: _category } = skillInfo;

			// Find baseline path if baseline provided
			let baselineSkillPath: string | undefined;
			let hasBaseline = false;
			if (baselineSkillsDir) {
				hasBaseline = true;
				const baselineInfo = await SkillsCustomizationScanner.findSkillPath(
					baselineSkillsDir,
					skillName,
				);
				baselineSkillPath = baselineInfo?.path;
			}

			// Check if skill is customized
			const isCustomized = await SkillsCustomizationScanner.isSkillCustomized(
				skillPath,
				skillName,
				baselineSkillPath,
				hasBaseline,
				manifest,
			);

			if (isCustomized) {
				// Get detailed changes
				const changes = baselineSkillPath
					? await SkillsCustomizationScanner.detectFileChanges(skillPath, baselineSkillPath)
					: undefined;

				customizations.push({
					skillName,
					path: skillPath,
					isCustomized: true,
					changes,
				});

				logger.debug(`Detected customizations in skill: ${skillName}`);
			} else {
				customizations.push({
					skillName,
					path: skillPath,
					isCustomized: false,
				});
			}
		}

		logger.info(
			`Found ${customizations.filter((c) => c.isCustomized).length} customized skills out of ${skillNames.length}`,
		);

		return customizations;
	}

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
	private static async isSkillCustomized(
		skillPath: string,
		skillName: string,
		baselineSkillPath: string | undefined,
		hasBaseline: boolean,
		manifest?: SkillsManifest,
	): Promise<boolean> {
		// Try hash comparison first (fastest)
		if (manifest) {
			const currentHash = await SkillsCustomizationScanner.hashDirectory(skillPath);
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
			return await SkillsCustomizationScanner.compareDirectories(skillPath, baselineSkillPath);
		}

		// No baseline available, assume not customized
		return false;
	}

	/**
	 * Detect file changes between current and baseline
	 *
	 * @param currentSkillPath Current skill path
	 * @param baselineSkillPath Baseline skill path
	 * @returns Array of file changes
	 */
	private static async detectFileChanges(
		currentSkillPath: string,
		baselineSkillPath: string,
	): Promise<FileChange[]> {
		const changes: FileChange[] = [];

		// Get all files in both directories
		const currentFiles = await SkillsCustomizationScanner.getAllFiles(currentSkillPath);
		const baselineFiles = (await pathExists(baselineSkillPath))
			? await SkillsCustomizationScanner.getAllFiles(baselineSkillPath)
			: [];

		// Create maps for comparison
		const currentFileMap = new Map(
			await Promise.all(
				currentFiles.map(async (f) => {
					const relPath = relative(currentSkillPath, f);
					const hash = await SkillsCustomizationScanner.hashFile(f);
					return [relPath, hash] as [string, string];
				}),
			),
		);

		const baselineFileMap = new Map(
			await Promise.all(
				baselineFiles.map(async (f) => {
					const relPath = relative(baselineSkillPath, f);
					const hash = await SkillsCustomizationScanner.hashFile(f);
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

	/**
	 * Compare two directories for differences
	 *
	 * @param dir1 First directory
	 * @param dir2 Second directory
	 * @returns True if directories differ, false if identical
	 */
	private static async compareDirectories(dir1: string, dir2: string): Promise<boolean> {
		const files1 = await SkillsCustomizationScanner.getAllFiles(dir1);
		const files2 = await SkillsCustomizationScanner.getAllFiles(dir2);

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
			const hash1 = await SkillsCustomizationScanner.hashFile(files1[i]);
			const hash2 = await SkillsCustomizationScanner.hashFile(files2[i]);

			if (hash1 !== hash2) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Scan skills directory to detect structure and list skills
	 *
	 * @param skillsDir Skills directory
	 * @returns Tuple of [structure, skill names]
	 */
	private static async scanSkillsDirectory(
		skillsDir: string,
	): Promise<["flat" | "categorized", string[]]> {
		if (!(await pathExists(skillsDir))) {
			return ["flat", []];
		}

		const entries = await readdir(skillsDir, { withFileTypes: true });
		const dirs = entries.filter(
			(entry) =>
				entry.isDirectory() && entry.name !== "node_modules" && !entry.name.startsWith("."),
		);

		if (dirs.length === 0) {
			return ["flat", []];
		}

		// Check if first directory contains subdirectories (categorized)
		const firstDirPath = join(skillsDir, dirs[0].name);
		const subEntries = await readdir(firstDirPath, { withFileTypes: true });
		const subdirs = subEntries.filter(
			(entry) => entry.isDirectory() && !entry.name.startsWith("."),
		);

		// Only consider categorized if subdirectories contain skill-like files at their root
		if (subdirs.length > 0) {
			// Check if subdirectories look like skills (contain skill files at root)
			let skillLikeCount = 0;
			for (const subdir of subdirs.slice(0, 3)) {
				// Check first 3 subdirs
				const subdirPath = join(firstDirPath, subdir.name);
				const subdirFiles = await readdir(subdirPath, { withFileTypes: true });
				// A skill directory typically has skill.md, README.md, or config.json at root
				const hasSkillMarker = subdirFiles.some(
					(file) =>
						file.isFile() &&
						(file.name === "skill.md" ||
							file.name === "README.md" ||
							file.name === "readme.md" ||
							file.name === "config.json" ||
							file.name === "package.json"),
				);
				if (hasSkillMarker) {
					skillLikeCount++;
				}
			}

			// If subdirectories have skill markers, it's categorized
			if (skillLikeCount > 0) {
				const skills: string[] = [];
				for (const dir of dirs) {
					const categoryPath = join(skillsDir, dir.name);
					const skillDirs = await readdir(categoryPath, { withFileTypes: true });
					skills.push(
						...skillDirs
							.filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
							.map((entry) => entry.name),
					);
				}
				return ["categorized", skills];
			}
		}

		// Flat: skills are direct subdirectories
		return ["flat", dirs.map((dir) => dir.name)];
	}

	/**
	 * Find actual path of skill in directory (handles flat and categorized)
	 *
	 * @param skillsDir Skills directory
	 * @param skillName Skill name to find
	 * @returns Full path to skill and category info, or null if not found
	 */
	private static async findSkillPath(
		skillsDir: string,
		skillName: string,
	): Promise<{ path: string; category?: string } | null> {
		// Try flat structure first
		const flatPath = join(skillsDir, skillName);
		if (await pathExists(flatPath)) {
			return { path: flatPath, category: undefined };
		}

		// Try categorized structure
		const entries = await readdir(skillsDir, { withFileTypes: true });
		for (const entry of entries) {
			if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "node_modules") {
				continue;
			}

			const categoryPath = join(skillsDir, entry.name);
			const skillPath = join(categoryPath, skillName);

			if (await pathExists(skillPath)) {
				return { path: skillPath, category: entry.name };
			}
		}

		return null;
	}

	/**
	 * Get all files in a directory recursively
	 *
	 * @param dirPath Directory path
	 * @returns Array of file paths
	 */
	private static async getAllFiles(dirPath: string): Promise<string[]> {
		const files: string[] = [];
		const entries = await readdir(dirPath, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = join(dirPath, entry.name);

			// Skip hidden files, node_modules, and symlinks
			if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.isSymbolicLink()) {
				continue;
			}

			if (entry.isDirectory()) {
				const subFiles = await SkillsCustomizationScanner.getAllFiles(fullPath);
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
	private static async hashFile(filePath: string): Promise<string> {
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
	private static async hashDirectory(dirPath: string): Promise<string> {
		const hash = createHash("sha256");
		const files = await SkillsCustomizationScanner.getAllFiles(dirPath);

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
}
