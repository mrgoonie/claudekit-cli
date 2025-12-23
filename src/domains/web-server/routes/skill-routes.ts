/**
 * Skill API routes
 */

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
}
