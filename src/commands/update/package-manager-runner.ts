/**
 * Package Manager Runner
 * Executes npm/bun update commands and verifies the installation result.
 */

import { logger } from "@/shared/logger.js";
import { CliUpdateError } from "./error.js";
import { redactCommandForLog } from "./registry-client.js";
import type { ExecAsyncFn } from "./types.js";
import { parseCliVersionFromOutput } from "./version-comparator.js";

export interface RunUpdateDeps {
	execAsyncFn: ExecAsyncFn;
	spinnerStart: (msg: string) => void;
	spinnerStop: (msg: string) => void;
}

/** Extract stdout string from exec result (handles both string and object forms). */
export function extractCommandStdout(
	result: { stdout?: string; stderr?: string } | string,
): string {
	if (typeof result === "string") return result;
	if (result && typeof result.stdout === "string") return result.stdout;
	return "";
}

/**
 * Execute the package manager update command.
 * Throws CliUpdateError with platform-appropriate guidance on permission or generic failures.
 */
export async function runPackageManagerUpdate(
	updateCmd: string,
	pm: string,
	deps: RunUpdateDeps,
): Promise<void> {
	const { execAsyncFn, spinnerStart, spinnerStop } = deps;

	spinnerStart("Updating CLI...");
	try {
		await execAsyncFn(updateCmd, { timeout: 120000 });
		spinnerStop("Update completed");
	} catch (error) {
		spinnerStop("Update failed");
		const errorMessage = error instanceof Error ? error.message : "Unknown error";

		if (
			errorMessage.includes("EACCES") ||
			errorMessage.includes("EPERM") ||
			errorMessage.includes("permission") ||
			errorMessage.includes("Access is denied")
		) {
			const permHint =
				pm === "npm"
					? "\n\nOr fix npm permissions: https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally"
					: "";
			const isWindows = process.platform === "win32";
			const elevationHint = isWindows
				? `Run your terminal as Administrator and retry: ${updateCmd}`
				: `sudo ${updateCmd}`;
			throw new CliUpdateError(`Permission denied. Try: ${elevationHint}${permHint}`);
		}

		logger.error(`Update failed: ${errorMessage}`);
		logger.info(`Try running: ${updateCmd}`);
		throw new CliUpdateError(`Update failed: ${errorMessage}\n\nManual update: ${updateCmd}`);
	}
}

/**
 * Verify the installed CLI version by running `ck --version`.
 * Throws CliUpdateError with diagnostic guidance on mismatch or parse failure.
 */
export async function verifyInstalledVersion(
	targetVersion: string,
	updateCmd: string,
	deps: RunUpdateDeps,
): Promise<string> {
	const { execAsyncFn, spinnerStart, spinnerStop } = deps;

	spinnerStart("Verifying installation...");
	try {
		const versionResult = await execAsyncFn("ck --version", { timeout: 5000 });
		const stdout = extractCommandStdout(versionResult);
		const activeVersion = parseCliVersionFromOutput(stdout);

		if (!activeVersion) {
			spinnerStop("Verification failed");
			const message = `Update completed but could not parse 'ck --version' output.
Please restart your terminal and run 'ck --version'. Expected: ${targetVersion}

Manual update: ${redactCommandForLog(updateCmd)}`;
			logger.error(message);
			throw new CliUpdateError(message);
		}

		spinnerStop(`Installed version: ${activeVersion}`);

		if (activeVersion !== targetVersion) {
			const mismatchMessage = `Update did not activate the requested version.
Expected: ${targetVersion}
Active ck: ${activeVersion}

Likely causes: multiple global installations (npm/bun/pnpm/yarn) or stale shell shim/cache (common on Windows).
Run '${redactCommandForLog(updateCmd)}' manually, restart terminal, then check command resolution:
- Windows: where ck
- macOS/Linux: which -a ck`;
			logger.error(mismatchMessage);
			throw new CliUpdateError(mismatchMessage);
		}

		return activeVersion;
	} catch (error) {
		if (error instanceof CliUpdateError) throw error;

		spinnerStop("Verification failed");
		const message = `Update completed but automatic verification failed.
Please restart your terminal and run 'ck --version'. Expected: ${targetVersion}

Manual update: ${redactCommandForLog(updateCmd)}`;
		logger.error(message);
		throw new CliUpdateError(message);
	}
}
