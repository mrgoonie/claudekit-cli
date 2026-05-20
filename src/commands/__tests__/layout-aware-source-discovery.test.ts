import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getAgentSourcePath } from "../agents/agents-discovery.js";
import { getCommandSourcePath } from "../commands/commands-discovery.js";

describe("layout-aware source discovery", () => {
	const testDir = join(tmpdir(), "claudekit-layout-aware-discovery-test");

	beforeAll(() => {
		mkdirSync(testDir, { recursive: true });
	});

	afterAll(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	it("prefers claude/agents when package metadata opts in", () => {
		const projectDir = join(testDir, "agents-project");
		const originalCwd = process.cwd();
		mkdirSync(join(projectDir, "claude", "agents"), { recursive: true });
		writeFileSync(
			join(projectDir, "package.json"),
			JSON.stringify({
				claudekit: {
					sourceDir: "claude",
					runtimeDir: ".claude",
				},
			}),
		);
		writeFileSync(join(projectDir, "claude", "agents", "planner.md"), "# Planner");

		process.chdir(projectDir);
		try {
			expect(getAgentSourcePath()).toBe(realpathSync(join(projectDir, "claude", "agents")));
		} finally {
			process.chdir(originalCwd);
		}
	});

	it("prefers claude/commands when package metadata opts in", () => {
		const projectDir = join(testDir, "commands-project");
		const originalCwd = process.cwd();
		mkdirSync(join(projectDir, "claude", "commands"), { recursive: true });
		writeFileSync(
			join(projectDir, "package.json"),
			JSON.stringify({
				claudekit: {
					sourceDir: "claude",
					runtimeDir: ".claude",
				},
			}),
		);
		writeFileSync(join(projectDir, "claude", "commands", "plan.md"), "# Plan");

		process.chdir(projectDir);
		try {
			expect(getCommandSourcePath()).toBe(realpathSync(join(projectDir, "claude", "commands")));
		} finally {
			process.chdir(originalCwd);
		}
	});
});
