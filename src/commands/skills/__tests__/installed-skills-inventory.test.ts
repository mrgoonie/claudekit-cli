import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getActiveClaudeSkillInstallations } from "../installed-skills-inventory.js";

describe("getActiveClaudeSkillInstallations", () => {
	let testRoot: string;
	let projectDir: string;
	let globalDir: string;

	beforeEach(async () => {
		testRoot = join(
			tmpdir(),
			`ck-installed-skills-inventory-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		projectDir = join(testRoot, "project");
		globalDir = join(testRoot, "home", ".claude");
	});

	afterEach(async () => {
		await rm(testRoot, { recursive: true, force: true });
	});

	test("lists active Claude Code skills from project and global scopes", async () => {
		await writeSkill(join(projectDir, ".claude", "skills"), "cook");
		await writeSkill(join(globalDir, "skills"), "ask");

		const installed = await getActiveClaudeSkillInstallations({ projectDir, globalDir });

		expect(installed.map((entry) => `${entry.skill}:${entry.scope}`)).toEqual([
			"ask:global",
			"cook:project",
		]);
		expect(installed.every((entry) => !entry.duplicateAcrossScopes)).toBe(true);
	});

	test("marks duplicate project/global skill ids", async () => {
		await writeSkill(join(projectDir, ".claude", "skills"), "agent-browser", "ck:agent-browser");
		await writeSkill(join(globalDir, "skills"), "agent-browser", "ck:agent-browser");

		const installed = await getActiveClaudeSkillInstallations({ projectDir, globalDir });

		expect(installed).toHaveLength(2);
		expect(installed.map((entry) => entry.scope).sort()).toEqual(["global", "project"]);
		expect(installed.every((entry) => entry.skill === "agent-browser")).toBe(true);
		expect(installed.every((entry) => entry.duplicateAcrossScopes)).toBe(true);
	});

	test("does not double-count global skills when project dir is home", async () => {
		const homeDir = join(testRoot, "home");
		const homeGlobalDir = join(homeDir, ".claude");
		await writeSkill(join(homeGlobalDir, "skills"), "cook");

		const installed = await getActiveClaudeSkillInstallations({
			projectDir: homeDir,
			globalDir: homeGlobalDir,
		});

		expect(installed.map((entry) => `${entry.skill}:${entry.scope}`)).toEqual(["cook:global"]);
		expect(installed.every((entry) => !entry.duplicateAcrossScopes)).toBe(true);
	});
});

async function writeSkill(skillsDir: string, dirName: string, frontmatterName = dirName) {
	const skillDir = join(skillsDir, dirName);
	await mkdir(skillDir, { recursive: true });
	await writeFile(
		join(skillDir, "SKILL.md"),
		["---", `name: ${frontmatterName}`, "description: Test skill", "---", "", "Body"].join("\n"),
	);
}
