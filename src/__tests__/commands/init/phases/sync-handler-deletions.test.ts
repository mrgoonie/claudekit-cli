import { describe, expect, it, mock } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executeSyncMerge } from "@/commands/init/phases/sync-handler.js";
import type { InitContext, SyncContext } from "@/commands/init/types.js";
import type { TrackedFile } from "@/types";

const checksum = "a".repeat(64);

function createPrompts() {
	return {
		selectKit: mock(async () => "engineer" as const),
		getDirectory: mock(async () => "."),
		selectVersionEnhanced: mock(async () => "v1.0.0"),
		confirm: mock(async () => true),
		intro: mock(() => {}),
		outro: mock(() => {}),
		note: mock(() => {}),
	};
}

function createTrackedFile(path: string, ownership: TrackedFile["ownership"]): TrackedFile {
	return {
		path,
		checksum,
		ownership,
		installedVersion: "1.0.0",
	};
}

function createSyncContext(overrides: {
	projectDir: string;
	claudeDir: string;
	upstreamDir: string;
	trackedFiles: TrackedFile[];
	prompts: ReturnType<typeof createPrompts>;
}): SyncContext {
	return {
		rawOptions: {} as SyncContext["rawOptions"],
		options: {
			kit: "engineer",
			dir: overrides.projectDir,
			beta: false,
			global: false,
			yes: true,
			fresh: false,
			force: false,
			refresh: false,
			exclude: [],
			only: [],
			installSkills: false,
			withSudo: false,
			skipSetup: false,
			forceOverwrite: false,
			forceOverwriteSettings: false,
			restoreCkHooks: false,
			dryRun: false,
			prefix: true,
			sync: true,
			useGit: false,
			installMode: "auto",
		},
		prompts: overrides.prompts as unknown as InitContext["prompts"],
		explicitDir: true,
		isNonInteractive: true,
		kitType: "engineer",
		resolvedDir: overrides.projectDir,
		extractDir: overrides.upstreamDir,
		claudeDir: overrides.claudeDir,
		customClaudeFiles: [],
		includePatterns: [],
		installSkills: false,
		cancelled: false,
		syncInProgress: true,
		syncTrackedFiles: overrides.trackedFiles,
		syncCurrentVersion: "1.0.0",
		syncLatestVersion: "1.0.1",
	};
}

describe("executeSyncMerge deletions", () => {
	it("removes CK-owned deprecated files even when there are no sync updates", async () => {
		const previousTestHome = process.env.CK_TEST_HOME;
		const projectDir = await makeTempDir("ck-sync-delete-project-");
		const upstreamDir = await makeTempDir("ck-sync-delete-upstream-");
		process.env.CK_TEST_HOME = await makeTempDir("ck-sync-delete-home-");
		try {
			const claudeDir = join(projectDir, ".claude");
			const staleRelPath = "rules/stale-routing.md";
			const stalePath = join(claudeDir, staleRelPath);
			const trackedFiles = [createTrackedFile(staleRelPath, "ck")];
			const prompts = createPrompts();

			await mkdir(join(claudeDir, "rules"), { recursive: true });
			await writeFile(stalePath, "stale rule\n");
			await writeFile(
				join(claudeDir, "metadata.json"),
				JSON.stringify(
					{
						kits: {
							engineer: {
								version: "1.0.0",
								installedAt: "2026-06-08T00:00:00.000Z",
								files: trackedFiles,
							},
						},
						scope: "local",
					},
					null,
					2,
				),
			);
			await writeFile(
				join(upstreamDir, "metadata.json"),
				JSON.stringify(
					{
						version: "1.0.1",
						name: "claudekit-engineer",
						description: "test source metadata",
						deletions: [staleRelPath],
					},
					null,
					2,
				),
			);

			const result = await executeSyncMerge(
				createSyncContext({ projectDir, claudeDir, upstreamDir, trackedFiles, prompts }),
			);

			expect(result.cancelled).toBe(true);
			expect(await Bun.file(stalePath).exists()).toBe(false);
			expect(prompts.outro).toHaveBeenCalledWith("Config sync completed successfully");

			const metadata = JSON.parse(await readFile(join(claudeDir, "metadata.json"), "utf-8"));
			expect(metadata.kits.engineer.files).toHaveLength(0);
		} finally {
			if (previousTestHome === undefined) {
				process.env.CK_TEST_HOME = undefined;
			} else {
				process.env.CK_TEST_HOME = previousTestHome;
			}
		}
	});
});

async function makeTempDir(prefix: string): Promise<string> {
	return await mkdtemp(join(tmpdir(), prefix));
}
