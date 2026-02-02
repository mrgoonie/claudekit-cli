import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PathResolver } from "@/shared/path-resolver.js";

const SKILL_NAME = "ck-swarm";

/**
 * Get target directory for ck-swarm skill in ~/.claude/skills/
 */
function getSkillTargetDir(): string {
	return join(PathResolver.getGlobalKitDir(), "skills", SKILL_NAME);
}

/**
 * Get source directory containing bundled skill content
 * Works in both development and installed package
 */
function getSkillSourceDir(): string {
	const thisFile = dirname(fileURLToPath(import.meta.url));
	return join(thisFile, "skill-content");
}

/**
 * Install ck-swarm skill to ~/.claude/skills/ck-swarm/
 * Copies SKILL.md and references/ directory with all markdown files
 */
export function installSwarmSkill(): void {
	const targetDir = getSkillTargetDir();
	const sourceDir = getSkillSourceDir();

	// Verify source directory exists
	if (!existsSync(sourceDir)) {
		throw new Error(`Skill source directory not found: ${sourceDir}`);
	}

	// Create target directory structure
	mkdirSync(targetDir, { recursive: true });
	const referencesTargetDir = join(targetDir, "references");
	mkdirSync(referencesTargetDir, { recursive: true });

	// Copy main SKILL.md
	const mainSkillSource = join(sourceDir, "SKILL.md");
	const mainSkillTarget = join(targetDir, "SKILL.md");
	if (!existsSync(mainSkillSource)) {
		throw new Error(`SKILL.md not found in source: ${mainSkillSource}`);
	}
	const mainContent = readFileSync(mainSkillSource, "utf-8");
	writeFileSync(mainSkillTarget, mainContent, "utf-8");

	// Copy reference files
	const referenceFiles = ["tools.md", "patterns.md", "examples.md"];
	for (const filename of referenceFiles) {
		const sourceFile = join(sourceDir, "references", filename);
		const targetFile = join(referencesTargetDir, filename);

		if (!existsSync(sourceFile)) {
			throw new Error(`Reference file not found: ${sourceFile}`);
		}

		const content = readFileSync(sourceFile, "utf-8");
		writeFileSync(targetFile, content, "utf-8");
	}
}

/**
 * Remove ck-swarm skill from ~/.claude/skills/
 * Silent if skill is not installed
 */
export function removeSwarmSkill(): void {
	const targetDir = getSkillTargetDir();

	if (existsSync(targetDir)) {
		rmSync(targetDir, { recursive: true, force: true });
	}
}

/**
 * Check if ck-swarm skill is currently installed
 */
export function isSwarmSkillInstalled(): boolean {
	const targetDir = getSkillTargetDir();
	const mainSkillFile = join(targetDir, "SKILL.md");
	return existsSync(mainSkillFile);
}
