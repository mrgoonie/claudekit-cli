import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { displayVersion } from "@/cli/version-display.js";
import { ConfigVersionChecker } from "@/domains/sync/config-version-checker.js";
import { CliVersionChecker } from "@/domains/versioning/version-checker.js";

describe("displayVersion", () => {
	let testHome: string;
	let projectDir: string;
	let originalCwd: string;
	let consoleSpy: ReturnType<typeof spyOn<typeof console, "log">> | null;
	let cliCheckSpy: ReturnType<typeof spyOn<typeof CliVersionChecker, "check">> | null;
	let kitCheckSpy: ReturnType<typeof spyOn<typeof ConfigVersionChecker, "checkForUpdates">> | null;

	beforeEach(async () => {
		testHome = join(
			tmpdir(),
			`version-display-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		projectDir = join(testHome, "project");
		originalCwd = process.cwd();
		consoleSpy = spyOn(console, "log").mockImplementation(() => {});
		cliCheckSpy = spyOn(CliVersionChecker, "check").mockResolvedValue(null);
		kitCheckSpy = null;

		process.env.CK_TEST_HOME = testHome;
		await mkdir(join(projectDir, ".claude"), { recursive: true });
		await mkdir(join(testHome, ".claude"), { recursive: true });
		process.chdir(projectDir);
	});

	afterEach(async () => {
		process.chdir(originalCwd);
		process.env.CK_TEST_HOME = undefined;
		consoleSpy?.mockRestore();
		cliCheckSpy?.mockRestore();
		kitCheckSpy?.mockRestore();
		await rm(testHome, { recursive: true, force: true });
	});

	it("does not show a false cross-kit update prompt for mixed local/global installs", async () => {
		await writeFile(
			join(projectDir, ".claude", "metadata.json"),
			JSON.stringify({
				kits: {
					marketing: {
						version: "1.3.2",
						installedAt: "2026-04-10T12:00:00.000Z",
						files: [],
					},
				},
			}),
		);
		await writeFile(
			join(testHome, ".claude", "metadata.json"),
			JSON.stringify({
				kits: {
					engineer: {
						version: "2.16.0-beta.9",
						installedAt: "2026-04-10T12:00:00.000Z",
						files: [],
					},
				},
			}),
		);

		kitCheckSpy = spyOn(ConfigVersionChecker, "checkForUpdates").mockImplementation(
			async (kitType, currentVersion, globalInstall) => ({
				hasUpdates: false,
				currentVersion: String(currentVersion).replace(/^v/, ""),
				latestVersion: String(currentVersion).replace(/^v/, ""),
				fromCache: globalInstall || kitType === "marketing",
			}),
		);

		const initialLogCount = consoleSpy?.mock.calls.length ?? 0;
		await displayVersion();

		const output = consoleSpy?.mock.calls
			.slice(initialLogCount)
			.flat()
			.filter((value): value is string => typeof value === "string")
			.join("\n");

		expect(output).toContain("Local Kit Version: marketing@1.3.2");
		expect(output).toContain("Global Kit Version: engineer@2.16.0-beta.9");
		expect(kitCheckSpy).toHaveBeenCalledTimes(2);
		expect(kitCheckSpy?.mock.calls).toEqual([
			["marketing", "1.3.2", false],
			["engineer", "2.16.0-beta.9", true],
		]);
	});

	it("shows the matching kit label and scope when a specific installed kit is outdated", async () => {
		await writeFile(
			join(testHome, ".claude", "metadata.json"),
			JSON.stringify({
				kits: {
					engineer: {
						version: "2.16.0-beta.8",
						installedAt: "2026-04-10T12:00:00.000Z",
						files: [],
					},
				},
			}),
		);

		kitCheckSpy = spyOn(ConfigVersionChecker, "checkForUpdates").mockResolvedValue({
			hasUpdates: true,
			currentVersion: "2.16.0-beta.8",
			latestVersion: "2.16.0-beta.9",
			fromCache: false,
		});

		const initialLogCount = consoleSpy?.mock.calls.length ?? 0;
		await displayVersion();

		const output = consoleSpy?.mock.calls
			.slice(initialLogCount)
			.flat()
			.filter((value): value is string => typeof value === "string")
			.join("\n");

		expect(output).toContain("Kit Update Available");
		expect(output).toContain("Kit: engineer");
		expect(output).toContain("Run: ck init -g");
	});
});
