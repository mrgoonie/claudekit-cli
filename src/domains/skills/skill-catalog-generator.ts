/**
 * Skill catalog generator — builds and caches a flat JSON catalog of all available skills.
 * The catalog is stored at ~/.claude/.skills-catalog.json and auto-refreshes when stale.
 */

import { mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, relative } from "node:path";
import { discoverSkillsEnriched } from "../../commands/skills/skills-discovery.js";
import type {
	CatalogSkillEntry,
	EnrichedSkillInfo,
	SkillCatalog,
} from "../../commands/skills/types.js";
import { logger } from "../../shared/logger.js";

// Single catalog path regardless of source — intentional MVP design.
// All discovered skills (whether from bundled engineer package or ~/.claude/skills/)
// are merged into one catalog. Multi-source catalogs are out of scope for now.
const CATALOG_PATH = join(homedir(), ".claude", ".skills-catalog.json");
const CATALOG_VERSION = "1.0.0";

// Directories to skip when checking for scripts
const SKIP_DIRS = [".venv", "__pycache__", "node_modules", ".git"];

/**
 * Check if a skill directory has scripts (non-SKILL.md files or subdirectories)
 */
async function hasScripts(skillPath: string): Promise<boolean> {
	try {
		const entries = await readdir(skillPath, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.name === "SKILL.md") continue;
			if (SKIP_DIRS.includes(entry.name)) continue;
			return true;
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * Check if a skill directory has a references/docs subdirectory or .md files beyond SKILL.md
 */
async function hasReferences(skillPath: string): Promise<boolean> {
	try {
		const entries = await readdir(skillPath, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.name === "SKILL.md") continue;
			if (entry.isDirectory() && !SKIP_DIRS.includes(entry.name)) return true;
			if (entry.isFile() && entry.name.endsWith(".md")) return true;
		}
		return false;
	} catch {
		return false;
	}
}

export class SkillCatalogGenerator {
	/**
	 * Convert EnrichedSkillInfo list to a catalog.
	 * Paths are stored RELATIVE to skill source base path.
	 */
	async generate(enrichedSkills: EnrichedSkillInfo[], basePath: string): Promise<SkillCatalog> {
		const entries: CatalogSkillEntry[] = await Promise.all(
			enrichedSkills.map(async (skill): Promise<CatalogSkillEntry> => {
				const relPath = relative(basePath, join(skill.path, "SKILL.md"));
				const [scripts, refs] = await Promise.all([
					hasScripts(skill.path),
					hasReferences(skill.path),
				]);

				return {
					name: skill.name,
					displayName: skill.displayName || skill.name,
					description: skill.description,
					version: skill.version,
					author: skill.author,
					category: skill.category,
					keywords: skill.keywords,
					requires: skill.requires,
					related: skill.related,
					maturity: skill.maturity,
					path: relPath,
					hasScripts: scripts,
					hasReferences: refs,
					crossRefs: skill.crossRefs,
				};
			}),
		);

		return {
			version: CATALOG_VERSION,
			generated: new Date().toISOString(),
			skillCount: entries.length,
			skills: entries,
		};
	}

	/**
	 * Atomically write catalog to ~/.claude/.skills-catalog.json
	 * Uses temp file in same directory + rename for atomic swap.
	 */
	async write(catalog: SkillCatalog): Promise<void> {
		await mkdir(dirname(CATALOG_PATH), { recursive: true });
		const tmpPath = `${CATALOG_PATH}.tmp`;
		const json = JSON.stringify(catalog, null, 2);
		await writeFile(tmpPath, json, "utf-8");
		await rename(tmpPath, CATALOG_PATH);
		logger.verbose(`Catalog written: ${catalog.skillCount} skills`);
	}

	/**
	 * Read catalog from disk. Returns null if missing, corrupt, or version mismatch.
	 */
	async read(): Promise<SkillCatalog | null> {
		try {
			const content = await readFile(CATALOG_PATH, "utf-8");
			const parsed = JSON.parse(content) as SkillCatalog;
			if (parsed.version !== CATALOG_VERSION) {
				logger.verbose(`Catalog version mismatch (${parsed.version} vs ${CATALOG_VERSION})`);
				return null;
			}
			return parsed;
		} catch {
			return null;
		}
	}

	/**
	 * Check whether the catalog is stale by comparing its generated timestamp
	 * against the mtime of any SKILL.md file in the skills source path.
	 */
	async isStale(catalogGenerated: string, skillsBasePath: string): Promise<boolean> {
		const catalogTime = new Date(catalogGenerated).getTime();
		if (Number.isNaN(catalogTime)) return true;

		try {
			const entries = await readdir(skillsBasePath, { withFileTypes: true });
			for (const entry of entries) {
				if (!entry.isDirectory()) continue;
				const skillMdPath = join(skillsBasePath, entry.name, "SKILL.md");
				try {
					const stats = await stat(skillMdPath);
					if (stats.mtimeMs > catalogTime) return true;
				} catch {
					// SKILL.md doesn't exist or can't be statted — skip this entry
				}
			}
		} catch {
			return true;
		}
		return false;
	}

	/**
	 * Force-regenerate the catalog regardless of staleness.
	 * Discovers skills, builds catalog, writes to disk, and returns it.
	 */
	static async forceRegenerate(skillsBasePath: string): Promise<SkillCatalog> {
		const { discoverSkillsEnriched } = await import("../../commands/skills/skills-discovery.js");
		const enriched = await discoverSkillsEnriched(skillsBasePath);
		const instance = new SkillCatalogGenerator();
		const catalog = await instance.generate(enriched, skillsBasePath);
		await instance.write(catalog);
		return catalog;
	}

	/**
	 * Read catalog or regenerate it if missing/stale.
	 * skillsBasePath is used for freshness checks and discovery.
	 */
	async readOrRegenerate(skillsBasePath: string): Promise<SkillCatalog> {
		const existing = await this.read();

		if (existing) {
			const stale = await this.isStale(existing.generated, skillsBasePath);
			if (!stale) {
				logger.verbose("Catalog is fresh, using cached version");
				return existing;
			}
			logger.verbose("Catalog is stale, regenerating");
		} else {
			logger.verbose("No catalog found, generating");
		}

		const skills = await discoverSkillsEnriched(skillsBasePath);
		const catalog = await this.generate(skills, skillsBasePath);
		// Best-effort write — don't fail if catalog dir isn't writable
		try {
			await this.write(catalog);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			logger.verbose(`Could not persist catalog: ${msg}`);
		}
		return catalog;
	}
}

/** Singleton instance for convenience */
export const skillCatalogGenerator = new SkillCatalogGenerator();
