import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

	async function captureWarnings<T>(
		fn: () => Promise<T>,
	): Promise<{ result: T; warnings: string[] }> {
		const originalLog = console.log;
		const warnings: string[] = [];

		console.log = (...args: unknown[]) => {
			const message = args.map(String).join(" ");
			if (message.includes("Failed to parse frontmatter")) {
				warnings.push(message);
			}
		};

		try {
			const result = await fn();
			return { result, warnings };
		} finally {
			console.log = originalLog;
		}
	}

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

		const { result: commands, warnings } = await captureWarnings(() =>
			discoverCommands(commandsDir),
		);

		expect(warnings).toEqual([]);
		expect(commands).toHaveLength(1);
		expect(commands[0].description).toBe("Create API_SPEC.md + DB_DESIGN.md (Stage 3: Detail)");
		expect(commands[0].frontmatter.argumentHint).toBe("[path1] [path2] ... or monorepo path");
		expect(commands[0].body).toContain("# Plan");
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

		const { result: agents, warnings } = await captureWarnings(() => discoverAgents(agentsDir));

		expect(warnings).toEqual([]);
		expect(agents).toHaveLength(1);
		expect(agents[0].displayName).toBe("Project Planner");
		expect(agents[0].description).toBe("Create SRD.md + UI_SPEC.md (Stage 1: Specification)");
		expect(agents[0].body).toContain("# Planner");
	});
});
