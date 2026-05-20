/**
 * Dashboard stats API routes
 * Aggregates entity counts, model distribution, agents list, and suggestions
 */

import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseFrontmatterFile } from "@/commands/portable/frontmatter-parser.js";
import { countMcpServers, readSettings } from "@/services/claude-data/index.js";
import type { Express, Request, Response } from "express";

const claudeDir = join(homedir(), ".claude");

export interface AgentEntry {
	name: string;
	model: string;
	description: string;
	color?: string;
}

/** Read all agent .md files from ~/.claude/agents/ */
async function readAgents(): Promise<AgentEntry[]> {
	const agentsDir = join(claudeDir, "agents");
	if (!existsSync(agentsDir)) return [];
	try {
		const files = await readdir(agentsDir);
		const mdFiles = files.filter((f) => f.endsWith(".md"));
		const agents = await Promise.all(
			mdFiles.map(async (file): Promise<AgentEntry | null> => {
				try {
					const { frontmatter: fm } = await parseFrontmatterFile(join(agentsDir, file));
					return {
						name: (fm.name as string) || file.replace(/\.md$/, ""),
						model: (fm.model as string) || "unset",
						description: (fm.description as string) || "",
						color: fm.color as string | undefined,
					};
				} catch {
					return null;
				}
			}),
		);
		return agents.filter((a): a is AgentEntry => a !== null);
	} catch {
		return [];
	}
}

/** Count .md files in a directory recursively (non-throwing, race-safe) */
async function countMdFilesRecursive(dir: string, depth = 0): Promise<number> {
	if (!existsSync(dir) || depth > 10) return 0;
	try {
		const entries = await readdir(dir, { withFileTypes: true });
		const counts = await Promise.all(
			entries.map(async (entry) => {
				if (entry.isDirectory()) {
					return countMdFilesRecursive(join(dir, entry.name), depth + 1);
				}
				return entry.name.endsWith(".md") ? 1 : 0;
			}),
		);
		return counts.reduce((sum, c) => sum + c, 0);
	} catch {
		return 0;
	}
}

/** Count SKILL.md files in ~/.claude/skills/ (each dir with SKILL.md = 1 skill) */
async function countSkills(): Promise<number> {
	const skillsDir = join(claudeDir, "skills");
	if (!existsSync(skillsDir)) return 0;
	try {
		const entries = await readdir(skillsDir);
		let count = 0;
		for (const entry of entries) {
			if (existsSync(join(skillsDir, entry, "SKILL.md"))) count++;
		}
		return count;
	} catch {
		return 0;
	}
}

/** Count MCP servers from settings.json + ~/.claude.json + .mcp.json */
async function countAllMcpServers(): Promise<number> {
	const settings = await readSettings();
	const baseCount = settings ? countMcpServers(settings) : 0;
	const seen = new Set<string>();

	// Track names from settings.json to avoid double-counting
	if (settings?.mcpServers && typeof settings.mcpServers === "object") {
		for (const name of Object.keys(settings.mcpServers as Record<string, unknown>)) {
			seen.add(name);
		}
	}

	// ~/.claude.json → mcpServers (Claude Code's own config)
	let claudeJsonCount = 0;
	try {
		const claudeJsonPath = join(homedir(), ".claude.json");
		if (existsSync(claudeJsonPath)) {
			const content = await readFile(claudeJsonPath, "utf-8");
			const data = JSON.parse(content) as Record<string, unknown>;
			if (data.mcpServers && typeof data.mcpServers === "object") {
				for (const name of Object.keys(data.mcpServers as Record<string, unknown>)) {
					if (!seen.has(name)) {
						seen.add(name);
						claudeJsonCount++;
					}
				}
			}
		}
	} catch {
		// Non-fatal
	}

	// ~/.claude/.mcp.json
	let mcpJsonCount = 0;
	const mcpJsonPath = join(claudeDir, ".mcp.json");
	try {
		if (existsSync(mcpJsonPath)) {
			const content = await readFile(mcpJsonPath, "utf-8");
			const data = JSON.parse(content) as Record<string, unknown>;
			if (data.mcpServers && typeof data.mcpServers === "object") {
				for (const name of Object.keys(data.mcpServers as Record<string, unknown>)) {
					if (!seen.has(name)) {
						seen.add(name);
						mcpJsonCount++;
					}
				}
			}
		}
	} catch {
		// Non-fatal
	}

	return baseCount + claudeJsonCount + mcpJsonCount;
}

function classifyModel(model: string): "opus" | "sonnet" | "haiku" | "unset" {
	const lower = model.toLowerCase();
	if (lower === "unset" || !lower) return "unset";
	if (lower.includes("opus")) return "opus";
	if (lower.includes("haiku")) return "haiku";
	if (lower.includes("sonnet")) return "sonnet";
	return "unset";
}

export function registerDashboardRoutes(app: Express): void {
	// GET /api/dashboard/stats
	app.get("/api/dashboard/stats", async (_req: Request, res: Response) => {
		try {
			const [agents, commandCount, skillCount, mcpCount] = await Promise.all([
				readAgents(),
				countMdFilesRecursive(join(claudeDir, "commands")),
				countSkills(),
				countAllMcpServers(),
			]);

			const modelDistribution = { opus: 0, sonnet: 0, haiku: 0, unset: 0 };
			for (const agent of agents) {
				const tier = classifyModel(agent.model);
				modelDistribution[tier]++;
			}

			res.json({
				agents: agents.length,
				commands: commandCount,
				skills: skillCount,
				mcpServers: mcpCount,
				modelDistribution,
			});
		} catch (error) {
			res.status(500).json({ error: "Failed to load dashboard stats" });
		}
	});

	// GET /api/agents/list — top agents for dashboard display
	app.get("/api/agents/list", async (_req: Request, res: Response) => {
		try {
			const agents = await readAgents();
			res.json({ agents: agents.slice(0, 6) });
		} catch (error) {
			res.status(500).json({ error: "Failed to load agents" });
		}
	});

	// GET /api/suggestions — analyze config for warnings
	app.get("/api/suggestions", async (_req: Request, res: Response) => {
		try {
			const agents = await readAgents();
			const suggestions: Array<{
				type: "warning" | "info" | "success";
				message: string;
				target?: string;
			}> = [];

			const unsetCount = agents.filter((a) => classifyModel(a.model) === "unset").length;
			if (unsetCount > 0) {
				suggestions.push({
					type: "warning",
					message: `${unsetCount} agent${unsetCount > 1 ? "s" : ""} have no model set`,
					target: "agents",
				});
			}

			const skillCount = await countSkills();
			if (skillCount === 0) {
				suggestions.push({
					type: "info",
					message: "No skills installed — browse the Skills Marketplace",
					target: "skills",
				});
			}

			const settings = await readSettings();
			if (!settings) {
				suggestions.push({
					type: "warning",
					message: "No ~/.claude/settings.json found — run ck init to create one",
				});
			}

			if (agents.length === 0) {
				suggestions.push({
					type: "info",
					message: "No agents configured in ~/.claude/agents/",
					target: "agents",
				});
			}

			if (suggestions.length === 0) {
				suggestions.push({
					type: "success",
					message: "Everything looks good!",
				});
			}

			res.json({ suggestions });
		} catch (error) {
			res.status(500).json({ error: "Failed to load suggestions" });
		}
	});
}
