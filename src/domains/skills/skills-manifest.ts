import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { logger } from "@/shared/logger.js";
import type { SkillsManifest } from "@/types";
import { SkillsManifestSchema, SkillsMigrationError } from "@/types";
import { pathExists } from "fs-extra";

/**
 * Manages skills manifest generation, validation, and reading
 * Supports both flat and categorized skill directory structures
 */
export class SkillsManifestManager {
	private static readonly MANIFEST_FILENAME = ".skills-manifest.json";
	private static readonly MANIFEST_VERSION = "1.0.0";

	/**
	 * Generate manifest for a skills directory
	 * Scans directory structure and creates hashes for change detection
	 *
	 * @param skillsDir Path to .claude/skills directory
	 * @returns Generated manifest
	 */
	static async generateManifest(skillsDir: string): Promise<SkillsManifest> {
		logger.debug(`Generating manifest for: ${skillsDir}`);

		if (!(await pathExists(skillsDir))) {
			throw new SkillsMigrationError(`Skills directory does not exist: ${skillsDir}`);
		}

		const structure = await SkillsManifestManager.detectStructure(skillsDir);
		const skills = await SkillsManifestManager.scanSkills(skillsDir, structure);

		const manifest: SkillsManifest = {
			version: SkillsManifestManager.MANIFEST_VERSION,
			structure,
			timestamp: new Date().toISOString(),
			skills,
		};

		logger.debug(`Generated manifest with ${skills.length} skills (${structure} structure)`);
		return manifest;
	}

	/**
	 * Write manifest to disk
	 *
	 * @param skillsDir Path to .claude/skills directory
	 * @param manifest Manifest to write
	 */
	static async writeManifest(skillsDir: string, manifest: SkillsManifest): Promise<void> {
		const manifestPath = join(skillsDir, SkillsManifestManager.MANIFEST_FILENAME);
		await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
		logger.debug(`Wrote manifest to: ${manifestPath}`);
	}

	/**
	 * Read and validate manifest from disk
	 *
	 * @param skillsDir Path to .claude/skills directory
	 * @returns Parsed and validated manifest, or null if not found
	 */
	static async readManifest(skillsDir: string): Promise<SkillsManifest | null> {
		const manifestPath = join(skillsDir, SkillsManifestManager.MANIFEST_FILENAME);

		if (!(await pathExists(manifestPath))) {
			logger.debug(`No manifest found at: ${manifestPath}`);
			return null;
		}

		try {
			const content = await readFile(manifestPath, "utf-8");
			const data = JSON.parse(content);
			const manifest = SkillsManifestSchema.parse(data);
			logger.debug(`Read manifest from: ${manifestPath}`);
			return manifest;
		} catch (error) {
			logger.warning(
				`Failed to parse manifest at ${manifestPath}: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
			return null;
		}
	}

	/**
	 * Detect skills directory structure (flat vs categorized)
	 * Categorized structure has subdirectories containing skills
	 * Flat structure has skills directly in the skills directory
	 *
	 * @param skillsDir Path to .claude/skills directory
	 * @returns Detected structure type
	 */
	private static async detectStructure(skillsDir: string): Promise<"flat" | "categorized"> {
		const entries = await readdir(skillsDir, { withFileTypes: true });

		// Filter out manifest and common files
		const dirs = entries.filter(
			(entry) =>
				entry.isDirectory() && entry.name !== "node_modules" && !entry.name.startsWith("."),
		);

		if (dirs.length === 0) {
			return "flat";
		}

		// Check if first few directories contain subdirectories (categorized)
		// or are skills themselves (flat)
		for (const dir of dirs.slice(0, 3)) {
			const dirPath = join(skillsDir, dir.name);
			const subEntries = await readdir(dirPath, { withFileTypes: true });
			const hasSubdirs = subEntries.some((entry) => entry.isDirectory());

			if (hasSubdirs) {
				// Has subdirectories, likely categorized
				return "categorized";
			}

			// Check if it's a skill directory (has skill.md or similar)
			const hasSkillFile = subEntries.some(
				(entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"),
			);
			if (hasSkillFile) {
				return "flat";
			}
		}

		// Default to flat if unclear
		return "flat";
	}

	/**
	 * Scan skills directory and generate skill entries with hashes
	 *
	 * @param skillsDir Path to .claude/skills directory
	 * @param structure Directory structure type
	 * @returns Array of skill entries
	 */
	private static async scanSkills(
		skillsDir: string,
		structure: "flat" | "categorized",
	): Promise<SkillsManifest["skills"]> {
		const skills: SkillsManifest["skills"] = [];

		if (structure === "flat") {
			// Flat structure: skills are direct subdirectories
			const entries = await readdir(skillsDir, { withFileTypes: true });
			for (const entry of entries) {
				if (entry.isDirectory() && entry.name !== "node_modules" && !entry.name.startsWith(".")) {
					const skillPath = join(skillsDir, entry.name);
					const hash = await SkillsManifestManager.hashDirectory(skillPath);
					skills.push({
						name: entry.name,
						hash,
					});
				}
			}
		} else {
			// Categorized structure: categories contain skills
			const categories = await readdir(skillsDir, { withFileTypes: true });
			for (const category of categories) {
				if (
					category.isDirectory() &&
					category.name !== "node_modules" &&
					!category.name.startsWith(".")
				) {
					const categoryPath = join(skillsDir, category.name);
					const skillEntries = await readdir(categoryPath, { withFileTypes: true });

					for (const skillEntry of skillEntries) {
						if (skillEntry.isDirectory() && !skillEntry.name.startsWith(".")) {
							const skillPath = join(categoryPath, skillEntry.name);
							const hash = await SkillsManifestManager.hashDirectory(skillPath);
							skills.push({
								name: skillEntry.name,
								category: category.name,
								hash,
							});
						}
					}
				}
			}
		}

		return skills.sort((a, b) => a.name.localeCompare(b.name));
	}

	/**
	 * Generate SHA-256 hash of directory contents
	 * Used for change detection
	 *
	 * @param dirPath Path to directory
	 * @returns Hex-encoded SHA-256 hash
	 */
	private static async hashDirectory(dirPath: string): Promise<string> {
		const hash = createHash("sha256");
		const files = await SkillsManifestManager.getAllFiles(dirPath);

		// Sort files for consistent hashing
		files.sort();

		for (const file of files) {
			const relativePath = relative(dirPath, file);
			const content = await readFile(file);

			// Hash both path and content for comprehensive fingerprint
			hash.update(relativePath);
			hash.update(content);
		}

		return hash.digest("hex");
	}

	/**
	 * Recursively get all files in a directory
	 *
	 * @param dirPath Path to directory
	 * @returns Array of file paths
	 */
	private static async getAllFiles(dirPath: string): Promise<string[]> {
		const files: string[] = [];
		const entries = await readdir(dirPath, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = join(dirPath, entry.name);

			// Skip hidden files and node_modules
			if (entry.name.startsWith(".") || entry.name === "node_modules") {
				continue;
			}

			if (entry.isDirectory()) {
				const subFiles = await SkillsManifestManager.getAllFiles(fullPath);
				files.push(...subFiles);
			} else if (entry.isFile()) {
				files.push(fullPath);
			}
		}

		return files;
	}

	/**
	 * Validate manifest against schema
	 *
	 * @param manifest Manifest to validate
	 * @returns True if valid, false otherwise
	 */
	static validateManifest(manifest: unknown): manifest is SkillsManifest {
		try {
			SkillsManifestSchema.parse(manifest);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Compare two manifests to detect changes
	 *
	 * @param oldManifest Old manifest
	 * @param newManifest New manifest
	 * @returns Skills with hash changes
	 */
	static compareManifests(oldManifest: SkillsManifest, newManifest: SkillsManifest): string[] {
		const changedSkills: string[] = [];
		const oldSkillsMap = new Map(oldManifest.skills.map((s) => [s.name, s.hash]));

		for (const newSkill of newManifest.skills) {
			const oldHash = oldSkillsMap.get(newSkill.name);
			if (oldHash && oldHash !== newSkill.hash) {
				changedSkills.push(newSkill.name);
			}
		}

		return changedSkills;
	}
}
