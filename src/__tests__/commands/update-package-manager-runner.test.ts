import { describe, expect, it, mock } from "bun:test";
import { CliUpdateError } from "@/commands/update/error.js";
import {
	CLI_UPDATE_INSTALL_TIMEOUT_MS,
	isNativeDependencyBuildError,
	runPackageManagerUpdate,
} from "@/commands/update/package-manager-runner.js";

describe("package-manager-runner native dependency failures", () => {
	it("detects better-sqlite3 node-gyp failures", () => {
		const message = [
			"prebuild-install warn install No prebuilt binaries found",
			"npm error path C:\\Users\\Admin\\AppData\\Roaming\\npm\\node_modules\\claudekit-cli\\node_modules\\better-sqlite3",
			"npm error gyp ERR! stack Error: Could not find any Visual Studio installation to use",
		].join("\n");

		expect(isNativeDependencyBuildError(message)).toBe(true);
	});

	it("does not classify generic npm failures as native dependency failures", () => {
		expect(isNativeDependencyBuildError("npm error code E404 package not found")).toBe(false);
	});

	it("surfaces targeted guidance for native dependency build failures", async () => {
		const execAsyncFn = mock(async () => {
			throw new Error(
				[
					"prebuild-install warn install No prebuilt binaries found",
					"npm error path node_modules/claudekit-cli/node_modules/better-sqlite3",
					"npm error gyp ERR! stack Error: Could not find any Visual Studio installation to use",
				].join("\n"),
			);
		});
		const spinnerStart = mock(() => {});
		const spinnerStop = mock(() => {});

		let thrown: unknown;
		try {
			await runPackageManagerUpdate("npm.cmd install -g claudekit-cli@4.3.1", "npm", {
				execAsyncFn,
				spinnerStart,
				spinnerStop,
			});
		} catch (error) {
			thrown = error;
		}

		expect(thrown).toBeInstanceOf(CliUpdateError);
		const message = thrown instanceof Error ? thrown.message : String(thrown);
		expect(message).toContain("native optional dependency");
		expect(message).toContain("should not require native SQLite");
		expect(message).toContain("Manual update: npm.cmd install -g claudekit-cli@4.3.1");
		expect(execAsyncFn).toHaveBeenCalledWith("npm.cmd install -g claudekit-cli@4.3.1", {
			timeout: CLI_UPDATE_INSTALL_TIMEOUT_MS,
		});
		expect(spinnerStop).toHaveBeenCalledWith("Update failed");
	});
});
