import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { chmod, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { installDesktopBinary } from "@/domains/desktop/desktop-installer.js";

describe("desktop-installer", () => {
	const originalTestHome = process.env.CK_TEST_HOME;

	beforeEach(() => {
		process.env.CK_TEST_HOME = "/tmp/ck-phase-3-installer-home";
	});

	afterEach(async () => {
		process.env.CK_TEST_HOME = originalTestHome;
		await rm("/tmp/ck-phase-3-installer-home", { recursive: true, force: true });
		await rm("/tmp/ck-phase-3-installer-fixtures", { recursive: true, force: true });
	});

	test("installs a linux AppImage into the user-local bin directory", async () => {
		const fixturesDir = "/tmp/ck-phase-3-installer-fixtures";
		await mkdir(fixturesDir, { recursive: true });
		const sourcePath = join(fixturesDir, "claudekit-control-center.AppImage");
		await writeFile(sourcePath, "linux-binary");
		await chmod(sourcePath, 0o644);

		const installedPath = await installDesktopBinary(sourcePath, {
			platform: "linux",
		});

		expect(installedPath).toBe(
			"/tmp/ck-phase-3-installer-home/.local/bin/claudekit-control-center",
		);
		expect(await Bun.file(installedPath).text()).toBe("linux-binary");
		expect((await stat(installedPath)).mode & 0o111).toBeGreaterThan(0);
	});

	test("installs a macOS app bundle from a zip staging directory and clears quarantine", async () => {
		const fixturesDir = "/tmp/ck-phase-3-installer-fixtures";
		await mkdir(fixturesDir, { recursive: true });
		const downloadPath = join(fixturesDir, "claudekit-control-center.app.zip");
		await writeFile(downloadPath, "placeholder");
		const removeQuarantineFn = mock(async (_path: string) => {});

		const installedPath = await installDesktopBinary(downloadPath, {
			platform: "darwin",
			extractZipFn: async (_source, config) => {
				const appDir = join(config.dir, "ClaudeKit Control Center.app", "Contents");
				await mkdir(appDir, { recursive: true });
				await writeFile(join(appDir, "Info.plist"), "<plist />");
			},
			removeQuarantineFn,
		});

		expect(installedPath).toBe(
			"/tmp/ck-phase-3-installer-home/Applications/ClaudeKit Control Center.app",
		);
		expect(await Bun.file(join(installedPath, "Contents", "Info.plist")).text()).toContain("plist");
		expect(removeQuarantineFn).toHaveBeenCalledWith(`${installedPath}.new`);
	});

	test("preserves the existing macOS install when quarantine removal fails before swap", async () => {
		const currentInstallPath =
			"/tmp/ck-phase-3-installer-home/Applications/ClaudeKit Control Center.app/Contents";
		await mkdir(currentInstallPath, { recursive: true });
		await writeFile(join(currentInstallPath, "Info.plist"), "old-version");

		const fixturesDir = "/tmp/ck-phase-3-installer-fixtures";
		await mkdir(fixturesDir, { recursive: true });
		const downloadPath = join(fixturesDir, "claudekit-control-center.app.zip");
		await writeFile(downloadPath, "placeholder");

		await expect(
			installDesktopBinary(downloadPath, {
				platform: "darwin",
				extractZipFn: async (_source, config) => {
					const appDir = join(config.dir, "ClaudeKit Control Center.app", "Contents");
					await mkdir(appDir, { recursive: true });
					await writeFile(join(appDir, "Info.plist"), "new-version");
				},
				removeQuarantineFn: async () => {
					throw new Error("quarantine failed");
				},
			}),
		).rejects.toThrow(/quarantine failed/);

		expect(
			await Bun.file(
				"/tmp/ck-phase-3-installer-home/Applications/ClaudeKit Control Center.app/Contents/Info.plist",
			).text(),
		).toBe("old-version");
	});
});
