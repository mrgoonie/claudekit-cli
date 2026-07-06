import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	readConfiguredProjectPackageManager,
	resolveSkillsPackageManager,
} from "@/services/package-installer/skills-package-manager";

async function withProjectConfig(
	config: Record<string, unknown>,
	fn: (projectDir: string) => Promise<void>,
): Promise<void> {
	const projectDir = await mkdtemp(join(tmpdir(), "ck-skills-pm-"));
	try {
		const claudeDir = join(projectDir, ".claude");
		await mkdir(claudeDir, { recursive: true });
		await writeFile(join(claudeDir, ".ck.json"), JSON.stringify(config, null, 2));
		await fn(projectDir);
	} finally {
		await rm(projectDir, { recursive: true, force: true });
	}
}

describe("skills package manager resolver", () => {
	test("uses explicit package manager before auto detection", async () => {
		const resolved = await resolveSkillsPackageManager({
			requested: "bun",
			detectPackageManager: async () => "npm",
		});

		expect(resolved).toEqual({ packageManager: "bun", source: "explicit" });
	});

	test("uses project package manager in local auto mode", async () => {
		await withProjectConfig({ project: { packageManager: "pnpm" } }, async (projectDir) => {
			const configured = await readConfiguredProjectPackageManager(projectDir);
			const resolved = await resolveSkillsPackageManager({
				requested: "auto",
				projectDir,
				detectPackageManager: async () => "npm",
			});

			expect(configured).toBe("pnpm");
			expect(resolved).toEqual({ packageManager: "pnpm", source: "project" });
		});
	});

	test("uses detected ck package manager when project config is auto", async () => {
		await withProjectConfig({ project: { packageManager: "auto" } }, async (projectDir) => {
			const resolved = await resolveSkillsPackageManager({
				requested: "auto",
				projectDir,
				detectPackageManager: async () => "bun",
			});

			expect(resolved).toEqual({ packageManager: "bun", source: "detected" });
		});
	});

	test("falls back to npm when detection is unavailable", async () => {
		const resolved = await resolveSkillsPackageManager({
			requested: "auto",
			detectPackageManager: async () => "unknown",
		});

		expect(resolved).toEqual({ packageManager: "npm", source: "fallback" });
	});

	test("global auto mode ignores local project config and uses detected manager", async () => {
		await withProjectConfig({ project: { packageManager: "yarn" } }, async (projectDir) => {
			const resolved = await resolveSkillsPackageManager({
				requested: "auto",
				projectDir,
				isGlobal: true,
				detectPackageManager: async () => "bun",
			});

			expect(resolved).toEqual({ packageManager: "bun", source: "detected" });
		});
	});
});
