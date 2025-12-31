import { readdir } from "node:fs/promises";
import { join, normalize } from "node:path";
import { SkillsMigrationError } from "@/types";
import { pathExists } from "fs-extra";

/**
 * Validate path input to prevent security issues
 */
export function validatePath(path: string, paramName: string): void {
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
 * Scan skills directory to detect structure and list skills
 *
 * @param skillsDir Skills directory
 * @returns Tuple of [structure, skill names]
 */
export async function scanSkillsDirectory(
	skillsDir: string,
): Promise<["flat" | "categorized", string[]]> {
	if (!(await pathExists(skillsDir))) {
		return ["flat", []];
	}

	const entries = await readdir(skillsDir, { withFileTypes: true });
	const dirs = entries.filter(
		(entry) => entry.isDirectory() && entry.name !== "node_modules" && !entry.name.startsWith("."),
	);

	if (dirs.length === 0) {
		return ["flat", []];
	}

	// Check if first directory contains subdirectories (categorized)
	const firstDirPath = join(skillsDir, dirs[0].name);
	const subEntries = await readdir(firstDirPath, { withFileTypes: true });
	const subdirs = subEntries.filter((entry) => entry.isDirectory() && !entry.name.startsWith("."));

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
export async function findSkillPath(
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
