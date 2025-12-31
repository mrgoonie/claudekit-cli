import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathExists } from "fs-extra";

/**
 * Scan directory to detect structure and list skills
 *
 * @param skillsDir Path to skills directory
 * @returns Tuple of [structure, skill names]
 */
export async function scanDirectory(
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

	// Check all directories to determine structure (not just first one)
	// This handles mixed structures and different directory ordering on Windows
	let totalSkillLikeCount = 0;
	const allSkills: string[] = [];

	for (const dir of dirs) {
		const dirPath = join(skillsDir, dir.name);
		const subEntries = await readdir(dirPath, { withFileTypes: true });
		const subdirs = subEntries.filter(
			(entry) => entry.isDirectory() && !entry.name.startsWith("."),
		);

		// Check if this directory has subdirectories that look like skills
		if (subdirs.length > 0) {
			for (const subdir of subdirs.slice(0, 3)) {
				// Check first 3 subdirs
				const subdirPath = join(dirPath, subdir.name);
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
					totalSkillLikeCount++;
					allSkills.push(subdir.name);
				}
			}
		}
	}

	// If we found subdirectories with skill markers, it's categorized
	if (totalSkillLikeCount > 0) {
		return ["categorized", allSkills];
	}

	// Flat structure
	return ["flat", dirs.map((dir) => dir.name)];
}
