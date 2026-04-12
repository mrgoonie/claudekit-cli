import { afterAll, beforeAll, describe, expect, it, spyOn } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { logger } from "../../shared/logger.js";
import { discoverAgents } from "../agents/agents-discovery.js";
import { discoverCommands } from "../commands/commands-discovery.js";

describe("frontmatter discovery with BOM-prefixed markdown", () => {
	const testDir = join(tmpdir(), "claudekit-frontmatter-bom-discovery-test");

	beforeAll(() => {
		mkdirSync(testDir, { recursive: true });
	});

	afterAll(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	it("recovers BOM-prefixed command frontmatter without warning", async () => {
		const commandsDir = join(testDir, "commands");
		mkdirSync(commandsDir, { recursive: true });
		writeFileSync(
			join(commandsDir, "plan.md"),
			`\uFEFF---
description: Create API_SPEC.md + DB_DESIGN.md (Stage 3: Detail)
argument-hint: [path1] [path2] ... or monorepo path
---

# Plan
`,
		);

		const warningSpy = spyOn(logger, "warning").mockImplementation(() => {});
		try {
			const commands = await discoverCommands(commandsDir);

			expect(warningSpy).not.toHaveBeenCalledWith(
				expect.stringContaining("Failed to parse frontmatter"),
			);
			expect(commands).toHaveLength(1);
			expect(commands[0].description).toBe("Create API_SPEC.md + DB_DESIGN.md (Stage 3: Detail)");
			expect(commands[0].frontmatter.argumentHint).toBe("[path1] [path2] ... or monorepo path");
			expect(commands[0].body).toContain("# Plan");
		} finally {
			warningSpy.mockRestore();
		}
	});

	it("recovers BOM-prefixed agent frontmatter without warning", async () => {
		const agentsDir = join(testDir, "agents");
		mkdirSync(agentsDir, { recursive: true });
		writeFileSync(
			join(agentsDir, "planner.md"),
			`\uFEFF---
name: Project Planner
description: Create SRD.md + UI_SPEC.md (Stage 1: Specification)
---

# Planner
`,
		);

		const warningSpy = spyOn(logger, "warning").mockImplementation(() => {});
		try {
			const agents = await discoverAgents(agentsDir);

			expect(warningSpy).not.toHaveBeenCalledWith(
				expect.stringContaining("Failed to parse frontmatter"),
			);
			expect(agents).toHaveLength(1);
			expect(agents[0].displayName).toBe("Project Planner");
			expect(agents[0].description).toBe("Create SRD.md + UI_SPEC.md (Stage 1: Specification)");
			expect(agents[0].body).toContain("# Planner");
		} finally {
			warningSpy.mockRestore();
		}
	});
});
