import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { uninstallDesktopBinary } from "@/domains/desktop/desktop-uninstaller.js";

describe("desktop-uninstaller", () => {
	const originalTestHome = process.env.CK_TEST_HOME;

	beforeEach(() => {
		process.env.CK_TEST_HOME = "/tmp/ck-phase-4-home";
	});

	afterEach(() => {
		process.env.CK_TEST_HOME = originalTestHome;
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
});
