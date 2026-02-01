/**
 * Skill API routes
 */

import { detectInstalledAgents, getAgentConfig } from "@/commands/skills/agents.js";
import { findSkillByName } from "@/commands/skills/skills-discovery.js";
import { installSkillToAgents } from "@/commands/skills/skills-installer.js";
import { readRegistry } from "@/commands/skills/skills-registry.js";
import { uninstallSkillFromAgent } from "@/commands/skills/skills-uninstaller.js";
import type { AgentType } from "@/commands/skills/types.js";
import { scanSkills } from "@/services/claude-data/index.js";
import type { Express, Request, Response } from "express";

export function registerSkillRoutes(app: Express): void {
	// GET /api/skills - List all skills from ~/.claude/skills/
	app.get("/api/skills", async (_req: Request, res: Response) => {
		try {
			const skills = await scanSkills();
			res.json(skills);
		} catch (error) {
			res.status(500).json({ error: "Failed to list skills" });
		}
	});

	// GET /api/skills/installed - Get installed skills with agent info
	app.get("/api/skills/installed", async (_req: Request, res: Response) => {
		try {
			const registry = await readRegistry();
			const installations = registry.installations.map((installation) => ({
				skillName: installation.skill,
				agent: installation.agent,
				installedAt: installation.installedAt,
				isGlobal: installation.global,
				path: installation.path,
			}));
			res.json({ installations });
		} catch (error) {
			res.status(500).json({ error: "Failed to get installed skills" });
		}
	});

	// GET /api/agents - List detected agents
	app.get("/api/agents", async (_req: Request, res: Response) => {
		try {
			const detectedAgents = await detectInstalledAgents();
			const allAgents: AgentType[] = [
				"claude-code",
				"cursor",
				"codex",
				"opencode",
				"goose",
				"gemini-cli",
				"antigravity",
				"github-copilot",
				"amp",
				"kilo",
				"roo",
				"windsurf",
				"cline",
				"openhands",
			];

			const agents = allAgents.map((agentType) => {
				const config = getAgentConfig(agentType);
				return {
					name: agentType,
					displayName: config.displayName,
					detected: detectedAgents.includes(agentType),
				};
			});

			res.json({ agents });
		} catch (error) {
			res.status(500).json({ error: "Failed to detect agents" });
		}
	});

	// POST /api/skills/install - Install skill to agents
	app.post("/api/skills/install", async (req: Request, res: Response) => {
		try {
			const { skillName, agents, global } = req.body;

			if (!skillName || typeof skillName !== "string") {
				res.status(400).json({ error: "skillName is required and must be a string" });
				return;
			}

			if (!Array.isArray(agents) || agents.length === 0) {
				res.status(400).json({ error: "agents is required and must be a non-empty array" });
				return;
			}

			// Find skill by name
			const skill = await findSkillByName(skillName);
			if (!skill) {
				res.status(404).json({ error: `Skill "${skillName}" not found` });
				return;
			}

			// Install to all requested agents
			const results = await installSkillToAgents(skill, agents as AgentType[], {
				global: global ?? true,
			});

			res.json({ results });
		} catch (error) {
			res.status(500).json({
				error: "Failed to install skill",
				message: error instanceof Error ? error.message : "Unknown error",
			});
		}
	});

	// POST /api/skills/uninstall - Uninstall skill from agents
	app.post("/api/skills/uninstall", async (req: Request, res: Response) => {
		try {
			const { skillName, agents } = req.body;

			if (!skillName || typeof skillName !== "string") {
				res.status(400).json({ error: "skillName is required and must be a string" });
				return;
			}

			if (!Array.isArray(agents) || agents.length === 0) {
				res.status(400).json({ error: "agents is required and must be a non-empty array" });
				return;
			}

			// Uninstall from each agent (try both global and project scopes)
			const results = await Promise.all(
				agents.map(async (agent: string) => {
					// Try global first, then project if global fails
					const globalResult = await uninstallSkillFromAgent(skillName, agent as AgentType, true);
					if (globalResult.success) {
						return globalResult;
					}

					const projectResult = await uninstallSkillFromAgent(skillName, agent as AgentType, false);
					if (projectResult.success) {
						return projectResult;
					}

					// If both fail, return the global result (will have error message)
					return globalResult;
				}),
			);

			res.json({ results });
		} catch (error) {
			res.status(500).json({
				error: "Failed to uninstall skill",
				message: error instanceof Error ? error.message : "Unknown error",
			});
		}
	});
}
