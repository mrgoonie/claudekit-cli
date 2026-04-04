/**
 * Update CLI Command
 * Updates the ClaudeKit CLI package to the latest version.
 *
 * This file is the thin orchestrator and public API surface.
 * Implementation is split across src/commands/update/:
 *   - error.ts              — CliUpdateError class
 *   - types.ts              — shared types for the update pipeline
 *   - channel-resolver.ts   — npm dist-tag/version resolution
 *   - registry-client.ts    — credential-redaction utilities
 *   - version-comparator.ts — semver comparison + dev-channel-switch detection
 *   - package-manager-runner.ts — update command execution + verification
 *   - post-update-handler.ts    — kit init (step 2) + provider migrate (step 3)
 */

import { NpmRegistryClient } from "@/domains/github/npm-registry.js";
import { PackageManagerDetector } from "@/domains/installation/package-manager-detector.js";
import { CLAUDEKIT_CLI_NPM_PACKAGE_NAME } from "@/shared/claudekit-constants.js";
import { logger } from "@/shared/logger.js";
import { confirm, intro, isCancel, note, outro, spinner } from "@/shared/safe-prompts.js";
import { type UpdateCliOptions, UpdateCliOptionsSchema } from "@/types";
import packageInfo from "../../package.json" assert { type: "json" };
import { resolveTargetVersion } from "./update/channel-resolver.js";
import { CliUpdateError } from "./update/error.js";
import {
	runPackageManagerUpdate,
	verifyInstalledVersion,
} from "./update/package-manager-runner.js";
import { promptKitUpdate, promptMigrateUpdate } from "./update/post-update-handler.js";
import { redactCommandForLog } from "./update/registry-client.js";
import type {
	UpdateCliNpmRegistryClient,
	UpdateCliPackageManagerDetector,
} from "./update/types.js";
import { compareCliVersions } from "./update/version-comparator.js";

// ─── Re-exports for backward compatibility ────────────────────────────────────
// All consumers (tests, system-routes.ts, command-registry.ts) import from here.

export { CliUpdateError } from "./update/error.js";
// isBetaVersion and parseCliVersionFromOutput live in version-comparator; post-update-handler
// imports them from there. Exporting from the canonical source avoids duplicate bindings.
export { isBetaVersion, parseCliVersionFromOutput } from "./update/version-comparator.js";
export {
	buildInitCommand,
	fetchLatestReleaseTag,
	promptKitUpdate,
	promptMigrateUpdate,
	readMetadataFile,
	selectKitForUpdate,
} from "./update/post-update-handler.js";
export { redactCommandForLog } from "./update/registry-client.js";
export type {
	KitSelectionParams,
	KitSelectionResult,
} from "./update/types.js";
export type { PromptKitUpdateDeps, PromptMigrateUpdateDeps } from "./update/post-update-handler.js";

// ─── Orchestrator types ───────────────────────────────────────────────────────

export interface UpdateCliCommandDeps {
	currentVersion: string;
	execAsyncFn: (
		command: string,
		options?: { timeout?: number },
	) => Promise<{ stdout?: string; stderr?: string } | string>;
	packageManagerDetector: UpdateCliPackageManagerDetector;
	npmRegistryClient: UpdateCliNpmRegistryClient;
	promptKitUpdateFn: typeof promptKitUpdate;
	promptMigrateUpdateFn: () => Promise<void>;
}

function getDefaultUpdateCliCommandDeps(): UpdateCliCommandDeps {
	return {
		currentVersion: packageInfo.version,
		execAsyncFn: async (cmd, opts) => {
			const { exec } = await import("node:child_process");
			const { promisify } = await import("node:util");
			const result = await promisify(exec)(cmd, opts);
			// promisify(exec) returns Buffer|string per encoding; cast to string form
			return { stdout: String(result.stdout ?? ""), stderr: String(result.stderr ?? "") };
		},
		packageManagerDetector: PackageManagerDetector,
		npmRegistryClient: NpmRegistryClient,
		promptKitUpdateFn: promptKitUpdate,
		promptMigrateUpdateFn: promptMigrateUpdate,
	};
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

/**
 * Update CLI command — updates the ClaudeKit CLI package itself.
 * Orchestrates: channel resolution → version compare → pm update → verification → post-update steps.
 */
export async function updateCliCommand(
	options: UpdateCliOptions,
	deps: UpdateCliCommandDeps = getDefaultUpdateCliCommandDeps(),
): Promise<void> {
	const s = spinner();

	intro("[>] ClaudeKit CLI - Update");

	try {
		const {
			currentVersion,
			execAsyncFn,
			packageManagerDetector,
			npmRegistryClient,
			promptKitUpdateFn,
			promptMigrateUpdateFn,
		} = deps;

		const opts = UpdateCliOptionsSchema.parse(options);

		logger.info(`Current CLI version: ${currentVersion}`);

		// ── Detect package manager ──────────────────────────────────────────
		s.start("Detecting package manager...");
		const pm = await packageManagerDetector.detect();
		const pmVersion = await packageManagerDetector.getVersion(pm);
		s.stop(
			`Using ${packageManagerDetector.getDisplayName(pm)}${pmVersion ? ` v${pmVersion}` : ""}`,
		);
		logger.verbose(`Detected package manager: ${pm}`);

		// Resolve registry URL: user flag > npm config > default
		let registryUrl = opts.registry;
		if (!registryUrl && pm === "npm") {
			const userRegistry = await packageManagerDetector.getNpmRegistryUrl();
			if (userRegistry) {
				registryUrl = userRegistry;
				const { redactRegistryUrlForLog } = await import("@/domains/github/npm-registry.js");
				logger.verbose(`Using npm configured registry: ${redactRegistryUrlForLog(registryUrl)}`);
			}
		}

		// ── Resolve target version ──────────────────────────────────────────
		s.start("Checking for updates...");
		const { targetVersion, targetIsPrerelease } = await resolveTargetVersion(opts, {
			npmRegistryClient,
			registryUrl,
			spinnerStop: (msg) => s.stop(msg),
		});

		// ── Compare versions ────────────────────────────────────────────────
		const outcome = compareCliVersions(currentVersion, targetVersion, opts);

		if (outcome.status === "up-to-date") {
			outro(`[+] Already on the latest CLI version (${currentVersion})`);
			await promptKitUpdateFn(targetIsPrerelease, opts.yes);
			await promptMigrateUpdateFn();
			return;
		}

		if (outcome.status === "newer") {
			outro(`[+] Current version (${currentVersion}) is newer than latest (${targetVersion})`);
			await promptKitUpdateFn(targetIsPrerelease, opts.yes);
			await promptMigrateUpdateFn();
			return;
		}

		const isUpgrade = outcome.changeType === "upgrade";
		const changeType = outcome.changeType;
		logger.info(
			`${isUpgrade ? "[^]" : "[v]"}  ${changeType}: ${currentVersion} -> ${targetVersion}`,
		);

		// ── Check flag: just display and exit ───────────────────────────────
		if (opts.check) {
			note(
				`CLI update available: ${currentVersion} -> ${targetVersion}\n\nRun 'ck update' to install`,
				"Update Check",
			);
			await promptKitUpdateFn(targetIsPrerelease, opts.yes);
			await promptMigrateUpdateFn();
			outro("Check complete");
			return;
		}

		// ── Confirmation prompt (unless --yes) ──────────────────────────────
		if (!opts.yes) {
			const shouldUpdate = await confirm({
				message: `${isUpgrade ? "Update" : "Downgrade"} CLI from ${currentVersion} to ${targetVersion}?`,
			});
			if (isCancel(shouldUpdate) || !shouldUpdate) {
				outro("Update cancelled");
				return;
			}
		}

		// ── Execute update ──────────────────────────────────────────────────
		const updateCmd = packageManagerDetector.getUpdateCommand(
			pm,
			CLAUDEKIT_CLI_NPM_PACKAGE_NAME,
			targetVersion,
			registryUrl,
		);
		logger.info(`Running: ${redactCommandForLog(updateCmd)}`);

		await runPackageManagerUpdate(updateCmd, pm, {
			execAsyncFn,
			spinnerStart: (msg) => s.start(msg),
			spinnerStop: (msg) => s.stop(msg),
		});

		// ── Verify + success ────────────────────────────────────────────────
		const activeVersion = await verifyInstalledVersion(targetVersion, updateCmd, {
			execAsyncFn,
			spinnerStart: (msg) => s.start(msg),
			spinnerStop: (msg) => s.stop(msg),
		});

		outro(`[+] Successfully updated ClaudeKit CLI to ${activeVersion}`);
		await promptKitUpdateFn(targetIsPrerelease, opts.yes);
		await promptMigrateUpdateFn();
	} catch (error) {
		if (error instanceof CliUpdateError) {
			// Already logged by the inner catch — just re-throw without duplicate logging
			throw error;
		}
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		logger.error(`Update failed: ${errorMessage}`);
		throw new CliUpdateError(errorMessage);
	}
}
