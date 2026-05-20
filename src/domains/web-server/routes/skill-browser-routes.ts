/**
 * Skill browser API routes — read-only browser for locally installed skills.
 * Distinct from skill-routes.ts (which handles install/uninstall).
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { parseFrontmatter } from "@/commands/portable/frontmatter-parser.js";
import { skillCatalogGenerator } from "@/domains/skills/skill-catalog-generator.js";
import { searchSkills } from "@/domains/skills/skill-search-index.js";
import type { Express, Request, Response } from "express";

interface SkillBrowserItem {
	name: string;
	description?: string;
	triggers?: string[];
	source: "local" | "github";
	installed: boolean;
}

/**
 * Resolve the skills directory: ~/.claude/skills/
 */
function getSkillsDir(): string {
	return path.join(os.homedir(), ".claude", "skills");
}

/**
 * Validate skill name to prevent path traversal.
 * Only allows alphanumeric, hyphens, and underscores.
 */
function isValidSkillName(name: string): boolean {
	return /^[a-zA-Z0-9_-]+$/.test(name) && !name.includes("..") && !name.includes("/");
}

/**
 * Extract SKILL.md-specific triggers array from YAML frontmatter block.
 * The shared parseFrontmatter handles name/description; triggers are skill-specific.
 */
function parseSkillTriggers(content: string): string[] | undefined {
	const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
	if (!frontmatterMatch) return undefined;

	const yaml = frontmatterMatch[1];

	// YAML list format: triggers:\n  - value
	const triggersSection = yaml.match(/^triggers:\s*\n((?:\s+-\s*.+\n?)*)/m);
	if (triggersSection) {
		const triggers = triggersSection[1]
			.split("\n")
			.map((l) =>
				l
					.replace(/^\s+-\s*/, "")
					.replace(/["']/g, "")
					.trim(),
			)
			.filter(Boolean);
		if (triggers.length > 0) return triggers;
	}

	// Inline format: triggers: [a, b, c]
	const inlineMatch = yaml.match(/^triggers:\s*\[(.+)\]/m);
	if (inlineMatch) {
		const triggers = inlineMatch[1]
			.split(",")
			.map((t) => t.replace(/["']/g, "").trim())
			.filter(Boolean);
		if (triggers.length > 0) return triggers;
	}

	return undefined;
}

/**
 * Determine if a skill has a github origin.
 * Checks for .git/config, .imports.json, or SKILL.md source field.
 */
async function detectSource(skillDir: string): Promise<"local" | "github"> {
	// Check .imports.json
	try {
		const importsPath = path.join(skillDir, ".imports.json");
		const data = await fs.readFile(importsPath, "utf8");
		const parsed = JSON.parse(data) as { source?: string; github?: string };
		if (parsed.source?.includes("github") || parsed.github) return "github";
	} catch {
		// File doesn't exist or can't be parsed — not a github import
	}

	// Check for git remote in .git/config
	try {
		const gitConfigPath = path.join(skillDir, ".git", "config");
		const gitConfig = await fs.readFile(gitConfigPath, "utf8");
		if (gitConfig.includes("github.com")) return "github";
	} catch {
		// No git config
	}

	return "local";
}

/**
 * Scan all skills in ~/.claude/skills/ and return metadata.
 */
async function listSkills(): Promise<SkillBrowserItem[]> {
	const skillsDir = getSkillsDir();

	let entries: string[];
	try {
		const dirEntries = await fs.readdir(skillsDir, { withFileTypes: true });
		entries = dirEntries.filter((e) => e.isDirectory()).map((e) => e.name);
	} catch {
		// Skills directory doesn't exist
		return [];
	}

	const skills = await Promise.all(
		entries.map(async (name): Promise<SkillBrowserItem | null> => {
			const skillDir = path.join(skillsDir, name);
			const skillMdPath = path.join(skillDir, "SKILL.md");

			// A valid skill directory must have a SKILL.md
			try {
				await fs.access(skillMdPath);
			} catch {
				return null;
			}

			let description: string | undefined;
			let triggers: string[] | undefined;

			try {
				const content = await fs.readFile(skillMdPath, "utf8");
				const parsed = parseFrontmatter(content);
				description = parsed.frontmatter.description as string | undefined;
				triggers = parseSkillTriggers(content);

				// Fallback: extract description from first non-heading line after the title
				if (!description) {
					const lines = content
						.split("\n")
						.map((l) => l.trim())
						.filter(Boolean);
					// Skip frontmatter and headings to find first descriptive line
					for (const line of lines) {
						if (line.startsWith("---") || line.startsWith("#")) continue;
						if (line.length > 10 && line.length < 200) {
							description = line;
							break;
						}
					}
				}
			} catch {
				// SKILL.md unreadable — still include with empty metadata
			}

			const source = await detectSource(skillDir);

			return {
				name,
				description,
				triggers,
				source,
				installed: true, // If directory exists in ~/.claude/skills/, it's installed
			};
		}),
	);

	return skills
		.filter((s): s is SkillBrowserItem => s !== null)
		.sort((a, b) => a.name.localeCompare(b.name));
}

export function registerSkillBrowserRoutes(app: Express): void {
	// GET /api/skills/search?q=<query>&limit=<n> — BM25 search over skill catalog
	app.get("/api/skills/search", async (req: Request, res: Response) => {
		const rawQuery = String(req.query.q ?? "").trim();
		const rawLimit = String(req.query.limit ?? "10");

		if (!rawQuery) {
			res.status(400).json({ error: "Missing query parameter: q" });
			return;
		}

		// Security: cap query length and clamp limit
		const query = rawQuery.slice(0, 500);
		const limit = Math.min(100, Math.max(1, Number.parseInt(rawLimit, 10) || 10));

		try {
			// Use getSkillsDir() to match browse endpoint — both read from ~/.claude/skills/
			const skillsDir = getSkillsDir();

			const catalog = await skillCatalogGenerator.readOrRegenerate(skillsDir);
			const results = searchSkills(catalog.skills, query, limit, catalog.generated);

			// Paths are already relative in catalog entries — return as-is
			res.json({ results });
		} catch {
			res.status(500).json({ error: "Search failed" });
		}
	});

	// GET /api/skills/browse — list all installed skills with metadata
	app.get("/api/skills/browse", async (_req: Request, res: Response) => {
		try {
			const skills = await listSkills();
			res.json({ skills });
		} catch {
			res.status(500).json({ error: "Failed to browse skills" });
		}
	});

	// GET /api/skills/browse/:name — read SKILL.md content for a single skill
	app.get("/api/skills/browse/:name", async (req: Request, res: Response) => {
		const name = String(req.params.name);

		if (!isValidSkillName(name)) {
			res.status(400).json({ error: "Invalid skill name" });
			return;
		}

		const skillsDir = getSkillsDir();
		const skillDir = path.join(skillsDir, name);
		const skillMdPath = path.join(skillDir, "SKILL.md");

		// Ensure resolved path stays within skills dir (defense in depth)
		const resolvedPath = path.resolve(skillMdPath);
		const resolvedSkillsDir = path.resolve(skillsDir);
		if (!resolvedPath.startsWith(resolvedSkillsDir + path.sep)) {
			res.status(403).json({ error: "Access denied" });
			return;
		}

		try {
			const content = await fs.readFile(skillMdPath, "utf8");
			const parsed = parseFrontmatter(content);
			const source = await detectSource(skillDir);

			res.json({
				name,
				content,
				description: parsed.frontmatter.description as string | undefined,
				triggers: parseSkillTriggers(content),
				source,
				installed: true,
			});
		} catch (error) {
			const nodeError = error as NodeJS.ErrnoException;
			if (nodeError.code === "ENOENT") {
				res.status(404).json({ error: `Skill "${name}" not found` });
				return;
			}
			res.status(500).json({ error: "Failed to read skill" });
		}
	});
}
