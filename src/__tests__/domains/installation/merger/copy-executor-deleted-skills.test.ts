import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CopyExecutor } from "@/domains/installation/merger/copy-executor.js";
import type { Metadata } from "@/types";

const ISO_DATE = "2025-01-01T00:00:00.000Z";
const CHECKSUM = "a".repeat(64);

describe("CopyExecutor deleted skills", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = join(
			tmpdir(),
			`copy-executor-deleted-skills-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		await mkdir(tempDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	it("preserves a deleted global skill previously tracked by the same kit", async () => {
		const sourceDir = join(tempDir, "source");
		const claudeDir = join(tempDir, "dest");
		await writeSkill(sourceDir, "skills/shopify");
		await writeMetadata(claudeDir, ["skills/shopify/SKILL.md"]);

		const executor = new CopyExecutor([]);
		executor.setMultiKitContext(claudeDir, "engineer");
		await executor.copyFiles(sourceDir, claudeDir);

		expect(existsSync(join(claudeDir, "skills", "shopify", "SKILL.md"))).toBe(false);
		expect(executor.getIgnoredSkillDirectories()).toEqual(["skills/shopify"]);
	});

	it("normalizes local .claude skill paths before preserving a deleted skill", async () => {
		const sourceDir = join(tempDir, "source");
		const projectDir = join(tempDir, "project");
		const claudeDir = join(projectDir, ".claude");
		await writeSkill(sourceDir, ".claude/skills/shopify");
		await writeMetadata(claudeDir, ["skills/shopify/SKILL.md"]);

		const executor = new CopyExecutor([]);
		executor.setMultiKitContext(claudeDir, "engineer");
		await executor.copyFiles(sourceDir, projectDir);

		expect(existsSync(join(claudeDir, "skills", "shopify", "SKILL.md"))).toBe(false);
		expect(executor.getIgnoredSkillDirectories()).toEqual(["skills/shopify"]);
	});

	it("installs a new skill when no prior metadata marks it as deleted", async () => {
		const sourceDir = join(tempDir, "source");
		const claudeDir = join(tempDir, "dest");
		await writeSkill(sourceDir, "skills/shopify");
		await mkdir(claudeDir, { recursive: true });

		const executor = new CopyExecutor([]);
		executor.setMultiKitContext(claudeDir, "engineer");
		await executor.copyFiles(sourceDir, claudeDir);

		expect(existsSync(join(claudeDir, "skills", "shopify", "SKILL.md"))).toBe(true);
		expect(executor.getIgnoredSkillDirectories()).toEqual([]);
	});

	it("copies missing files when the skill directory still exists", async () => {
		const sourceDir = join(tempDir, "source");
		const claudeDir = join(tempDir, "dest");
		await writeSkill(sourceDir, "skills/shopify");
		await writeFile(join(sourceDir, "skills", "shopify", "README.md"), "extra docs");
		await writeMetadata(claudeDir, ["skills/shopify/SKILL.md"]);
		await writeSkill(claudeDir, "skills/shopify");

		const executor = new CopyExecutor([]);
		executor.setMultiKitContext(claudeDir, "engineer");
		await executor.copyFiles(sourceDir, claudeDir);

		expect(existsSync(join(claudeDir, "skills", "shopify", "README.md"))).toBe(true);
		expect(executor.getIgnoredSkillDirectories()).toEqual([]);
	});

	it("preserves skills already listed as ignored in metadata", async () => {
		const sourceDir = join(tempDir, "source");
		const claudeDir = join(tempDir, "dest");
		await writeSkill(sourceDir, "skills/shopify");
		await writeMetadata(claudeDir, [], ["skills/shopify"]);

		const executor = new CopyExecutor([]);
		executor.setMultiKitContext(claudeDir, "engineer");
		await executor.copyFiles(sourceDir, claudeDir);

		expect(existsSync(join(claudeDir, "skills", "shopify", "SKILL.md"))).toBe(false);
		expect(executor.getIgnoredSkillDirectories()).toEqual(["skills/shopify"]);
	});

	it("reinstalls an ignored skill when deleted-skill preservation is disabled", async () => {
		const sourceDir = join(tempDir, "source");
		const claudeDir = join(tempDir, "dest");
		await writeSkill(sourceDir, "skills/shopify");
		await writeMetadata(claudeDir, ["skills/shopify/SKILL.md"], ["skills/shopify"]);

		const executor = new CopyExecutor([]);
		executor.setMultiKitContext(claudeDir, "engineer");
		executor.setPreserveDeletedSkills(false);
		await executor.copyFiles(sourceDir, claudeDir);

		expect(existsSync(join(claudeDir, "skills", "shopify", "SKILL.md"))).toBe(true);
		expect(executor.getIgnoredSkillDirectories()).toEqual([]);
	});
});

async function writeSkill(root: string, skillRoot: string): Promise<void> {
	const skillDir = join(root, ...skillRoot.split("/"));
	await mkdir(skillDir, { recursive: true });
	await writeFile(join(skillDir, "SKILL.md"), "# Shopify\n");
}

async function writeMetadata(
	claudeDir: string,
	trackedPaths: string[],
	ignoredSkills: string[] = [],
): Promise<void> {
	await mkdir(claudeDir, { recursive: true });
	const metadata: Metadata = {
		kits: {
			engineer: {
				version: "1.0.0",
				installedAt: ISO_DATE,
				files: trackedPaths.map((path) => ({
					path,
					checksum: CHECKSUM,
					ownership: "ck",
					installedVersion: "1.0.0",
				})),
				ignoredSkills,
			},
		},
		scope: "global",
	};
	await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata));
}
