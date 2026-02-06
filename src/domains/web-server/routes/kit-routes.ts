/**
 * Kit inventory API routes
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Express, Request, Response } from "express";

interface KitInventory {
	skills: Array<{
		name: string;
		description: string;
		hasScript: boolean;
		hasDeps: boolean;
	}>;
	agents: Array<{
		name: string;
		description: string;
		fileName: string;
	}>;
	hooks: Array<{
		event: string;
		command: string;
		fileName: string;
	}>;
	rules: Array<{
		name: string;
		fileName: string;
	}>;
	commands: Array<{
		name: string;
		fileName: string;
		isNested: boolean;
	}>;
	metadata: {
		name: string;
		version: string;
		buildDate: string;
	};
}

interface GitHubRelease {
	tag_name: string;
	name: string;
	published_at: string;
	body: string;
}

// Cache for GitHub releases (30 min TTL)
let changelogCache: {
	data: GitHubRelease[];
	timestamp: number;
} | null = null;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export function registerKitRoutes(app: Express): void {
	// GET /api/kits/inventory - Full kit inventory
	app.get("/api/kits/inventory", async (_req: Request, res: Response) => {
		try {
			const homeDir = os.homedir();
			const claudeDir = path.join(homeDir, ".claude");

			const inventory: KitInventory = {
				skills: await scanSkills(claudeDir),
				agents: await scanAgents(claudeDir),
				hooks: await scanHooks(claudeDir),
				rules: await scanRules(claudeDir),
				commands: await scanCommands(claudeDir),
				metadata: await readMetadata(claudeDir),
			};

			res.json(inventory);
		} catch (error) {
			res.status(500).json({
				error: "Failed to get kit inventory",
				message: error instanceof Error ? error.message : "Unknown error",
			});
		}
	});

	// GET /api/kits/changelog - Recent releases from GitHub
	app.get("/api/kits/changelog", async (_req: Request, res: Response) => {
		try {
			// Check cache
			if (changelogCache && Date.now() - changelogCache.timestamp < CACHE_TTL) {
				res.json(changelogCache.data);
				return;
			}

			// Fetch from GitHub
			const response = await fetch(
				"https://api.github.com/repos/mrgoonie/claudekit-engineer/releases?per_page=5",
				{
					headers: {
						Accept: "application/vnd.github+json",
						"User-Agent": "ClaudeKit-CLI",
					},
				},
			);

			if (!response.ok) {
				throw new Error(`GitHub API responded with ${response.status}`);
			}

			const releases = (await response.json()) as GitHubRelease[];

			// Update cache
			changelogCache = {
				data: releases,
				timestamp: Date.now(),
			};

			res.json(releases);
		} catch (error) {
			res.status(500).json({
				error: "Failed to fetch changelog",
				message: error instanceof Error ? error.message : "Unknown error",
			});
		}
	});
}

/**
 * Scan skills from ~/.claude/skills/
 */
async function scanSkills(claudeDir: string): Promise<KitInventory["skills"]> {
	const skillsDir = path.join(claudeDir, "skills");

	try {
		const entries = await fs.readdir(skillsDir, { withFileTypes: true });
		const skills = await Promise.all(
			entries
				.filter((entry) => entry.isDirectory())
				.map(async (entry) => {
					const skillPath = path.join(skillsDir, entry.name);
					const skillMdPath = path.join(skillPath, "SKILL.md");

					let description = "";
					try {
						const skillContent = await fs.readFile(skillMdPath, "utf-8");
						// Extract first line (after any markdown headings)
						const lines = skillContent.split("\n");
						for (const line of lines) {
							const trimmed = line.trim();
							if (trimmed && !trimmed.startsWith("#")) {
								description = trimmed;
								break;
							}
						}
					} catch {
						// SKILL.md not found or unreadable
					}

					// Check for scripts directory
					let hasScript = false;
					try {
						const scriptsDir = path.join(skillPath, "scripts");
						await fs.access(scriptsDir);
						hasScript = true;
					} catch {
						// No scripts directory
					}

					// Check for dependencies
					let hasDeps = false;
					try {
						const requirementsPath = path.join(skillPath, "requirements.txt");
						await fs.access(requirementsPath);
						hasDeps = true;
					} catch {
						try {
							const packageJsonPath = path.join(skillPath, "package.json");
							await fs.access(packageJsonPath);
							hasDeps = true;
						} catch {
							// No dependencies
						}
					}

					return {
						name: entry.name,
						description,
						hasScript,
						hasDeps,
					};
				}),
		);

		return skills;
	} catch (error) {
		// Skills directory doesn't exist
		return [];
	}
}

/**
 * Scan agents from ~/.claude/agents/
 */
async function scanAgents(claudeDir: string): Promise<KitInventory["agents"]> {
	const agentsDir = path.join(claudeDir, "agents");

	try {
		const entries = await fs.readdir(agentsDir, { withFileTypes: true });
		const agents = await Promise.all(
			entries
				.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
				.map(async (entry) => {
					const agentPath = path.join(agentsDir, entry.name);
					let description = "";

					try {
						const content = await fs.readFile(agentPath, "utf-8");
						const lines = content.split("\n");

						// Find first heading and first paragraph
						let foundHeading = false;
						for (const line of lines) {
							const trimmed = line.trim();
							if (trimmed.startsWith("#")) {
								foundHeading = true;
								continue;
							}
							if (foundHeading && trimmed && !trimmed.startsWith("#")) {
								description = trimmed;
								break;
							}
						}
					} catch {
						// File unreadable
					}

					return {
						name: entry.name.replace(/\.md$/, ""),
						description,
						fileName: entry.name,
					};
				}),
		);

		return agents;
	} catch (error) {
		// Agents directory doesn't exist
		return [];
	}
}

/**
 * Scan hooks from ~/.claude/settings.json
 */
async function scanHooks(claudeDir: string): Promise<KitInventory["hooks"]> {
	const settingsPath = path.join(claudeDir, "settings.json");

	try {
		const content = await fs.readFile(settingsPath, "utf-8");
		const settings = JSON.parse(content);

		if (!Array.isArray(settings.hooks)) {
			return [];
		}

		return settings.hooks.map((hook: { event: string; command: string }) => ({
			event: hook.event,
			command: hook.command,
			fileName: path.basename(hook.command),
		}));
	} catch (error) {
		// Settings file doesn't exist or invalid JSON
		return [];
	}
}

/**
 * Scan rules from ~/.claude/rules/
 */
async function scanRules(claudeDir: string): Promise<KitInventory["rules"]> {
	const rulesDir = path.join(claudeDir, "rules");

	try {
		const entries = await fs.readdir(rulesDir, { withFileTypes: true });
		const rules = entries
			.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
			.map((entry) => ({
				name: entry.name.replace(/\.md$/, ""),
				fileName: entry.name,
			}));

		return rules;
	} catch (error) {
		// Rules directory doesn't exist
		return [];
	}
}

/**
 * Scan commands from ~/.claude/commands/
 */
async function scanCommands(claudeDir: string): Promise<KitInventory["commands"]> {
	const commandsDir = path.join(claudeDir, "commands");

	try {
		const commands: KitInventory["commands"] = [];

		// Read root level commands
		const rootEntries = await fs.readdir(commandsDir, { withFileTypes: true });
		for (const entry of rootEntries) {
			if (entry.isFile() && entry.name.endsWith(".md")) {
				commands.push({
					name: entry.name.replace(/\.md$/, ""),
					fileName: entry.name,
					isNested: false,
				});
			} else if (entry.isDirectory()) {
				// Read nested commands
				const nestedPath = path.join(commandsDir, entry.name);
				const nestedEntries = await fs.readdir(nestedPath, {
					withFileTypes: true,
				});
				for (const nestedEntry of nestedEntries) {
					if (nestedEntry.isFile() && nestedEntry.name.endsWith(".md")) {
						commands.push({
							name: `${entry.name}/${nestedEntry.name.replace(/\.md$/, "")}`,
							fileName: nestedEntry.name,
							isNested: true,
						});
					}
				}
			}
		}

		return commands;
	} catch (error) {
		// Commands directory doesn't exist
		return [];
	}
}

/**
 * Read metadata from ~/.claude/metadata.json
 */
async function readMetadata(claudeDir: string): Promise<KitInventory["metadata"]> {
	const metadataPath = path.join(claudeDir, "metadata.json");

	try {
		const content = await fs.readFile(metadataPath, "utf-8");
		const metadata = JSON.parse(content);

		return {
			name: metadata.name || "Unknown",
			version: metadata.version || "0.0.0",
			buildDate: metadata.buildDate || "",
		};
	} catch (error) {
		// Metadata file doesn't exist or invalid JSON
		return {
			name: "Unknown",
			version: "0.0.0",
			buildDate: "",
		};
	}
}
