/**
 * Windows-focused mismatch-path coverage for update-cli.
 *
 * Uses dependency injection to avoid module-cache races with other test files.
 */
import { describe, expect, it, mock } from "bun:test";
import { CliUpdateError, type UpdateCliCommandDeps, updateCliCommand } from "@/commands/update-cli.js";

describe("update-cli windows integration behavior", () => {
	it("throws mismatch error with Windows `where ck` guidance when active version remains old", async () => {
		const execAsyncFn = mock(
			async (command: string): Promise<{ stdout: string; stderr: string }> => {
				if (command.startsWith("npm install -g claudekit-cli@")) {
					return { stdout: "", stderr: "" };
				}

				if (command === "ck --version") {
					return {
						stdout: "CLI Version: 3.34.0\nGlobal Kit Version: engineer@v2.12.0",
						stderr: "",
					};
				}

				throw new Error(`Unexpected command in test: ${command}`);
			},
		);

		const promptKitUpdateFn = mock(async () => {});

		const deps: UpdateCliCommandDeps = {
			currentVersion: "3.34.0",
			execAsyncFn,
			packageManagerDetector: {
				detect: mock(async () => "npm" as const),
				getVersion: mock(async () => "10.9.0"),
				getDisplayName: mock(() => "npm"),
				getNpmRegistryUrl: mock(async () => null),
				getUpdateCommand: mock(() => "npm install -g claudekit-cli@3.34.5"),
			},
			npmRegistryClient: {
				versionExists: mock(async () => true),
				getDevVersion: mock(async () => null),
				getLatestVersion: mock(async () => "3.34.5"),
			},
			promptKitUpdateFn,
		};

		const options = {
			release: "3.34.5",
			check: false,
			yes: true,
			dev: false,
			beta: false,
			verbose: false,
			json: false,
		};

		let thrown: unknown;
		try {
			await updateCliCommand(options, deps);
		} catch (error) {
			thrown = error;
		}

		expect(thrown).toBeInstanceOf(CliUpdateError);
		const message = thrown instanceof Error ? thrown.message : String(thrown);
		expect(message).toContain("Update did not activate the requested version.");
		expect(message).toContain("Expected: 3.34.5");
		expect(message).toContain("Active ck: 3.34.0");
		expect(message).toContain("Windows: where ck");

		expect(execAsyncFn).toHaveBeenCalledWith(
			"npm install -g claudekit-cli@3.34.5",
			expect.any(Object),
		);
		expect(execAsyncFn).toHaveBeenCalledWith("ck --version", expect.any(Object));
		expect(promptKitUpdateFn).not.toHaveBeenCalled();
	});
});
