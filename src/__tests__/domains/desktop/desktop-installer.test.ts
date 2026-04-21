import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { chmod, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readDesktopInstallMetadata } from "@/domains/desktop/desktop-install-metadata.js";
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
		await writeFile(
			`${sourcePath}.metadata.json`,
			JSON.stringify({
				version: "0.1.0-dev.2",
				manifestDate: "2026-04-19T00:00:00Z",
				channel: "dev",
				platformKey: "linux-x86_64",
				assetName: "claudekit-control-center_0.1.0-dev.2_linux-x86_64.AppImage",
				assetSize: "linux-binary".length,
				installedAt: "2026-04-19T00:00:00Z",
			}),
		);

		const installedPath = await installDesktopBinary(sourcePath, {
			platform: "linux",
		});

		expect(installedPath).toBe(
			"/tmp/ck-phase-3-installer-home/.local/bin/claudekit-control-center",
		);
		expect(await Bun.file(installedPath).text()).toBe("linux-binary");
		expect((await stat(installedPath)).mode & 0o111).toBeGreaterThan(0);
		expect(await readDesktopInstallMetadata({ platform: "linux" })).toEqual({
			version: "0.1.0-dev.2",
			manifestDate: "2026-04-19T00:00:00Z",
			channel: "dev",
			platformKey: "linux-x86_64",
			assetName: "claudekit-control-center_0.1.0-dev.2_linux-x86_64.AppImage",
			assetSize: "linux-binary".length,
			installedAt: "2026-04-19T00:00:00Z",
		});
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

	test("does not fail the install when metadata persistence fails after a successful copy", async () => {
		const fixturesDir = "/tmp/ck-phase-3-installer-fixtures";
		await mkdir(fixturesDir, { recursive: true });
		const sourcePath = join(fixturesDir, "claudekit-control-center.AppImage");
		await writeFile(sourcePath, "linux-binary");

		const installedPath = await installDesktopBinary(sourcePath, {
			platform: "linux",
			readDownloadedMetadataFn: async () => ({
				version: "0.1.0-dev.2",
				manifestDate: "2026-04-19T00:00:00Z",
				channel: "dev",
				platformKey: "linux-x86_64",
				assetName: "claudekit-control-center_0.1.0-dev.2_linux-x86_64.AppImage",
				assetSize: "linux-binary".length,
				installedAt: "2026-04-19T00:00:00Z",
			}),
			persistInstallMetadataFn: async () => {
				throw new Error("metadata write failed");
			},
		});

		expect(installedPath).toBe(
			"/tmp/ck-phase-3-installer-home/.local/bin/claudekit-control-center",
		);
		expect(await Bun.file(installedPath).text()).toBe("linux-binary");
	});

	test("keeps a successful linux install when backup cleanup fails after swap", async () => {
		const installDir = "/tmp/ck-phase-3-installer-home/.local/bin";
		await mkdir(installDir, { recursive: true });
		const installedPath = join(installDir, "claudekit-control-center");
		const backupPath = join(installDir, "claudekit-control-center.backup");
		await writeFile(installedPath, "old-linux-binary");

		const fixturesDir = "/tmp/ck-phase-3-installer-fixtures";
		await mkdir(fixturesDir, { recursive: true });
		const sourcePath = join(fixturesDir, "claudekit-control-center.AppImage");
		await writeFile(sourcePath, "new-linux-binary");

		try {
			const result = await installDesktopBinary(sourcePath, {
				platform: "linux",
				readDownloadedMetadataFn: async () => ({
					version: "0.1.0-dev.2",
					manifestDate: "2026-04-19T00:00:00Z",
					channel: "dev",
					platformKey: "linux-x86_64",
					assetName: "claudekit-control-center_0.1.0-dev.2_linux-x86_64.AppImage",
					assetSize: "new-linux-binary".length,
					installedAt: "2026-04-19T00:00:00Z",
				}),
				persistInstallMetadataFn: async () => {
					await chmod(installDir, 0o555);
				},
			});

			expect(result).toBe(installedPath);
			expect(await Bun.file(installedPath).text()).toBe("new-linux-binary");
			expect(await Bun.file(backupPath).text()).toBe("old-linux-binary");
		} finally {
			await chmod(installDir, 0o755);
		}
	});

	test("rejects a linux install when the copied artifact does not match downloaded metadata", async () => {
		const fixturesDir = "/tmp/ck-phase-3-installer-fixtures";
		await mkdir(fixturesDir, { recursive: true });
		const sourcePath = join(fixturesDir, "claudekit-control-center.AppImage");
		await writeFile(sourcePath, "linux-binary");
		await writeFile(
			`${sourcePath}.metadata.json`,
			JSON.stringify({
				version: "0.1.0-dev.7",
				manifestDate: "2026-04-20T00:00:00Z",
				channel: "dev",
				platformKey: "linux-x86_64",
				assetName: "claudekit-control-center_0.1.0-dev.7_linux-x86_64.AppImage",
				assetSize: 999,
				installedAt: "2026-04-20T00:00:00Z",
			}),
		);

		await expect(
			installDesktopBinary(sourcePath, {
				platform: "linux",
			}),
		).rejects.toThrow(/failed validation/i);

		await expect(
			stat("/tmp/ck-phase-3-installer-home/.local/bin/claudekit-control-center"),
		).rejects.toThrow();
		expect(await readDesktopInstallMetadata({ platform: "linux" })).toBeNull();
	});

	test("restores the previous linux binary when validation fails after overwrite", async () => {
		const installDir = "/tmp/ck-phase-3-installer-home/.local/bin";
		await mkdir(installDir, { recursive: true });
		const installedPath = join(installDir, "claudekit-control-center");
		await writeFile(installedPath, "old-linux-binary");

		const fixturesDir = "/tmp/ck-phase-3-installer-fixtures";
		await mkdir(fixturesDir, { recursive: true });
		const sourcePath = join(fixturesDir, "claudekit-control-center.AppImage");
		await writeFile(sourcePath, "new-linux-binary");
		await writeFile(
			`${sourcePath}.metadata.json`,
			JSON.stringify({
				version: "0.1.0-dev.7",
				manifestDate: "2026-04-20T00:00:00Z",
				channel: "dev",
				platformKey: "linux-x86_64",
				assetName: "claudekit-control-center_0.1.0-dev.7_linux-x86_64.AppImage",
				assetSize: 999,
				installedAt: "2026-04-20T00:00:00Z",
			}),
		);

		await expect(
			installDesktopBinary(sourcePath, {
				platform: "linux",
			}),
		).rejects.toThrow(/failed validation/i);

		expect(await Bun.file(installedPath).text()).toBe("old-linux-binary");
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

	test("restores the previous macOS app when the swapped bundle fails release validation", async () => {
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
				readDownloadedMetadataFn: async () => ({
					version: "0.1.0-dev.7",
					manifestDate: "2026-04-20T00:00:00Z",
					channel: "dev",
					platformKey: "darwin-aarch64",
					assetName: "claudekit-control-center_0.1.0-dev.7_macos-universal.app.zip",
					assetSize: 0,
					installedAt: "2026-04-20T00:00:00Z",
				}),
				extractZipFn: async (_source, config) => {
					const appDir = join(config.dir, "ClaudeKit Control Center.app", "Contents");
					await mkdir(appDir, { recursive: true });
					await writeFile(
						join(appDir, "Info.plist"),
						`<?xml version="1.0"?>
<plist>
  <dict>
    <key>CFBundleShortVersionString</key>
    <string>0.1.0-dev.5</string>
  </dict>
</plist>`,
					);
				},
				removeQuarantineFn: async () => {},
			}),
		).rejects.toThrow(/failed validation/i);

		expect(
			await Bun.file(
				"/tmp/ck-phase-3-installer-home/Applications/ClaudeKit Control Center.app/Contents/Info.plist",
			).text(),
		).toBe("old-version");
	});
});
