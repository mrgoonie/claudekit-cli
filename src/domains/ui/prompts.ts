/**
 * Prompts Manager
 *
 * Facade that re-exports all prompt-related functionality.
 * Individual modules are in ./prompts/ subdirectory.
 */

import type { VersionSelectorOptions } from "@/domains/versioning/version-selector.js";
import {
	isGeminiInstalled,
	isOpenCodeInstalled,
} from "@/services/package-installer/package-installer.js";
import { logger } from "@/shared/logger.js";
import { confirm, intro, isCancel, log, note, outro } from "@/shared/safe-prompts.js";
import type { KitConfig, KitType } from "@/types";

// Re-export all prompts from submodules
export { selectKit, selectKits, getDirectory } from "./prompts/kit-prompts.js";
export {
	selectVersion,
	selectVersionEnhanced,
	getLatestVersion,
} from "./prompts/version-prompts.js";
export {
	promptUpdateMode,
	promptDirectorySelection,
	promptFreshConfirmation,
} from "./prompts/installation-prompts.js";
export {
	confirmAction,
	promptLocalMigration,
	promptSkillsInstallation,
} from "./prompts/confirmation-prompts.js";

import {
	confirmAction,
	promptLocalMigration,
	promptSkillsInstallation,
} from "./prompts/confirmation-prompts.js";
import {
	promptDirectorySelection,
	promptFreshConfirmation,
	promptUpdateMode,
} from "./prompts/installation-prompts.js";
// Import for class methods
import { getDirectory, selectKit, selectKits } from "./prompts/kit-prompts.js";
import {
	getLatestVersion,
	selectVersion,
	selectVersionEnhanced,
} from "./prompts/version-prompts.js";

export class PromptsManager {
	async selectKit(defaultKit?: KitType, accessibleKits?: KitType[]): Promise<KitType> {
		return selectKit(defaultKit, accessibleKits);
	}

	async selectKits(accessibleKits: KitType[]): Promise<KitType[]> {
		return selectKits(accessibleKits);
	}

	async selectVersion(versions: string[], defaultVersion?: string): Promise<string> {
		return selectVersion(versions, defaultVersion);
	}

	async selectVersionEnhanced(options: VersionSelectorOptions): Promise<string | null> {
		return selectVersionEnhanced(options);
	}

	async getLatestVersion(kit: KitConfig, includePrereleases = false): Promise<string | null> {
		return getLatestVersion(kit, includePrereleases);
	}

	async getDirectory(defaultDir = "."): Promise<string> {
		return getDirectory(defaultDir);
	}

	async confirm(message: string): Promise<boolean> {
		return confirmAction(message);
	}

	intro(message: string): void {
		intro(message);
	}

	outro(message: string): void {
		outro(message);
	}

	note(message: string, title?: string): void {
		note(message, title);
	}

	async promptPackageInstallations(): Promise<{
		installOpenCode: boolean;
		installGemini: boolean;
	}> {
		log.step("Optional Package Installations");

		const [openCodeInstalled, geminiInstalled] = await Promise.all([
			isOpenCodeInstalled(),
			isGeminiInstalled(),
		]);

		let installOpenCode = false;
		let installGemini = false;

		if (openCodeInstalled) {
			logger.success("OpenCode CLI is already installed");
		} else {
			const shouldInstallOpenCode = await confirm({
				message:
					"Install OpenCode CLI for enhanced code analysis? (Recommended for better code understanding and generation)",
			});

			if (isCancel(shouldInstallOpenCode)) {
				throw new Error("Package installation cancelled");
			}

			installOpenCode = shouldInstallOpenCode;
		}

		if (geminiInstalled) {
			logger.success("Google Gemini CLI is already installed");
		} else {
			const shouldInstallGemini = await confirm({
				message:
					"Install Google Gemini CLI for AI-powered assistance? (Optional additional AI capabilities)",
			});

			if (isCancel(shouldInstallGemini)) {
				throw new Error("Package installation cancelled");
			}

			installGemini = shouldInstallGemini;
		}

		return {
			installOpenCode,
			installGemini,
		};
	}

	async promptSkillsInstallation(): Promise<boolean> {
		return promptSkillsInstallation();
	}

	showPackageInstallationResults(results: {
		opencode?: { success: boolean; package: string; version?: string; error?: string };
		gemini?: { success: boolean; package: string; version?: string; error?: string };
	}): void {
		const successfulInstalls: string[] = [];
		const failedInstalls: string[] = [];

		if (results.opencode) {
			if (results.opencode.success) {
				successfulInstalls.push(
					`${results.opencode.package}${results.opencode.version ? ` v${results.opencode.version}` : ""}`,
				);
			} else {
				failedInstalls.push(
					`${results.opencode.package}: ${results.opencode.error || "Installation failed"}`,
				);
			}
		}

		if (results.gemini) {
			if (results.gemini.success) {
				successfulInstalls.push(
					`${results.gemini.package}${results.gemini.version ? ` v${results.gemini.version}` : ""}`,
				);
			} else {
				failedInstalls.push(
					`${results.gemini.package}: ${results.gemini.error || "Installation failed"}`,
				);
			}
		}

		if (successfulInstalls.length > 0) {
			logger.success(`Installed: ${successfulInstalls.join(", ")}`);
		}

		if (failedInstalls.length > 0) {
			logger.warning(`Failed to install: ${failedInstalls.join(", ")}`);
			logger.info("You can install these manually later using npm install -g <package>");
		}
	}

	async promptFreshConfirmation(targetPath: string): Promise<boolean> {
		return promptFreshConfirmation(targetPath);
	}

	async promptUpdateMode(): Promise<boolean> {
		return promptUpdateMode();
	}

	async promptLocalMigration(): Promise<"remove" | "keep" | "cancel"> {
		return promptLocalMigration();
	}

	async promptDirectorySelection(global = false): Promise<string[]> {
		return promptDirectorySelection(global);
	}
}
