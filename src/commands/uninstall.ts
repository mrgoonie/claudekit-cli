import { rmSync } from "node:fs";
import { join } from "node:path";
import * as clack from "@clack/prompts";
import { pathExists, remove } from "fs-extra";
import { OwnershipChecker } from "../lib/ownership-checker.js";
import type { UninstallCommandOptions } from "../types.js";
import { UninstallCommandOptionsSchema } from "../types.js";
import { getClaudeKitSetup } from "../utils/claudekit-scanner.js";
import { logger } from "../utils/logger.js";
import { ManifestWriter } from "../utils/manifest-writer.js";
import { createSpinner } from "../utils/safe-spinner.js";

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
	clack.intro("ClaudeKit Uninstaller");

	const scopeLabel = scope === "all" ? "all" : scope === "local" ? "local only" : "global only";

	clack.note(
		installations.map((i) => `  ${i.type === "local" ? "Local " : "Global"}: ${i.path}`).join("\n"),
		`Detected ClaudeKit installations (${scopeLabel})`,
	);

	clack.log.warn("⚠️  This will permanently delete ClaudeKit files from the above paths.");
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

	const selected = await clack.select<
		{ value: UninstallScope; label: string; hint: string }[],
		UninstallScope
	>({
		message: "Which installation(s) do you want to uninstall?",
		options,
	});

	if (clack.isCancel(selected)) {
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

	const confirmed = await clack.confirm({
		message: `Continue with uninstalling ${scopeText}?`,
		initialValue: false,
	});

	return confirmed === true;
}

async function removeInstallations(installations: Installation[]): Promise<void> {
	for (const installation of installations) {
		const spinner = createSpinner(`Removing ${installation.type} ClaudeKit files...`).start();

		try {
			// Load metadata for ownership-aware removal
			const metadata = await ManifestWriter.readManifest(installation.path);

			// Check if we have new ownership tracking (files[] field)
			if (metadata?.files && metadata.files.length > 0) {
				// Ownership-aware removal
				logger.debug("Using ownership-aware removal");

				let removedCount = 0;
				let preservedCount = 0;
				const preserved: string[] = [];

				for (const trackedFile of metadata.files) {
					const filePath = join(installation.path, trackedFile.path);

					// Check current ownership
					const ownershipResult = await OwnershipChecker.checkOwnership(
						filePath,
						metadata,
						installation.path,
					);

					if (!ownershipResult.exists) {
						// File already deleted, skip
						continue;
					}

					if (ownershipResult.ownership === "ck") {
						// CK-owned pristine → safe to remove
						await remove(filePath);
						removedCount++;
						logger.debug(`Removed: ${trackedFile.path}`);
					} else if (ownershipResult.ownership === "ck-modified") {
						// Modified by user → preserve by default
						preserved.push(`${trackedFile.path} (modified)`);
						preservedCount++;
						logger.debug(`Preserved modified: ${trackedFile.path}`);
					} else {
						// User-owned → preserve
						preserved.push(`${trackedFile.path} (user-created)`);
						preservedCount++;
						logger.debug(`Preserved user file: ${trackedFile.path}`);
					}
				}

				// Remove metadata.json itself
				const metadataPath = join(installation.path, "metadata.json");
				if (await pathExists(metadataPath)) {
					await remove(metadataPath);
					removedCount++;
				}

				spinner.succeed(
					`Removed ${removedCount} files, preserved ${preservedCount} customizations`,
				);

				if (preserved.length > 0) {
					clack.log.info("Preserved customizations:");
					preserved.slice(0, 5).forEach((f) => clack.log.message(`  - ${f}`));
					if (preserved.length > 5) {
						clack.log.message(`  ... and ${preserved.length - 5} more`);
					}
				}
			} else {
				// Legacy removal (no ownership tracking)
				logger.debug("No ownership metadata - using legacy uninstall method");

				let removedCount = 0;

				// Get uninstall manifest (uses manifest if available, falls back to legacy)
				const { filesToRemove, filesToPreserve, hasManifest } =
					await ManifestWriter.getUninstallManifest(installation.path);

				if (hasManifest) {
					logger.debug("Using installation manifest for accurate uninstall");
				} else {
					logger.debug("No manifest found, using legacy uninstall method");
				}

				// Remove files/directories from manifest
				for (const item of filesToRemove) {
					// Skip if in preserve list
					if (filesToPreserve.includes(item)) {
						logger.debug(`Preserving user config: ${item}`);
						continue;
					}

					const itemPath = join(installation.path, item);
					if (await pathExists(itemPath)) {
						rmSync(itemPath, { recursive: true, force: true });
						removedCount++;
						logger.debug(`Removed ${installation.type}: ${item}`);
					}
				}

				spinner.succeed(
					`Removed ${removedCount} ${installation.type} ClaudeKit item(s) (preserved user configs)`,
				);
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

		// 7. Confirm deletion
		if (!validOptions.yes) {
			const confirmed = await confirmUninstall(scope);
			if (!confirmed) {
				logger.info("Uninstall cancelled.");
				return;
			}
		}

		// 8. Remove files using manifest
		await removeInstallations(installations);

		// 9. Success message
		clack.outro("ClaudeKit uninstalled successfully!");
	} catch (error) {
		logger.error(error instanceof Error ? error.message : "Unknown error");
		process.exit(1);
	}
}
