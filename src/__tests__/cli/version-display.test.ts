import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	displayVersion,
	getInstalledKitVersions,
	inferLegacyKitType,
} from "@/cli/version-display.js";
import { ConfigVersionChecker } from "@/domains/sync/config-version-checker.js";
import { CliVersionChecker, VersionChecker } from "@/domains/versioning/version-checker.js";

describe("displayVersion", () => {
	let testHome: string;
	let projectDir: string;
	let originalCwd: string;
	let cliCheckSpy: ReturnType<typeof spyOn<typeof CliVersionChecker, "check">> | null;
	let kitCheckSpy: ReturnType<typeof spyOn<typeof ConfigVersionChecker, "checkForUpdates">> | null;
	let displayNotificationSpy: ReturnType<
		typeof spyOn<typeof VersionChecker, "displayNotification">
	> | null;

	beforeEach(async () => {
		testHome = join(
			tmpdir(),
			`version-display-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		projectDir = join(testHome, "project");
		originalCwd = process.cwd();
		cliCheckSpy = spyOn(CliVersionChecker, "check").mockResolvedValue(null);
		kitCheckSpy = null;
		displayNotificationSpy = spyOn(VersionChecker, "displayNotification").mockImplementation(
			() => {},
		);

		process.env.CK_TEST_HOME = testHome;
		await mkdir(join(projectDir, ".claude"), { recursive: true });
		await mkdir(join(testHome, ".claude"), { recursive: true });
		process.chdir(projectDir);
	});

	afterEach(async () => {
		process.chdir(originalCwd);
		process.env.CK_TEST_HOME = undefined;
		cliCheckSpy?.mockRestore();
		kitCheckSpy?.mockRestore();
		displayNotificationSpy?.mockRestore();
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

		await displayVersion();

		expect(kitCheckSpy).toHaveBeenCalledTimes(2);
		expect(kitCheckSpy?.mock.calls).toEqual([
			["marketing", "1.3.2", false],
			["engineer", "2.16.0-beta.9", true],
		]);
		expect(displayNotificationSpy).not.toHaveBeenCalled();
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

		await displayVersion();

		expect(displayNotificationSpy).toHaveBeenCalledWith(
			{
				currentVersion: "2.16.0-beta.8",
				latestVersion: "2.16.0-beta.9",
				updateAvailable: true,
				releaseUrl: "https://github.com/claudekit/claudekit-engineer/releases/tag/v2.16.0-beta.9",
			},
			{ isGlobal: true, kitName: "engineer" },
		);
	});

	it("infers legacy marketing installs from the metadata name", () => {
		expect(inferLegacyKitType({ name: "ClaudeKit Marketing" })).toBe("marketing");
		expect(inferLegacyKitType({ name: "ClaudeKit" })).toBe("engineer");
	});

	it("falls back to the legacy root version when kits are absent", () => {
		expect(getInstalledKitVersions({ version: "1.3.2", name: "ClaudeKit Marketing" })).toEqual([
			{ kit: "marketing", version: "1.3.2" },
		]);
	});

	it("filters blank kit versions and ignores empty kit maps", () => {
		expect(
			getInstalledKitVersions({
				kits: {
					engineer: {
						version: "  ",
						installedAt: "2026-04-10T12:00:00.000Z",
						files: [],
					},
					marketing: {
						version: "1.3.2",
						installedAt: "2026-04-10T12:00:00.000Z",
						files: [],
					},
				},
			}),
		).toEqual([{ kit: "marketing", version: "1.3.2" }]);
		expect(getInstalledKitVersions({ kits: {} })).toEqual([]);
	});
});
