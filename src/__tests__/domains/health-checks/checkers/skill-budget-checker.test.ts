import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkSkillBudget } from "@/domains/health-checks/checkers/skill-budget-checker.js";
import type { ClaudeKitSetup } from "@/types";

describe("checkSkillBudget", () => {
	let tempDir: string;
	let projectDir: string;
	let originalCkTestHome: string | undefined;

	beforeEach(async () => {
		tempDir = join(
			tmpdir(),
			`skill-budget-checker-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		projectDir = join(tempDir, "project");
		await mkdir(projectDir, { recursive: true });
		originalCkTestHome = process.env.CK_TEST_HOME;
		process.env.CK_TEST_HOME = tempDir;
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
		if (originalCkTestHome === undefined) {
			process.env.CK_TEST_HOME = undefined;
		} else {
			process.env.CK_TEST_HOME = originalCkTestHome;
		}
	});

	test("flags missing project budget settings and fixes them", async () => {
		await writeSkill(join(projectDir, ".claude", "skills"), "cook", {
			userInvocable: false,
		});

		const results = await checkSkillBudget(createEngineerSetup(), projectDir);
		const budget = resultById(results, "ck-skill-listing-budget");

		expect(budget.status).toBe("fail");
		expect(budget.autoFixable).toBe(true);
		expect(budget.fix).toBeDefined();

		const fix = await budget.fix?.execute();
		expect(fix?.success).toBe(true);

		const settings = JSON.parse(
			await readFile(join(projectDir, ".claude", "settings.json"), "utf8"),
		);
		expect(settings.skillListingBudgetFraction).toBe(0.03);
		expect(settings.skillListingMaxDescChars).toBe(512);
	});

	test("passes when project budget settings are already safe", async () => {
		await writeSkill(join(projectDir, ".claude", "skills"), "cook", {
			userInvocable: false,
		});
		await writeFile(
			join(projectDir, ".claude", "settings.json"),
			JSON.stringify({ skillListingBudgetFraction: 0.05, skillListingMaxDescChars: 256 }),
		);

		const results = await checkSkillBudget(createEngineerSetup(), projectDir);
		expect(resultById(results, "ck-skill-listing-budget").status).toBe("pass");
		expect(resultById(results, "ck-skill-agent-visibility").status).toBe("pass");
	});

	test("warns on duplicate global and project skill inventory", async () => {
		await writeSkill(join(projectDir, ".claude", "skills"), "cook", {
			userInvocable: false,
		});
		await writeSkill(join(tempDir, ".claude", "skills"), "cook", {
			userInvocable: false,
		});

		const results = await checkSkillBudget(createEngineerSetup(), projectDir);
		const inventory = resultById(results, "ck-skill-inventory");

		expect(inventory.status).toBe("warn");
		expect(inventory.message).toContain("duplicate");
		expect(inventory.autoFixable).toBe(false);
	});

	test("warns when older project skills are still user-invocable", async () => {
		await writeSkill(join(projectDir, ".claude", "skills"), "cook", {});

		const results = await checkSkillBudget(createEngineerSetup(), projectDir);
		const visibility = resultById(results, "ck-skill-agent-visibility");

		expect(visibility.status).toBe("warn");
		expect(visibility.message).toContain("user-invocable");
		expect(visibility.suggestion).toContain("user-invocable: false");
	});

	test("warns on descriptions over the Claude Code listing cap", async () => {
		await writeSkill(join(projectDir, ".claude", "skills"), "cti-expert", {
			description: "x".repeat(513),
			userInvocable: false,
		});

		const results = await checkSkillBudget(createEngineerSetup(), projectDir);
		const inventory = resultById(results, "ck-skill-description-inventory");

		expect(inventory.status).toBe("warn");
		expect(inventory.message).toContain("over 512");
	});

	test("skips non-Engineer projects", async () => {
		await writeSkill(join(projectDir, ".claude", "skills"), "custom", {
			userInvocable: false,
		});

		const results = await checkSkillBudget(createNonEngineerSetup(), projectDir);
		expect(results).toEqual([]);
	});
});

function createEngineerSetup(): ClaudeKitSetup {
	return {
		global: {
			path: "",
			metadata: null,
			components: { agents: 0, commands: 0, rules: 0, skills: 0 },
		},
		project: {
			path: "",
			metadata: {
				name: "claudekit-engineer",
				version: "1.0.0",
				description: "Engineer kit",
			},
			components: { agents: 0, commands: 0, rules: 0, skills: 1 },
		},
	};
}

function createNonEngineerSetup(): ClaudeKitSetup {
	return {
		global: {
			path: "",
			metadata: null,
			components: { agents: 0, commands: 0, rules: 0, skills: 0 },
		},
		project: {
			path: "",
			metadata: { name: "custom-project", version: "1.0.0", description: "Custom kit" },
			components: { agents: 0, commands: 0, rules: 0, skills: 1 },
		},
	};
}

async function writeSkill(
	skillsDir: string,
	name: string,
	options: { description?: string; userInvocable?: boolean },
): Promise<void> {
	const skillDir = join(skillsDir, name);
	await mkdir(skillDir, { recursive: true });
	const userInvocable =
		options.userInvocable === undefined ? "" : `user-invocable: ${options.userInvocable}\n`;
	await writeFile(
		join(skillDir, "SKILL.md"),
		[
			"---",
			`name: ck:${name}`,
			`description: "${options.description ?? `Skill for ${name}`}"`,
			userInvocable.trimEnd(),
			"---",
			"",
			`# ${name}`,
		]
			.filter(Boolean)
			.join("\n"),
	);
}

function resultById(results: Awaited<ReturnType<typeof checkSkillBudget>>, id: string) {
	const result = results.find((item) => item.id === id);
	if (!result) throw new Error(`Missing result: ${id}`);
	return result;
}
