import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	getLegacyWindowsGlobalKitDirCandidates,
	repairLegacyWindowsGlobalKitDir,
} from "@/domains/installation/global-kit-legacy-repair.js";
import { pathExists } from "fs-extra";

describe("repairLegacyWindowsGlobalKitDir", () => {
	let testRoot: string;
	let homeDir: string;
	let localAppData: string;
	let appData: string;
	let targetDir: string;

	beforeEach(async () => {
		testRoot = join(
			tmpdir(),
			`ck-global-kit-repair-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		homeDir = join(testRoot, "Users", "admin");
		localAppData = join(homeDir, "AppData", "Local");
		appData = join(homeDir, "AppData", "Roaming");
		targetDir = join(homeDir, ".claude");
		await mkdir(localAppData, { recursive: true });
		await mkdir(appData, { recursive: true });
	});

	afterEach(async () => {
		await rm(testRoot, { recursive: true, force: true });
	});

	test("builds legacy candidates for docs-drift and malformed Windows global paths", () => {
		expect(
			getLegacyWindowsGlobalKitDirCandidates(
				{ LOCALAPPDATA: localAppData, APPDATA: appData },
				homeDir,
			),
		).toEqual([join(localAppData, ".claude"), join(appData, ".claude"), `${homeDir}.claude`]);
	});

	test("migrates a legacy LOCALAPPDATA .claude kit directory when target is missing", async () => {
		const legacyDir = join(localAppData, ".claude");
		await mkdir(legacyDir, { recursive: true });
		await writeFile(
			join(legacyDir, "metadata.json"),
			JSON.stringify({ name: "ClaudeKit Engineer" }),
		);

		const result = await repairLegacyWindowsGlobalKitDir({
			targetDir,
			platform: "win32",
			homeDir,
			env: { LOCALAPPDATA: localAppData, APPDATA: appData },
		});

		expect(result.status).toBe("repaired");
		expect(result.legacyDir).toBe(legacyDir);
		expect(await pathExists(join(targetDir, "metadata.json"))).toBe(true);
		expect(await pathExists(legacyDir)).toBe(false);
	});

	test("migrates a malformed USERPROFILE.claude kit directory when target is empty", async () => {
		const legacyDir = `${homeDir}.claude`;
		await mkdir(legacyDir, { recursive: true });
		await mkdir(targetDir, { recursive: true });
		await writeFile(join(legacyDir, "settings.json"), "{}");

		const result = await repairLegacyWindowsGlobalKitDir({
			targetDir,
			platform: "win32",
			homeDir,
			env: { LOCALAPPDATA: localAppData },
		});

		expect(result.status).toBe("repaired");
		expect(result.legacyDir).toBe(legacyDir);
		expect(await pathExists(join(targetDir, "settings.json"))).toBe(true);
		expect(await pathExists(legacyDir)).toBe(false);
	});

	test("does not overwrite an existing real global kit directory", async () => {
		const legacyDir = join(localAppData, ".claude");
		await mkdir(legacyDir, { recursive: true });
		await mkdir(targetDir, { recursive: true });
		await writeFile(join(legacyDir, "metadata.json"), JSON.stringify({ version: "old" }));
		await writeFile(join(targetDir, "metadata.json"), JSON.stringify({ version: "current" }));

		const result = await repairLegacyWindowsGlobalKitDir({
			targetDir,
			platform: "win32",
			homeDir,
			env: { LOCALAPPDATA: localAppData },
		});

		expect(result.status).toBe("skipped");
		expect(result.reason).toBe("target-exists");
		expect(await pathExists(join(legacyDir, "metadata.json"))).toBe(true);
		expect(await pathExists(join(targetDir, "metadata.json"))).toBe(true);
	});

	test("ignores empty legacy directories without kit markers", async () => {
		const legacyDir = join(localAppData, ".claude");
		await mkdir(legacyDir, { recursive: true });

		const result = await repairLegacyWindowsGlobalKitDir({
			targetDir,
			platform: "win32",
			homeDir,
			env: { LOCALAPPDATA: localAppData },
		});

		expect(result.status).toBe("skipped");
		expect(result.reason).toBe("no-legacy-dir");
		expect(await pathExists(targetDir)).toBe(false);
		expect(await pathExists(legacyDir)).toBe(true);
	});

	test("skips on non-Windows platforms even with kit markers present", async () => {
		const legacyDir = join(localAppData, ".claude");
		await mkdir(legacyDir, { recursive: true });
		await writeFile(join(legacyDir, "metadata.json"), "{}");

		const result = await repairLegacyWindowsGlobalKitDir({
			targetDir,
			platform: "linux",
			homeDir,
			env: { LOCALAPPDATA: localAppData },
		});

		expect(result.status).toBe("skipped");
		expect(result.reason).toBe("not-windows");
		expect(await pathExists(legacyDir)).toBe(true);
		expect(await pathExists(targetDir)).toBe(false);
	});

	test("skips when multiple legacy candidates both contain kit markers (ambiguous)", async () => {
		const legacyLocal = join(localAppData, ".claude");
		const legacyRoaming = join(appData, ".claude");
		await mkdir(legacyLocal, { recursive: true });
		await mkdir(legacyRoaming, { recursive: true });
		await writeFile(join(legacyLocal, "metadata.json"), JSON.stringify({ source: "local" }));
		await writeFile(join(legacyRoaming, "metadata.json"), JSON.stringify({ source: "roaming" }));

		const result = await repairLegacyWindowsGlobalKitDir({
			targetDir,
			platform: "win32",
			homeDir,
			env: { LOCALAPPDATA: localAppData, APPDATA: appData },
		});

		expect(result.status).toBe("skipped");
		expect(result.reason).toBe("ambiguous-legacy-dirs");
		expect(await pathExists(join(legacyLocal, "metadata.json"))).toBe(true);
		expect(await pathExists(join(legacyRoaming, "metadata.json"))).toBe(true);
		expect(await pathExists(targetDir)).toBe(false);
	});

	test("skips when CLAUDE_CONFIG_DIR selects an explicit custom global target", async () => {
		const legacyDir = join(localAppData, ".claude");
		await mkdir(legacyDir, { recursive: true });
		await writeFile(join(legacyDir, "metadata.json"), "{}");

		const result = await repairLegacyWindowsGlobalKitDir({
			targetDir,
			platform: "win32",
			homeDir,
			env: { LOCALAPPDATA: localAppData, CLAUDE_CONFIG_DIR: join(homeDir, ".claude-work") },
		});

		expect(result.status).toBe("skipped");
		expect(result.reason).toBe("custom-global-dir");
		expect(await pathExists(legacyDir)).toBe(true);
	});
});
