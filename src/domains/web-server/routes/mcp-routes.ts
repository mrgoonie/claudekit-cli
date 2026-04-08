/**
 * MCP server routes — multi-source discovery from all known config locations
 * Sources: ~/.claude/settings.json mcpServers, ~/.claude/.mcp.json, project-level .mcp.json
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { ProjectsRegistryManager } from "@/domains/claudekit-data/index.js";
import { readSettings } from "@/services/claude-data/index.js";
import type { Express, Request, Response } from "express";

export interface McpServerEntry {
	name: string;
	command: string;
	args: string[];
	/** Env var names only — values redacted for security */
	envKeys?: string[];
	source: string;
	sourceLabel: string;
}

interface RawMcpServerConfig {
	command?: unknown;
	args?: unknown;
	env?: unknown;
	[key: string]: unknown;
}

/**
 * Parse a raw mcpServers record into McpServerEntry array.
 * Skips entries with missing/invalid command.
 */
function parseMcpServers(
	raw: Record<string, unknown>,
	source: string,
	sourceLabel: string,
): McpServerEntry[] {
	const entries: McpServerEntry[] = [];
	for (const [name, value] of Object.entries(raw)) {
		if (!value || typeof value !== "object") continue;
		const config = value as RawMcpServerConfig;
		if (typeof config.command !== "string" || !config.command) continue;

		const args: string[] = Array.isArray(config.args)
			? config.args.filter((a): a is string => typeof a === "string")
			: [];

		// Expose env var NAMES only — never expose values (may contain API keys/secrets)
		let envKeys: string[] | undefined;
		if (config.env && typeof config.env === "object" && !Array.isArray(config.env)) {
			const keys = Object.keys(config.env as Record<string, unknown>);
			if (keys.length > 0) envKeys = keys;
		}

		entries.push({ name, command: config.command, args, envKeys, source, sourceLabel });
	}
	return entries;
}

/**
 * Read and parse a .mcp.json file. Returns empty array on any error.
 */
async function readMcpJson(
	filePath: string,
	source: string,
	sourceLabel: string,
): Promise<McpServerEntry[]> {
	try {
		if (!existsSync(filePath)) return [];
		const content = await readFile(filePath, "utf-8");
		const parsed = JSON.parse(content) as Record<string, unknown>;
		// .mcp.json can have top-level mcpServers key OR be flat
		const servers =
			parsed.mcpServers &&
			typeof parsed.mcpServers === "object" &&
			!Array.isArray(parsed.mcpServers)
				? (parsed.mcpServers as Record<string, unknown>)
				: parsed;
		return parseMcpServers(servers, source, sourceLabel);
	} catch {
		return [];
	}
}

/**
 * Merge server lists — first source wins for duplicate names.
 */
function mergeServers(lists: McpServerEntry[][]): McpServerEntry[] {
	const seen = new Set<string>();
	const merged: McpServerEntry[] = [];
	for (const list of lists) {
		for (const server of list) {
			if (!seen.has(server.name)) {
				seen.add(server.name);
				merged.push(server);
			}
		}
	}
	return merged;
}

/**
 * Security: validate that project path is safe (no traversal, exists, is directory).
 */
function isSafeProjectPath(projectPath: string): boolean {
	// Check raw input for traversal before resolve() normalises it away
	if (projectPath.includes("..")) return false;
	const home = homedir();
	try {
		const resolved = resolve(projectPath);
		if (!resolved.startsWith(home)) return false;
		return existsSync(resolved);
	} catch {
		return false;
	}
}

export function registerMcpRoutes(app: Express): void {
	// GET /api/mcp-servers — discover MCP servers from all sources
	app.get("/api/mcp-servers", async (_req: Request, res: Response) => {
		try {
			const claudeDir = join(homedir(), ".claude");
			const allLists: McpServerEntry[][] = [];

			// Source 1: ~/.claude/settings.json → mcpServers
			try {
				const settings = await readSettings();
				if (settings?.mcpServers && typeof settings.mcpServers === "object") {
					const entries = parseMcpServers(
						settings.mcpServers as Record<string, unknown>,
						"settings.json",
						"settings.json",
					);
					allLists.push(entries);
				}
			} catch {
				// Non-fatal — continue with other sources
			}

			// Source 2: ~/.claude.json → mcpServers (Claude Code's own config)
			try {
				const claudeJsonPath = join(homedir(), ".claude.json");
				if (existsSync(claudeJsonPath)) {
					const content = await readFile(claudeJsonPath, "utf-8");
					const parsed = JSON.parse(content) as Record<string, unknown>;
					if (parsed.mcpServers && typeof parsed.mcpServers === "object") {
						const entries = parseMcpServers(
							parsed.mcpServers as Record<string, unknown>,
							"claude.json",
							"~/.claude.json",
						);
						if (entries.length > 0) allLists.push(entries);
					}
				}
			} catch {
				// Non-fatal
			}

			// Source 3: ~/.claude/.mcp.json (standalone MCP config)
			const globalMcpJsonPath = join(claudeDir, ".mcp.json");
			const globalMcpEntries = await readMcpJson(globalMcpJsonPath, ".mcp.json", ".mcp.json");
			if (globalMcpEntries.length > 0) {
				allLists.push(globalMcpEntries);
			}

			// Source 4: project-level .mcp.json files (registered projects)
			try {
				const registeredProjects = await ProjectsRegistryManager.listProjects();
				for (const project of registeredProjects) {
					if (!isSafeProjectPath(project.path)) continue;
					const projectMcpPath = join(project.path, ".mcp.json");
					if (!existsSync(projectMcpPath)) continue;

					const projectName = project.alias || basename(project.path);
					const source = `project:${project.path}`;
					const sourceLabel = `Project: ${projectName}`;
					const entries = await readMcpJson(projectMcpPath, source, sourceLabel);
					if (entries.length > 0) {
						allLists.push(entries);
					}
				}
			} catch {
				// Non-fatal — registry may be empty or unavailable
			}

			const servers = mergeServers(allLists);
			res.json({ servers });
		} catch {
			res.status(500).json({ error: "Failed to discover MCP servers" });
		}
	});
}
