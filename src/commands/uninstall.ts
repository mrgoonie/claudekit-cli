import { readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { getClaudeKitSetup } from "@/services/file-operations/claudekit-scanner.js";
import { ManifestWriter } from "@/services/file-operations/manifest-writer.js";
import { OwnershipChecker } from "@/services/file-operations/ownership-checker.js";
import { logger } from "@/shared/logger.js";
import { confirm, intro, isCancel, log, note, outro, select } from "@/shared/safe-prompts.js";
import { createSpinner } from "@/shared/safe-spinner.js";
import type { UninstallCommandOptions } from "@/types";
import { UninstallCommandOptionsSchema } from "@/types";
import { pathExists, remove } from "fs-extra";
import pc from "picocolors";

interface Installation {
	type: "local" | "global";
	path: string;
	exists: boolean;
}

type UninstallScope = "all" | "local" | "global";

async function detectInstallations(): Promise<Installation[]> {
	const installations: Installation[] = [];

	// Detect both local and global installations
	const setup = await getClaudeKitSetup(process.cwd());

	// Add local installation if found (must have metadata to be valid ClaudeKit installation)
	if (setup.project.path && setup.project.metadata) {
		installations.push({
			type: "local",
			path: setup.project.path,
			exists: await pathExists(setup.project.path),
		});
	}

	// Add global installation if found (must have metadata to be valid ClaudeKit installation)
	if (setup.global.path && setup.global.metadata) {
		installations.push({
			type: "global",
			path: setup.global.path,
			exists: await pathExists(setup.global.path),
		});
	}

	return installations.filter((i) => i.exists);
}

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

async function confirmUninstall(scope: UninstallScope): Promise<boolean> {
	const scopeText =
		scope === "all"
			? "all ClaudeKit installations"
			: scope === "local"
				? "local ClaudeKit installation"
				: "global ClaudeKit installation";

	const confirmed = await confirm({
		message: `Continue with uninstalling ${scopeText}?`,
		initialValue: false,
	});

	return confirmed === true;
}

/**
 * Result of analyzing what would be removed
 */
interface UninstallAnalysis {
	toDelete: { path: string; reason: string }[];
	toPreserve: { path: string; reason: string }[];
}

/**
 * Remove empty parent directories up to the installation root
 */
async function cleanupEmptyDirectories(
	filePath: string,
	installationRoot: string,
): Promise<number> {
	let cleaned = 0;
	let currentDir = dirname(filePath);

	while (currentDir !== installationRoot && currentDir.startsWith(installationRoot)) {
		try {
			const entries = readdirSync(currentDir);
			if (entries.length === 0) {
				rmSync(currentDir, { recursive: true });
				cleaned++;
				logger.debug(`Removed empty directory: ${currentDir}`);
				currentDir = dirname(currentDir);
			} else {
				break; // Directory not empty, stop
			}
		} catch {
			break; // Can't read directory, stop
		}
	}

	return cleaned;
}

/**
 * Analyze installation for uninstall (used by both dry-run and actual removal)
 */
async function analyzeInstallation(
	installation: Installation,
	forceOverwrite: boolean,
): Promise<UninstallAnalysis> {
	const result: UninstallAnalysis = { toDelete: [], toPreserve: [] };
	const metadata = await ManifestWriter.readManifest(installation.path);

	if (!metadata?.files || metadata.files.length === 0) {
		// Legacy mode - just mark directories for deletion
		const { filesToRemove, filesToPreserve } = await ManifestWriter.getUninstallManifest(
			installation.path,
		);
		for (const item of filesToRemove) {
			if (!filesToPreserve.includes(item)) {
				result.toDelete.push({ path: item, reason: "legacy installation" });
			}
		}
		return result;
	}

	// Ownership-aware analysis
	for (const trackedFile of metadata.files) {
		const filePath = join(installation.path, trackedFile.path);
		const ownershipResult = await OwnershipChecker.checkOwnership(
			filePath,
			metadata,
			installation.path,
		);

		if (!ownershipResult.exists) continue;

		if (ownershipResult.ownership === "ck") {
			result.toDelete.push({ path: trackedFile.path, reason: "CK-owned (pristine)" });
		} else if (ownershipResult.ownership === "ck-modified") {
			if (forceOverwrite) {
				result.toDelete.push({ path: trackedFile.path, reason: "force overwrite" });
			} else {
				result.toPreserve.push({ path: trackedFile.path, reason: "modified by user" });
			}
		} else {
			result.toPreserve.push({ path: trackedFile.path, reason: "user-created" });
		}
	}

	// Always delete metadata.json
	result.toDelete.push({ path: "metadata.json", reason: "metadata file" });

	return result;
}

/**
 * Display dry-run preview
 */
function displayDryRunPreview(analysis: UninstallAnalysis, installationType: string): void {
	console.log("");
	log.info(pc.bold(`DRY RUN - Preview for ${installationType} installation:`));
	console.log("");

	if (analysis.toDelete.length > 0) {
		console.log(pc.red(pc.bold(`Files to DELETE (${analysis.toDelete.length}):`)));
		const showDelete = analysis.toDelete.slice(0, 10);
		for (const item of showDelete) {
			console.log(`  ${pc.red("✖")} ${item.path}`);
		}
		if (analysis.toDelete.length > 10) {
			console.log(pc.gray(`  ... and ${analysis.toDelete.length - 10} more`));
		}
		console.log("");
	}

	if (analysis.toPreserve.length > 0) {
		console.log(pc.green(pc.bold(`Files to PRESERVE (${analysis.toPreserve.length}):`)));
		const showPreserve = analysis.toPreserve.slice(0, 10);
		for (const item of showPreserve) {
			console.log(`  ${pc.green("✓")} ${item.path} ${pc.gray(`(${item.reason})`)}`);
		}
		if (analysis.toPreserve.length > 10) {
			console.log(pc.gray(`  ... and ${analysis.toPreserve.length - 10} more`));
		}
		console.log("");
	}
}

async function removeInstallations(
	installations: Installation[],
	options: { dryRun: boolean; forceOverwrite: boolean },
): Promise<void> {
	for (const installation of installations) {
		// Analyze what would be removed
		const analysis = await analyzeInstallation(installation, options.forceOverwrite);

		// Dry-run mode: just show preview
		if (options.dryRun) {
			displayDryRunPreview(analysis, installation.type);
			continue;
		}

		const spinner = createSpinner(`Removing ${installation.type} ClaudeKit files...`).start();

		try {
			let removedCount = 0;
			let cleanedDirs = 0;

			// Remove files
			for (const item of analysis.toDelete) {
				const filePath = join(installation.path, item.path);
				if (await pathExists(filePath)) {
					await remove(filePath);
					removedCount++;
					logger.debug(`Removed: ${item.path}`);

					// Clean up empty parent directories
					cleanedDirs += await cleanupEmptyDirectories(filePath, installation.path);
				}
			}

			// Check if installation directory is now empty, remove it
			try {
				const remaining = readdirSync(installation.path);
				if (remaining.length === 0) {
					rmSync(installation.path, { recursive: true });
					logger.debug(`Removed empty installation directory: ${installation.path}`);
				}
			} catch {
				// Directory might not exist, ignore
			}

			spinner.succeed(
				`Removed ${removedCount} files${cleanedDirs > 0 ? `, cleaned ${cleanedDirs} empty directories` : ""}, preserved ${analysis.toPreserve.length} customizations`,
			);

			if (analysis.toPreserve.length > 0) {
				log.info("Preserved customizations:");
				analysis.toPreserve.slice(0, 5).forEach((f) => log.message(`  - ${f.path} (${f.reason})`));
				if (analysis.toPreserve.length > 5) {
					log.message(`  ... and ${analysis.toPreserve.length - 5} more`);
				}
			}
		} catch (error) {
			spinner.fail(`Failed to remove ${installation.type} installation`);
			throw new Error(
				`Failed to remove files from ${installation.path}: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}
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

		// 4. Determine scope (from flags or interactive prompt)
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

		// 5. Filter installations by scope
		const installations = allInstallations.filter((i) => {
			if (scope === "all") return true;
			return i.type === scope;
		});

		if (installations.length === 0) {
			const scopeLabel = scope === "local" ? "local" : "global";
			logger.info(`No ${scopeLabel} ClaudeKit installation found.`);
			return;
		}

		// 6. Display found installations
		displayInstallations(installations, scope);

		// 7. Dry-run mode - skip confirmation
		if (validOptions.dryRun) {
			log.info(pc.yellow("DRY RUN MODE - No files will be deleted"));
			await removeInstallations(installations, {
				dryRun: true,
				forceOverwrite: validOptions.forceOverwrite,
			});
			outro("Dry-run complete. No changes were made.");
			return;
		}

		// 8. Force-overwrite warning
		if (validOptions.forceOverwrite) {
			log.warn(
				`${pc.yellow(pc.bold("FORCE MODE ENABLED"))}\n${pc.yellow("User modifications will be permanently deleted!")}`,
			);
		}

		// 9. Confirm deletion
		if (!validOptions.yes) {
			const confirmed = await confirmUninstall(scope);
			if (!confirmed) {
				logger.info("Uninstall cancelled.");
				return;
			}
		}

		// 10. Remove files using manifest
		await removeInstallations(installations, {
			dryRun: false,
			forceOverwrite: validOptions.forceOverwrite,
		});

		// 11. Success message
		outro("ClaudeKit uninstalled successfully!");
	} catch (error) {
		logger.error(error instanceof Error ? error.message : "Unknown error");
		process.exit(1);
	}
}
