import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expectFixerConvergence } from "@/__tests__/helpers/checker-fixer-parity.js";
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
			userInvocable: true,
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

	test("fixes budget to the 200k-context requirement when active inventory exceeds 3 percent", async () => {
		for (let index = 0; index < 60; index++) {
			await writeSkill(join(projectDir, ".claude", "skills"), `project-${index}`, {
				description: "x".repeat(500),
				userInvocable: true,
			});
		}

		const results = await checkSkillBudget(createEngineerSetup(), projectDir);
		const budget = resultById(results, "ck-skill-listing-budget");

		expect(budget.status).toBe("fail");
		expect(budget.message).toContain("skillListingBudgetFraction >= 0.039");
		expect(budget.details).toContain("200,000 token context floor");

		const fix = await budget.fix?.execute();
		expect(fix?.success).toBe(true);

		const settings = JSON.parse(
			await readFile(join(projectDir, ".claude", "settings.json"), "utf8"),
		);
		expect(settings.skillListingBudgetFraction).toBe(0.039);
		expect(settings.skillListingMaxDescChars).toBe(512);
	});

	test("computes budget against ClaudeKit cap when existing max description setting is too high", async () => {
		for (let index = 0; index < 60; index++) {
			await writeSkill(join(projectDir, ".claude", "skills"), `project-${index}`, {
				description: "x".repeat(1000),
				userInvocable: true,
			});
		}
		await writeFile(
			join(projectDir, ".claude", "settings.json"),
			JSON.stringify({ skillListingBudgetFraction: 0.03, skillListingMaxDescChars: 1536 }),
		);

		const results = await checkSkillBudget(createEngineerSetup(), projectDir);
		const budget = resultById(results, "ck-skill-listing-budget");

		expect(budget.status).toBe("fail");
		expect(budget.message).toContain("skillListingBudgetFraction >= 0.04");
		expect(budget.message).not.toContain("0.077");
		expect(budget.message).toContain("skillListingMaxDescChars <= 512");

		const fix = await budget.fix?.execute();
		expect(fix?.success).toBe(true);

		const settings = JSON.parse(
			await readFile(join(projectDir, ".claude", "settings.json"), "utf8"),
		);
		expect(settings.skillListingBudgetFraction).toBe(0.04);
		expect(settings.skillListingMaxDescChars).toBe(512);
	});

	test("passes when project budget settings are already safe", async () => {
		await writeSkill(join(projectDir, ".claude", "skills"), "cook", {
			userInvocable: true,
		});
		await writeFile(
			join(projectDir, ".claude", "settings.json"),
			JSON.stringify({ skillListingBudgetFraction: 0.05, skillListingMaxDescChars: 256 }),
		);

		const results = await checkSkillBudget(createEngineerSetup(), projectDir);
		expect(resultById(results, "ck-skill-listing-budget").status).toBe("pass");
		expect(resultById(results, "ck-skill-agent-visibility").status).toBe("pass");
	});

	test("budget fixer converges after one ck doctor --fix pass", async () => {
		await writeSkill(join(projectDir, ".claude", "skills"), "cook", {
			userInvocable: true,
		});

		await expectFixerConvergence({
			fixture: projectDir,
			detect: async (fixture) => {
				const results = await checkSkillBudget(createEngineerSetup(), fixture);
				return results.filter(
					(result) => result.id === "ck-skill-listing-budget" && result.status === "fail",
				);
			},
			fix: async (fixture) => {
				const results = await checkSkillBudget(createEngineerSetup(), fixture);
				const budget = resultById(results, "ck-skill-listing-budget");
				const fix = await budget.fix?.execute();
				expect(fix?.success).toBe(true);
			},
		});
	});

	test("fails invalid Claude Code budget setting shapes", async () => {
		await writeSkill(join(projectDir, ".claude", "skills"), "cook", {
			userInvocable: true,
		});
		await writeFile(
			join(projectDir, ".claude", "settings.json"),
			JSON.stringify({ skillListingBudgetFraction: 2, skillListingMaxDescChars: -1 }),
		);

		const results = await checkSkillBudget(createEngineerSetup(), projectDir);
		const budget = resultById(results, "ck-skill-listing-budget");

		expect(budget.status).toBe("fail");
		expect(budget.message).toContain("skillListingBudgetFraction");
		expect(budget.message).toContain("skillListingMaxDescChars");
	});

	test("warns when project settings contain skillOverrides", async () => {
		await writeSkill(join(projectDir, ".claude", "skills"), "cook", {
			userInvocable: true,
		});
		await writeFile(
			join(projectDir, ".claude", "settings.json"),
			JSON.stringify({
				skillListingBudgetFraction: 0.03,
				skillListingMaxDescChars: 512,
				skillOverrides: { cook: { enabled: false } },
			}),
		);

		const results = await checkSkillBudget(createEngineerSetup(), projectDir);
		const policy = resultById(results, "ck-skill-overrides-policy");

		expect(policy.status).toBe("warn");
		expect(policy.message).toContain("skillOverrides");
		expect(policy.autoFixable).toBe(false);
	});

	test("warns on duplicate global and project skill inventory", async () => {
		await writeSkill(join(projectDir, ".claude", "skills"), "cook", {
			userInvocable: true,
		});
		await writeSkill(join(tempDir, ".claude", "skills"), "cook", {
			userInvocable: true,
		});

		const results = await checkSkillBudget(createEngineerSetup(), projectDir);
		const inventory = resultById(results, "ck-skill-inventory");

		expect(inventory.status).toBe("warn");
		expect(inventory.message).toContain("duplicate");
		expect(inventory.autoFixable).toBe(false);
	});

	test("passes when project skills omit user-invocable because Claude Code defaults to user visibility", async () => {
		await writeSkill(join(projectDir, ".claude", "skills"), "cook", {});

		const results = await checkSkillBudget(createEngineerSetup(), projectDir);
		const visibility = resultById(results, "ck-skill-agent-visibility");

		expect(visibility.status).toBe("pass");
		expect(visibility.message).toContain("user-invocable");
	});

	test("passes when global skills omit user-invocable because Claude Code defaults to user visibility", async () => {
		await writeSkill(join(projectDir, ".claude", "skills"), "cook", {
			userInvocable: true,
		});
		await writeSkill(join(tempDir, ".claude", "skills"), "global-helper", {});

		const results = await checkSkillBudget(createEngineerSetup(), projectDir);
		const visibility = resultById(results, "ck-skill-agent-visibility");

		expect(visibility.status).toBe("pass");
	});

	test("warns when project skills are explicitly not user-invocable", async () => {
		await writeSkill(join(projectDir, ".claude", "skills"), "cook", {
			userInvocable: false,
		});

		const results = await checkSkillBudget(createEngineerSetup(), projectDir);
		const visibility = resultById(results, "ck-skill-agent-visibility");

		expect(visibility.status).toBe("warn");
		expect(visibility.message).toContain("user-invocable");
		expect(visibility.suggestion).toContain("user-invocable: true");
	});

	test("warns when global skills are explicitly not user-invocable", async () => {
		await writeSkill(join(projectDir, ".claude", "skills"), "cook", {
			userInvocable: true,
		});
		await writeSkill(join(tempDir, ".claude", "skills"), "global-hidden", {
			userInvocable: false,
		});

		const results = await checkSkillBudget(createEngineerSetup(), projectDir);
		const visibility = resultById(results, "ck-skill-agent-visibility");

		expect(visibility.status).toBe("warn");
		expect(visibility.message).toContain("active project/global");
		expect(visibility.details).toContain("global-hidden");
	});

	test("warns on descriptions over the ClaudeKit recommended listing cap", async () => {
		await writeSkill(join(projectDir, ".claude", "skills"), "cti-expert", {
			description: "x".repeat(513),
			userInvocable: true,
		});

		const results = await checkSkillBudget(createEngineerSetup(), projectDir);
		const inventory = resultById(results, "ck-skill-description-inventory");

		expect(inventory.status).toBe("warn");
		expect(inventory.message).toContain("over 512");
	});

	test("warns on global descriptions over the ClaudeKit recommended listing cap", async () => {
		await writeSkill(join(projectDir, ".claude", "skills"), "cook", {
			userInvocable: true,
		});
		await writeSkill(join(tempDir, ".claude", "skills"), "global-long", {
			description: "x".repeat(513),
			userInvocable: true,
		});

		const results = await checkSkillBudget(createEngineerSetup(), projectDir);
		const inventory = resultById(results, "ck-skill-description-inventory");

		expect(inventory.status).toBe("warn");
		expect(inventory.details).toContain("global-long");
	});

	test("counts skill directories named scripts or common when they contain SKILL.md", async () => {
		await writeSkill(join(projectDir, ".claude", "skills"), "scripts", {
			userInvocable: true,
		});
		await writeSkill(join(projectDir, ".claude", "skills"), "common", {
			userInvocable: true,
		});

		const results = await checkSkillBudget(createEngineerSetup(), projectDir);
		const inventory = resultById(results, "ck-skill-description-inventory");

		expect(inventory.status).toBe("pass");
		expect(inventory.message).toContain("2 active project/global skills");
	});

	test("counts symlinked skill directories that contain SKILL.md", async () => {
		if (process.platform === "win32") return;
		const realSkillDir = join(tempDir, "real-linked-skill");
		await writeSkill(tempDir, "real-linked-skill", {
			userInvocable: true,
		});
		await mkdir(join(projectDir, ".claude", "skills"), { recursive: true });
		await symlink(realSkillDir, join(projectDir, ".claude", "skills", "linked-skill"), "dir");

		const results = await checkSkillBudget(createEngineerSetup(), projectDir);
		const inventory = resultById(results, "ck-skill-description-inventory");

		expect(inventory.status).toBe("pass");
		expect(inventory.message).toContain("1 active project/global skills");
	});

	test("skips non-Engineer projects", async () => {
		await writeSkill(join(projectDir, ".claude", "skills"), "custom", {
			userInvocable: true,
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
