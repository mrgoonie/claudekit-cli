/**
 * Uninstall Command
 *
 * Main orchestrator for the uninstall command.
 */

import { uninstallEnginePlugin } from "@/domains/installation/plugin/uninstall-plugin.js";
import { getInstalledKits } from "@/domains/migration/metadata-migration.js";
import { PromptsManager } from "@/domains/ui/prompts.js";
import { ManifestWriter } from "@/services/file-operations/manifest-writer.js";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
import { withProcessLock } from "@/shared/process-lock.js";
import { confirm, isCancel, log, select } from "@/shared/safe-prompts.js";
import { type KitType, type UninstallCommandOptions, UninstallCommandOptionsSchema } from "@/types";
import pc from "picocolors";
import { type Installation, detectInstallations } from "./installation-detector.js";
import { removeInstallations } from "./removal-handler.js";

const prompts = new PromptsManager();

type UninstallScope = "all" | "local" | "global";
type KitSelection = KitType | "all";

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

async function getInstallationKits(installation: Installation): Promise<KitType[]> {
	const metadata = await ManifestWriter.readManifest(installation.path);
	return metadata ? getInstalledKits(metadata) : [];
}

async function getInstalledKitSet(installations: Installation[]): Promise<Set<KitType>> {
	const installedKitSet = new Set<KitType>();
	for (const installation of installations) {
		for (const kit of await getInstallationKits(installation)) {
			installedKitSet.add(kit);
		}
	}
	return installedKitSet;
}

async function filterInstallationsByKit(
	installations: Installation[],
	kit: KitType,
): Promise<Installation[]> {
	const filtered: Installation[] = [];
	for (const installation of installations) {
		const installedKits = await getInstallationKits(installation);
		if (installedKits.includes(kit)) {
			filtered.push(installation);
		}
	}
	return filtered;
}

async function promptKitSelection(installedKitSet: Set<KitType>): Promise<KitSelection | null> {
	// Single-kit installs do not need a kit picker; the selected scope is already specific enough.
	if (installedKitSet.size < 2) {
		return "all";
	}

	const kitOrder: KitType[] = ["marketing", "engineer"];
	const kitOptions = kitOrder
		.filter((kit) => installedKitSet.has(kit))
		.map((kit) => ({
			value: kit,
			label: `${kit[0].toUpperCase()}${kit.slice(1)} kit only`,
			hint: "Preserve other installed kit(s) and customizations",
		}));

	const options = [
		...kitOptions,
		{
			value: "all" as const,
			label: "All ClaudeKit kits",
			hint: "Remove the full selected installation scope",
		},
	];

	const selected = await select<typeof options, KitSelection>({
		message: "Multiple kits are installed. What do you want to uninstall?",
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
		message: `Continue with uninstalling ${scopeText}${kitLabel}? A recovery backup will be created first.`,
		initialValue: false,
	});

	return confirmed === true;
}

export async function uninstallCommand(options: UninstallCommandOptions): Promise<void> {
	try {
		await withProcessLock("kit-install", async () => {
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
				log.warn(
					pc.yellow("Cannot use --local at HOME directory (local path equals global path)."),
				);
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
			let installations = allInstallations.filter((i) => {
				if (scope === "all") return true;
				return i.type === scope;
			});

			if (installations.length === 0) {
				const scopeLabel = scope === "local" ? "local" : "global";
				logger.info(`No ${scopeLabel} ClaudeKit installation found.`);
				return;
			}

			// 9. Determine kit scope for multi-kit installs.
			let kitToRemove = validOptions.kit;
			if (!kitToRemove) {
				const installedKitSet = await getInstalledKitSet(installations);
				if (validOptions.yes) {
					if (installedKitSet.size > 1) {
						logger.info(
							"Removing all installed kits (--yes flag bypasses kit prompt; use --kit to scope).",
						);
					}
				} else {
					const selectedKit = await promptKitSelection(installedKitSet);
					if (!selectedKit) {
						logger.info("Uninstall cancelled.");
						return;
					}
					if (selectedKit !== "all") {
						kitToRemove = selectedKit;
					}
				}
			}

			if (kitToRemove) {
				installations = await filterInstallationsByKit(installations, kitToRemove);
				if (installations.length === 0) {
					logger.info(`Kit "${kitToRemove}" is not installed in selected scope.`);
					return;
				}
			}

			// 10. Display found installations
			displayInstallations(installations, scope);
			if (kitToRemove) {
				log.info(pc.cyan(`Kit-scoped uninstall: ${kitToRemove} kit only`));
			}

			// 11. Dry-run mode - skip confirmation
			if (validOptions.dryRun) {
				log.info(pc.yellow("DRY RUN MODE - No files will be deleted"));
				await removeInstallations(installations, {
					dryRun: true,
					forceOverwrite: validOptions.forceOverwrite,
					kit: kitToRemove,
				});
				prompts.outro("Dry-run complete. No changes were made.");
				return;
			}

			// 12. Force-overwrite warning
			if (validOptions.forceOverwrite) {
				log.warn(
					`${pc.yellow(pc.bold("FORCE MODE ENABLED"))}\n${pc.yellow("User modifications will be permanently deleted!")}`,
				);
			}

			// 13. Confirm deletion
			if (!validOptions.yes) {
				const kitLabel = kitToRemove ? ` (${kitToRemove} kit only)` : "";
				const confirmed = await confirmUninstall(scope, kitLabel);
				if (!confirmed) {
					logger.info("Uninstall cancelled.");
					return;
				}
			}

			// 14. Remove files using manifest
			const results = await removeInstallations(installations, {
				dryRun: false,
				forceOverwrite: validOptions.forceOverwrite,
				kit: kitToRemove,
			});

			// 14.5: also remove the engineer plugin (#691) — non-fatal, no-op if not a plugin install
			if (kitToRemove === "engineer" || !kitToRemove) {
				try {
					const pluginResult = await uninstallEnginePlugin();
					if (pluginResult.uninstalled) {
						log.info("Removed ClaudeKit Engineer plugin.");
					}
				} catch (err) {
					logger.verbose(`Plugin uninstall skipped: ${(err as Error).message}`);
				}
			}

			const hasProtectedFiles = results.some((result) => result.protectedTrackedPaths.length > 0);

			// 15. Success message
			const kitMsg = kitToRemove ? ` (${kitToRemove} kit)` : "";
			if (hasProtectedFiles) {
				prompts.outro(
					`ClaudeKit${kitMsg} uninstall completed with preserved customizations. Use --force-overwrite for full removal.`,
				);
				return;
			}

			prompts.outro(`ClaudeKit${kitMsg} uninstalled successfully!`);
		});
	} catch (error) {
		logger.error(error instanceof Error ? error.message : "Unknown error");
		process.exit(1);
	}
}
