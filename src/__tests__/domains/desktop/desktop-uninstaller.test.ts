import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getDesktopInstallMetadataPath } from "@/domains/desktop/desktop-install-path-resolver.js";
import { uninstallDesktopBinary } from "@/domains/desktop/desktop-uninstaller.js";

describe("desktop-uninstaller", () => {
	const originalTestHome = process.env.CK_TEST_HOME;

	beforeEach(() => {
		process.env.CK_TEST_HOME = "/tmp/ck-phase-4-home";
	});

	afterEach(() => {
		process.env.CK_TEST_HOME = originalTestHome;
		return rm("/tmp/ck-phase-4-home", { recursive: true, force: true });
	});

	test("returns a no-op result when the desktop binary is missing", async () => {
		const removeFn = mock(async () => {});

		const result = await uninstallDesktopBinary({
			platform: "linux",
			pathExistsFn: async () => false,
			removeFn,
		});

		expect(result).toEqual({
			path: "/tmp/ck-phase-4-home/.local/bin/claudekit-control-center",
			removed: false,
		});
		expect(removeFn).not.toHaveBeenCalled();
	});

	test("removes the installed desktop binary when present", async () => {
		const removeFn = mock(async () => {});

		const result = await uninstallDesktopBinary({
			platform: "linux",
			pathExistsFn: async () => true,
			removeFn,
		});

		expect(removeFn).toHaveBeenCalledWith(
			"/tmp/ck-phase-4-home/.local/bin/claudekit-control-center",
		);
		expect(result).toEqual({
			path: "/tmp/ck-phase-4-home/.local/bin/claudekit-control-center",
			removed: true,
		});
	});

	test("removes install metadata when uninstalling the desktop binary", async () => {
		const installDir = "/tmp/ck-phase-4-home/.local/bin";
		await mkdir(installDir, { recursive: true });
		await writeFile(join(installDir, "claudekit-control-center"), "binary");
		await writeFile(getDesktopInstallMetadataPath({ platform: "linux" }), "{}");

		await uninstallDesktopBinary({
			platform: "linux",
		});

		await expect(
			Bun.file(getDesktopInstallMetadataPath({ platform: "linux" })).text(),
		).rejects.toThrow();
	});

	test("does not fail the uninstall when metadata cleanup throws after removal", async () => {
		const removeFn = mock(async () => {});

		const result = await uninstallDesktopBinary({
			platform: "linux",
			pathExistsFn: async () => true,
			removeFn,
			clearInstallMetadataFn: async () => {
				throw new Error("metadata cleanup failed");
			},
		});

		expect(removeFn).toHaveBeenCalledWith(
			"/tmp/ck-phase-4-home/.local/bin/claudekit-control-center",
		);
		expect(result).toEqual({
			path: "/tmp/ck-phase-4-home/.local/bin/claudekit-control-center",
			removed: true,
		});
	});
});
