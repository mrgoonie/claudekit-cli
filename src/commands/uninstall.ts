import { rmSync } from "node:fs";
import { join } from "node:path";
import * as clack from "@clack/prompts";
import { pathExists } from "fs-extra";
import type { UninstallCommandOptions } from "../types.js";
import { UninstallCommandOptionsSchema } from "../types.js";
import { getClaudeKitSetup } from "../utils/claudekit-scanner.js";
import { logger } from "../utils/logger.js";
import { createSpinner } from "../utils/safe-spinner.js";

/**
 * ClaudeKit-managed subdirectories that should be removed during uninstall
 */
const CLAUDEKIT_SUBDIRECTORIES = ["commands", "agents", "skills", "workflows", "hooks"];

interface Installation {
	type: "local" | "global";
	path: string;
	exists: boolean;
}

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

function displayInstallations(installations: Installation[]): void {
	clack.intro("ClaudeKit Uninstaller");

	clack.note(
		installations.map((i) => `  ${i.type === "local" ? "Local " : "Global"}: ${i.path}`).join("\n"),
		"Detected ClaudeKit installations",
	);

	clack.log.warn("⚠️  This will permanently delete the above directories.");
}

async function confirmUninstall(): Promise<boolean> {
	const confirmed = await clack.confirm({
		message: "Continue with uninstall?",
		initialValue: false,
	});

	return confirmed === true;
}

async function removeInstallations(installations: Installation[]): Promise<void> {
	for (const installation of installations) {
		const spinner = createSpinner(
			`Removing ${installation.type} ClaudeKit subdirectories...`,
		).start();

		try {
			let removedCount = 0;

			// Selectively remove ClaudeKit-managed subdirectories
			for (const subdir of CLAUDEKIT_SUBDIRECTORIES) {
				const subdirPath = join(installation.path, subdir);
				if (await pathExists(subdirPath)) {
					rmSync(subdirPath, { recursive: true, force: true });
					removedCount++;
					logger.debug(`Removed ${installation.type} subdirectory: ${subdir}/`);
				}
			}

			spinner.succeed(
				`Removed ${removedCount} ${installation.type} ClaudeKit subdirectories (preserved user configs)`,
			);
		} catch (error) {
			spinner.fail(`Failed to remove ${installation.type} installation`);
			throw new Error(
				`Failed to remove subdirectories from ${installation.path}: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}
}

export async function uninstallCommand(options: UninstallCommandOptions): Promise<void> {
	try {
		// 1. Validate options
		const validOptions = UninstallCommandOptionsSchema.parse(options);

		// 2. Detect installations
		const installations = await detectInstallations();

		// 3. Check if any found
		if (installations.length === 0) {
			logger.info("No ClaudeKit installations found.");
			return;
		}

		// 4. Display found installations
		displayInstallations(installations);

		// 5. Confirm deletion
		if (!validOptions.yes) {
			const confirmed = await confirmUninstall();
			if (!confirmed) {
				logger.info("Uninstall cancelled.");
				return;
			}
		}

		// 6. Remove directories
		await removeInstallations(installations);

		// 7. Success message
		clack.outro("ClaudeKit uninstalled successfully!");
	} catch (error) {
		logger.error(error instanceof Error ? error.message : "Unknown error");
		process.exit(1);
	}
}
