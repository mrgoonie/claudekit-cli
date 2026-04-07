/**
 * Agents browser API routes
 *
 * Provides endpoints for browsing Claude Code agents installed in ~/.claude/agents
 * and project-level .claude/agents directories.
 */

import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, relative } from "node:path";
import { parseFrontmatterFile } from "@/commands/portable/frontmatter-parser.js";
import { getProjectLayoutCandidates } from "@/shared/kit-layout.js";
import type { Express, Request, Response } from "express";

const home = homedir();

/** Agent information returned by API */
export interface AgentListItem {
	slug: string;
	name: string;
	description: string;
	model: string | null;
	color: string | null;
	skillCount: number;
	/** Directory label for grouping (e.g. "~/.claude/agents", ".claude/agents") */
	dirLabel: string;
	/** Relative path to agent file (e.g. "agents/code-reviewer.md") */
	relativePath: string;
}

/** Full agent detail returned by /api/agents/browser/:slug */
export interface AgentDetail extends AgentListItem {
	frontmatter: Record<string, unknown>;
	body: string;
}

/** Resolve all agent source directories to search */
function resolveAgentDirs(): Array<{ path: string; label: string }> {
	const dirs: Array<{ path: string; label: string }> = [];

	// Project-level agents (process.cwd())
	const projectCandidates = getProjectLayoutCandidates(process.cwd(), "agents");
	for (const candidate of projectCandidates) {
		if (candidate) {
			const rel = relative(process.cwd(), candidate);
			dirs.push({ path: candidate, label: rel });
		}
	}

	// Global ~/.claude/agents
	const globalPath = join(home, ".claude", "agents");
	dirs.push({ path: globalPath, label: "~/.claude/agents" });

	// Deduplicate by path
	const seen = new Set<string>();
	return dirs.filter(({ path }) => {
		if (seen.has(path)) return false;
		seen.add(path);
		return true;
	});
}

/** Extract skill count from frontmatter tools field */
function countSkills(tools: unknown): number {
	if (!tools || typeof tools !== "string") return 0;
	return tools
		.split(",")
		.map((t) => t.trim())
		.filter((t) => t.length > 0).length;
}

/**
 * Scan agents from a directory and return list items.
 * Silently skips missing directories.
 */
async function scanAgentDir(dirPath: string, dirLabel: string): Promise<AgentListItem[]> {
	const items: AgentListItem[] = [];
	try {
		const entries = await readdir(dirPath, { withFileTypes: true });
		for (const entry of entries) {
			if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
			const filePath = join(dirPath, entry.name);
			try {
				const { frontmatter } = await parseFrontmatterFile(filePath);
				const slug = entry.name.replace(/\.md$/, "");
				items.push({
					slug,
					name: (frontmatter.name as string) || slug,
					description: (frontmatter.description as string) || "",
					model: (frontmatter.model as string) || null,
					color: (frontmatter.color as string) || null,
					skillCount: countSkills(frontmatter.tools),
					dirLabel,
					relativePath: relative(homedir(), filePath),
				});
			} catch {
				// Skip unparseable files
			}
		}
	} catch {
		// Directory doesn't exist or unreadable — silently skip
	}
	return items.sort((a, b) => a.name.localeCompare(b.name));
}

export function registerAgentsBrowserRoutes(app: Express): void {
	// GET /api/agents/browser - List all agents grouped by directory
	app.get("/api/agents/browser", async (_req: Request, res: Response) => {
		try {
			const dirs = resolveAgentDirs();
			const allAgents: AgentListItem[] = [];

			for (const dir of dirs) {
				const agents = await scanAgentDir(dir.path, dir.label);
				allAgents.push(...agents);
			}

			res.json({ agents: allAgents, total: allAgents.length });
		} catch (error) {
			res.status(500).json({ error: "Failed to list agents" });
		}
	});

	// GET /api/agents/browser/:slug - Get single agent detail
	app.get("/api/agents/browser/:slug", async (req: Request, res: Response) => {
		const slug = String(req.params.slug);

		// Basic slug validation — alphanumeric, hyphens, underscores only
		if (!/^[\w-]+$/.test(slug)) {
			res.status(400).json({ error: "Invalid agent slug" });
			return;
		}

		const dirs = resolveAgentDirs();

		for (const dir of dirs) {
			const filePath = join(dir.path, `${slug}.md`);

			// Security: ensure resolved path stays within the agent dir (cross-platform)
			const rel = relative(dir.path, filePath);
			if (rel.startsWith("..") || isAbsolute(rel)) {
				continue;
			}

			try {
				const { frontmatter, body } = await parseFrontmatterFile(filePath);
				const detail: AgentDetail = {
					slug,
					name: (frontmatter.name as string) || slug,
					description: (frontmatter.description as string) || "",
					model: (frontmatter.model as string) || null,
					color: (frontmatter.color as string) || null,
					skillCount: countSkills(frontmatter.tools),
					dirLabel: dir.label,
					relativePath: relative(homedir(), filePath),
					frontmatter: frontmatter as Record<string, unknown>,
					body,
				};
				res.json(detail);
				return;
			} catch {
				// File not readable in this dir, try next
			}
		}

		res.status(404).json({ error: "Agent not found" });
	});
}
