/**
 * Uninstall Command
 *
 * Main orchestrator for the uninstall command.
 */

import { getInstalledKits } from "@/domains/migration/metadata-migration.js";
import { ManifestWriter } from "@/services/file-operations/manifest-writer.js";
import { logger } from "@/shared/logger.js";
import { confirm, intro, isCancel, log, note, outro, select } from "@/shared/safe-prompts.js";
import { type UninstallCommandOptions, UninstallCommandOptionsSchema } from "@/types";
import pc from "picocolors";
import { type Installation, detectInstallations } from "./installation-detector.js";
import { removeInstallations } from "./removal-handler.js";

type UninstallScope = "all" | "local" | "global";

function displayInstallations(installations: Installation[], scope: UninstallScope): void {
	intro("ClaudeKit Uninstaller");

	const scopeLabel = scope === "all" ? "all" : scope === "local" ? "local only" : "global only";

	note(
		installations.map((i) => `  ${i.type === "local" ? "Local " : "Global"}: ${i.path}`).join("\n"),
		`Detected ClaudeKit installations (${scopeLabel})`,
	);

	log.warn("[!] This will permanently delete ClaudeKit files from the above paths.");
}

async function promptScope(installations: Installation[]): Promise<UninstallScope | null> {
	const hasLocal = installations.some((i) => i.type === "local");
	const hasGlobal = installations.some((i) => i.type === "global");

	// If only one type exists, no need to prompt
	if (hasLocal && !hasGlobal) return "local";
	if (hasGlobal && !hasLocal) return "global";

	// Both exist, let user choose
	const options: { value: UninstallScope; label: string; hint: string }[] = [
		{ value: "local", label: "Local only", hint: "Remove from current project (.claude/)" },
		{ value: "global", label: "Global only", hint: "Remove from user directory (~/.claude/)" },
		{ value: "all", label: "Both", hint: "Remove all ClaudeKit installations" },
	];

	const selected = await select<
		{ value: UninstallScope; label: string; hint: string }[],
		UninstallScope
	>({
		message: "Which installation(s) do you want to uninstall?",
		options,
	});

	if (isCancel(selected)) {
		return null;
	}

	return selected;
}

async function confirmUninstall(scope: UninstallScope, kitLabel = ""): Promise<boolean> {
	const scopeText =
		scope === "all"
			? "all ClaudeKit installations"
			: scope === "local"
				? "local ClaudeKit installation"
				: "global ClaudeKit installation";

	const confirmed = await confirm({
		message: `Continue with uninstalling ${scopeText}${kitLabel}?`,
		initialValue: false,
	});

	return confirmed === true;
}

export async function uninstallCommand(options: UninstallCommandOptions): Promise<void> {
	try {
		// 1. Validate options
		const validOptions = UninstallCommandOptionsSchema.parse(options);

		// 2. Detect installations
		const allInstallations = await detectInstallations();

		// 3. Check if any found
		if (allInstallations.length === 0) {
			logger.info("No ClaudeKit installations found.");
			return;
		}

		// 4. Validate --kit flag if provided
		if (validOptions.kit) {
			// Check if kit is installed in any installation
			let kitFound = false;
			for (const inst of allInstallations) {
				const metadata = await ManifestWriter.readManifest(inst.path);
				if (metadata) {
					const installedKits = getInstalledKits(metadata);
					if (installedKits.includes(validOptions.kit)) {
						kitFound = true;
						break;
					}
				}
			}
			if (!kitFound) {
				logger.info(`Kit "${validOptions.kit}" is not installed.`);
				return;
			}
		}

		// 5. Determine scope (from flags or interactive prompt)
		let scope: UninstallScope;
		if (validOptions.all || (validOptions.local && validOptions.global)) {
			scope = "all";
		} else if (validOptions.local) {
			scope = "local";
		} else if (validOptions.global) {
			scope = "global";
		} else {
			// Interactive: prompt user to choose scope
			const promptedScope = await promptScope(allInstallations);
			if (!promptedScope) {
				logger.info("Uninstall cancelled.");
				return;
			}
			scope = promptedScope;
		}

		// 6. Filter installations by scope
		const installations = allInstallations.filter((i) => {
			if (scope === "all") return true;
			return i.type === scope;
		});

		if (installations.length === 0) {
			const scopeLabel = scope === "local" ? "local" : "global";
			logger.info(`No ${scopeLabel} ClaudeKit installation found.`);
			return;
		}

		// 7. Display found installations
		displayInstallations(installations, scope);
		if (validOptions.kit) {
			log.info(pc.cyan(`Kit-scoped uninstall: ${validOptions.kit} kit only`));
		}

		// 8. Dry-run mode - skip confirmation
		if (validOptions.dryRun) {
			log.info(pc.yellow("DRY RUN MODE - No files will be deleted"));
			await removeInstallations(installations, {
				dryRun: true,
				forceOverwrite: validOptions.forceOverwrite,
				kit: validOptions.kit,
			});
			outro("Dry-run complete. No changes were made.");
			return;
		}

		// 9. Force-overwrite warning
		if (validOptions.forceOverwrite) {
			log.warn(
				`${pc.yellow(pc.bold("FORCE MODE ENABLED"))}\n${pc.yellow("User modifications will be permanently deleted!")}`,
			);
		}

		// 10. Confirm deletion
		if (!validOptions.yes) {
			const kitLabel = validOptions.kit ? ` (${validOptions.kit} kit only)` : "";
			const confirmed = await confirmUninstall(scope, kitLabel);
			if (!confirmed) {
				logger.info("Uninstall cancelled.");
				return;
			}
		}

		// 11. Remove files using manifest
		await removeInstallations(installations, {
			dryRun: false,
			forceOverwrite: validOptions.forceOverwrite,
			kit: validOptions.kit,
		});

		// 12. Success message
		const kitMsg = validOptions.kit ? ` (${validOptions.kit} kit)` : "";
		outro(`ClaudeKit${kitMsg} uninstalled successfully!`);
	} catch (error) {
		logger.error(error instanceof Error ? error.message : "Unknown error");
		process.exit(1);
	}
}
