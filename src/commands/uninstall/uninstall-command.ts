/**
 * Uninstall Command
 *
 * Main orchestrator for the uninstall command.
 */

import { getInstalledKits } from "@/domains/migration/metadata-migration.js";
import { PromptsManager } from "@/domains/ui/prompts.js";
import { ManifestWriter } from "@/services/file-operations/manifest-writer.js";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
import { confirm, isCancel, log, select } from "@/shared/safe-prompts.js";
import { type UninstallCommandOptions, UninstallCommandOptionsSchema } from "@/types";
import pc from "picocolors";
import { type Installation, detectInstallations } from "./installation-detector.js";
import { removeInstallations } from "./removal-handler.js";

const prompts = new PromptsManager();

type UninstallScope = "all" | "local" | "global";

function formatComponentSummary(inst: Installation): string {
	const parts: string[] = [];
	if (inst.components.skills > 0) parts.push(`${inst.components.skills} skills`);
	if (inst.components.commands > 0) parts.push(`${inst.components.commands} commands`);
	if (inst.components.agents > 0) parts.push(`${inst.components.agents} agents`);
	if (inst.components.rules > 0) parts.push(`${inst.components.rules} rules`);
	return parts.length > 0 ? ` (${parts.join(", ")})` : "";
}

function displayInstallations(installations: Installation[], scope: UninstallScope): void {
	prompts.intro("ClaudeKit Uninstaller");

	const scopeLabel = scope === "all" ? "all" : scope === "local" ? "local only" : "global only";
	const hasLegacy = installations.some((i) => !i.hasMetadata);

	const lines = installations.map((i) => {
		const typeLabel = i.type === "local" ? "Local " : "Global";
		const legacyTag = !i.hasMetadata ? pc.yellow(" [legacy]") : "";
		const components = formatComponentSummary(i);
		return `  ${typeLabel}: ${i.path}${legacyTag}${components}`;
	});

	prompts.note(lines.join("\n"), `Detected ClaudeKit installations (${scopeLabel})`);

	if (hasLegacy) {
		log.warn(
			pc.yellow("[!] Legacy installation(s) detected without metadata.json.\n") +
				pc.yellow(
					"    These files cannot be selectively removed. Full directory cleanup will be performed.",
				),
		);
	}

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

		// 5. Check if running at HOME directory (local === global)
		const isAtHome = PathResolver.isLocalSameAsGlobal();

		// 6. Handle --local flag at HOME directory (invalid scenario)
		if (validOptions.local && !validOptions.global && isAtHome) {
			log.warn(pc.yellow("Cannot use --local at HOME directory (local path equals global path)."));
			log.info("Use -g/--global or run from a project directory.");
			return;
		}

		// 7. Determine scope (from flags or interactive prompt)
		let scope: UninstallScope;
		if (validOptions.all || (validOptions.local && validOptions.global)) {
			scope = "all";
		} else if (validOptions.local) {
			scope = "local";
		} else if (validOptions.global) {
			scope = "global";
		} else if (isAtHome) {
			// At HOME directory: skip scope prompt, auto-select global
			log.info(pc.cyan("Running at HOME directory - targeting global installation"));
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

		// 8. Filter installations by scope
		const installations = allInstallations.filter((i) => {
			if (scope === "all") return true;
			return i.type === scope;
		});

		if (installations.length === 0) {
			const scopeLabel = scope === "local" ? "local" : "global";
			logger.info(`No ${scopeLabel} ClaudeKit installation found.`);
			return;
		}

		// 9. Display found installations
		displayInstallations(installations, scope);
		if (validOptions.kit) {
			log.info(pc.cyan(`Kit-scoped uninstall: ${validOptions.kit} kit only`));
		}

		// 10. Dry-run mode - skip confirmation
		if (validOptions.dryRun) {
			log.info(pc.yellow("DRY RUN MODE - No files will be deleted"));
			await removeInstallations(installations, {
				dryRun: true,
				forceOverwrite: validOptions.forceOverwrite,
				kit: validOptions.kit,
			});
			prompts.outro("Dry-run complete. No changes were made.");
			return;
		}

		// 11. Force-overwrite warning
		if (validOptions.forceOverwrite) {
			log.warn(
				`${pc.yellow(pc.bold("FORCE MODE ENABLED"))}\n${pc.yellow("User modifications will be permanently deleted!")}`,
			);
		}

		// 12. Confirm deletion
		if (!validOptions.yes) {
			const kitLabel = validOptions.kit ? ` (${validOptions.kit} kit only)` : "";
			const confirmed = await confirmUninstall(scope, kitLabel);
			if (!confirmed) {
				logger.info("Uninstall cancelled.");
				return;
			}
		}

		// 13. Remove files using manifest
		await removeInstallations(installations, {
			dryRun: false,
			forceOverwrite: validOptions.forceOverwrite,
			kit: validOptions.kit,
		});

		// 14. Success message
		const kitMsg = validOptions.kit ? ` (${validOptions.kit} kit)` : "";
		prompts.outro(`ClaudeKit${kitMsg} uninstalled successfully!`);
	} catch (error) {
		logger.error(error instanceof Error ? error.message : "Unknown error");
		process.exit(1);
	}
}
