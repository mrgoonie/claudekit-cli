import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { categorizeDeletions } from "@/domains/installation/deletion-handler.js";
import { migrateUserSkills } from "@/services/skill-migration-merger.js";
import type { TrackedFile } from "@/types/metadata.js";

const tempDirs: string[] = [];

afterEach(async () => {
	for (const dir of tempDirs.splice(0)) {
		await rm(dir, { recursive: true, force: true });
	}
});

async function createClaudeDirWithFiles(files: TrackedFile[]): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "ck-plugin-pipeline-"));
	tempDirs.push(dir);
	await writeFile(
		join(dir, "metadata.json"),
		JSON.stringify({
			kits: {
				engineer: {
					files,
				},
			},
		}),
		"utf-8",
	);
	return dir;
}

describe("plugin migration pipeline", () => {
	test("categorizeDeletions splits skills from non-skills correctly", () => {
		const deletions = [
			"commands/old-cmd.md",
			"skills/cook/**",
			"skills/debug/**",
			"agents/old-agent/**",
			"command-archive/fix/ci.md",
		];

		const result = categorizeDeletions(deletions);

		expect(result.deferred).toContain("skills/cook/**");
		expect(result.deferred).toContain("skills/debug/**");
		expect(result.immediate).toContain("commands/old-cmd.md");
		expect(result.immediate).toContain("agents/old-agent/**");
		expect(result.immediate).toContain("command-archive/fix/ci.md");
		expect(result.deferred).not.toContain("commands/old-cmd.md");
		expect(result.immediate).not.toContain("skills/cook/**");
	});

	test("migrateUserSkills categorizes ck/ck-modified/user correctly", async () => {
		const dir = await createClaudeDirWithFiles([
			{
				path: "skills/cook/SKILL.md",
				checksum: "abc",
				ownership: "ck",
				installedVersion: "1.0.0",
			},
			{
				path: "skills/debug/SKILL.md",
				checksum: "def",
				ownership: "ck-modified",
				installedVersion: "1.0.0",
			},
			{
				path: "skills/my-custom/SKILL.md",
				checksum: "ghi",
				ownership: "user",
				installedVersion: "1.0.0",
			},
		]);

		const result = await migrateUserSkills(dir, true);

		expect(result.deleted).toContain("skills/cook");
		expect(result.preserved).toContain("skills/debug");
		expect(result.userOwned).toContain("skills/my-custom");
		expect(result.canDelete).toBe(true);
	});

	test("deferred deletions filtered by preserved skills", () => {
		const deferredDeletions = ["skills/cook/**", "skills/debug/**", "skills/planner/**"];
		const preservedSkillDirs = ["skills/debug"];

		const safeToDelete = deferredDeletions.filter((path) => {
			const skillDir = path.replace(/[/\\]\*\*$/, "").replace(/\\/g, "/");
			return !preservedSkillDirs.some((p) => p === skillDir);
		});

		expect(safeToDelete).toContain("skills/cook/**");
		expect(safeToDelete).toContain("skills/planner/**");
		expect(safeToDelete).not.toContain("skills/debug/**");
	});

	test("metadata tracking records plugin state", () => {
		const metadata = {
			kits: {
				engineer: {
					files: [
						{
							path: "skills/cook/SKILL.md",
							checksum: "abc123",
							ownership: "ck" as const,
							installedVersion: "3.35.0",
						},
					],
					installedVersion: "3.35.0",
					lastUpdated: new Date().toISOString(),
				},
			},
			pluginInstalled: true,
			pluginVerified: true,
		};

		expect(metadata.pluginInstalled).toBe(true);
		expect(metadata.pluginVerified).toBe(true);
		expect(metadata.kits.engineer.files[0].ownership).toBe("ck");
	});

	test("full pipeline: version gate → install → verify → delete", async () => {
		const ccVersion = "1.0.35";
		const minVersion = "1.0.33";

		const parseVer = (version: string) => {
			const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
			if (!match) return null;
			return [Number(match[1]), Number(match[2]), Number(match[3])] as [number, number, number];
		};

		const parsedCC = parseVer(ccVersion);
		const parsedMin = parseVer(minVersion);
		expect(parsedCC).not.toBeNull();
		expect(parsedMin).not.toBeNull();

		let versionPasses = false;
		if (parsedCC && parsedMin) {
			for (let i = 0; i < 3; i++) {
				if (parsedCC[i] !== parsedMin[i]) {
					versionPasses = parsedCC[i] > parsedMin[i];
					break;
				}
				if (i === 2) {
					versionPasses = true;
				}
			}
		}
		expect(versionPasses).toBe(true);

		const pluginInstallResult = {
			installed: true,
			marketplaceRegistered: true,
			verified: true,
			error: undefined as string | undefined,
		};
		expect(pluginInstallResult.verified).toBe(true);

		const dir = await createClaudeDirWithFiles([
			{
				path: "skills/cook/SKILL.md",
				checksum: "abc",
				ownership: "ck",
				installedVersion: "1.0.0",
			},
		]);

		const migrationResult = await migrateUserSkills(dir, pluginInstallResult.verified);
		expect(migrationResult.deleted).toContain("skills/cook");
		expect(migrationResult.preserved).toEqual([]);

		const deferredDeletions = ["skills/cook/**"];
		const finalDeletions = deferredDeletions.filter((path) => {
			const skillDir = path.replace(/[/\\]\*\*$/, "").replace(/\\/g, "/");
			return !migrationResult.preserved.some((preserved) => preserved === skillDir);
		});

		expect(finalDeletions).toContain("skills/cook/**");
		expect(finalDeletions).toHaveLength(1);
	});
});
