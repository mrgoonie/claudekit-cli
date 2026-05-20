import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const isCI = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
const runCliIntegration = /^(1|true)$/i.test(process.env.CK_RUN_CLI_INTEGRATION ?? "");
const shouldRunIntegration = !isCI && runCliIntegration;
const integrationDescribe = shouldRunIntegration ? describe : describe.skip;

function createLegacyMetadata() {
	return JSON.stringify(
		{
			version: "2.10.1",
			name: "claudekit-engineer",
			description: "legacy prefixed install",
			kits: {
				engineer: {
					version: "2.10.1",
					installedAt: "2026-04-06T15:07:00.000Z",
					files: [
						{
							path: "commands/ck/ask.md",
							checksum: "a".repeat(64),
							ownership: "ck",
							installedVersion: "2.10.1",
						},
						{
							path: "commands/ck/coding-level.md",
							checksum: "b".repeat(64),
							ownership: "ck",
							installedVersion: "2.10.1",
						},
					],
				},
			},
		},
		null,
		2,
	);
}

function createUpgradeKitMetadata() {
	return JSON.stringify(
		{
			version: "2.16.0",
			name: "claudekit-engineer",
			description: "reproduction fixture",
			deletions: ["commands/ask.md", "commands/coding-level.md"],
		},
		null,
		2,
	);
}

integrationDescribe("global prefixed upgrade cleanup", () => {
	let tempRoot: string;
	let homeDir: string;
	let kitDir: string;
	const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
	const cliPath = join(repoRoot, "dist", "index.js");

	beforeAll(() => {
		if (!existsSync(cliPath)) {
			execSync("bun run build", { cwd: repoRoot, stdio: "pipe" });
		}
	});

	afterEach(async () => {
		if (tempRoot) {
			await rm(tempRoot, { recursive: true, force: true });
		}
	});

	async function seedLegacyInstall() {
		tempRoot = await mkdtemp(join(tmpdir(), "ck-prefix-upgrade-"));
		homeDir = join(tempRoot, "home");
		kitDir = join(tempRoot, "kit-v2.16.0");

		await mkdir(join(homeDir, ".claude", "commands", "ck"), { recursive: true });
		await mkdir(join(kitDir, ".claude", "skills", "ask"), { recursive: true });
		await mkdir(join(kitDir, ".claude", "skills", "coding-level"), { recursive: true });

		await writeFile(join(homeDir, ".claude", "commands", "ck", "ask.md"), "# Old ask command");
		await writeFile(
			join(homeDir, ".claude", "commands", "ck", "coding-level.md"),
			"# Old coding-level command",
		);
		await writeFile(join(homeDir, ".claude", "metadata.json"), createLegacyMetadata());

		await writeFile(join(kitDir, "CLAUDE.md"), "# Test kit");
		await writeFile(join(kitDir, ".claude", "metadata.json"), createUpgradeKitMetadata());
		await writeFile(join(kitDir, ".claude", "skills", "ask", "SKILL.md"), "# Ask");
		await writeFile(
			join(kitDir, ".claude", "skills", "coding-level", "SKILL.md"),
			"# Coding Level",
		);
	}

	function runCli(args: string): string {
		return execSync(`node ${cliPath} ${args}`, {
			cwd: repoRoot,
			encoding: "utf-8",
			stdio: "pipe",
			timeout: 120000,
			env: {
				...process.env,
				CI: "true",
				HOME: homeDir,
				GH_NO_UPDATE_NOTIFIER: "1",
				NO_UPDATE_NOTIFIER: "1",
			},
		});
	}

	test("removes legacy prefixed commands during the exact global upgrade path", async () => {
		await seedLegacyInstall();

		const beforeVersion = runCli("--version");
		expect(beforeVersion).toContain("CLI Version:");
		expect(beforeVersion).toContain("Global Kit Version: engineer@2.10.1");

		runCli(`init -g --kit engineer --kit-path ${kitDir} --yes --install-skills`);

		expect(existsSync(join(homeDir, ".claude", "commands", "ck", "ask.md"))).toBe(false);
		expect(existsSync(join(homeDir, ".claude", "commands", "ck", "coding-level.md"))).toBe(false);
		expect(existsSync(join(homeDir, ".claude", "skills", "ask", "SKILL.md"))).toBe(true);
		expect(existsSync(join(homeDir, ".claude", "skills", "coding-level", "SKILL.md"))).toBe(true);

		const afterVersion = runCli("--version");
		expect(afterVersion).toContain("Global Kit Version: engineer@local");
	});
});
