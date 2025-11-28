import * as clack from "@clack/prompts";
import { AVAILABLE_KITS, type KitConfig, type KitType } from "../types.js";
import { logger } from "../utils/logger.js";
import { PathResolver } from "../utils/path-resolver.js";
import { intro, note, outro } from "../utils/safe-prompts.js";
import { VersionSelector, type VersionSelectorOptions } from "./version-selector.js";

export class PromptsManager {
	/**
	 * Prompt user to select a kit
	 */
	async selectKit(defaultKit?: KitType): Promise<KitType> {
		const kit = await clack.select({
			message: "Select a ClaudeKit:",
			options: Object.entries(AVAILABLE_KITS).map(([key, config]) => ({
				value: key as KitType,
				label: config.name,
				hint: config.description,
			})),
			initialValue: defaultKit,
		});

		if (clack.isCancel(kit)) {
			throw new Error("Kit selection cancelled");
		}

		return kit as KitType;
	}

	/**
	 * Prompt user to select a version (basic version for backward compatibility)
	 */
	async selectVersion(versions: string[], defaultVersion?: string): Promise<string> {
		if (versions.length === 0) {
			throw new Error("No versions available");
		}

		// If only one version or default is latest, return first version
		if (versions.length === 1 || !defaultVersion) {
			return versions[0];
		}

		const version = await clack.select({
			message: "Select a version:",
			options: versions.map((v) => ({
				value: v,
				label: v,
			})),
			initialValue: defaultVersion,
		});

		if (clack.isCancel(version)) {
			throw new Error("Version selection cancelled");
		}

		return version as string;
	}

	/**
	 * Enhanced version selection with GitHub API integration
	 */
	async selectVersionEnhanced(options: VersionSelectorOptions): Promise<string | null> {
		const selector = new VersionSelector();
		return await selector.selectVersion(options);
	}

	/**
	 * Get latest version without prompting
	 */
	async getLatestVersion(kit: KitConfig, includePrereleases = false): Promise<string | null> {
		const selector = new VersionSelector();
		return await selector.getLatestVersion(kit, includePrereleases);
	}

	/**
	 * Prompt user for target directory
	 */
	async getDirectory(defaultDir = "."): Promise<string> {
		const dir = await clack.text({
			message: "Enter target directory:",
			placeholder: `Press Enter for "${defaultDir}"`,
			// Don't use initialValue - it pre-fills and causes ".myproject" issue
			validate: () => {
				// Allow empty input - will use default
				return;
			},
		});

		if (clack.isCancel(dir)) {
			throw new Error("Directory input cancelled");
		}

		// Use default if user just pressed Enter (empty input or undefined)
		const trimmed = (dir ?? "").trim();
		return trimmed.length > 0 ? trimmed : defaultDir;
	}

	/**
	 * Confirm action
	 */
	async confirm(message: string): Promise<boolean> {
		const result = await clack.confirm({
			message,
		});

		if (clack.isCancel(result)) {
			return false;
		}

		return result;
	}

	/**
	 * Show intro message
	 */
	intro(message: string): void {
		intro(message);
	}

	/**
	 * Show outro message
	 */
	outro(message: string): void {
		outro(message);
	}

	/**
	 * Show note
	 */
	note(message: string, title?: string): void {
		note(message, title);
	}

	/**
	 * Prompt for optional package installations
	 */
	async promptPackageInstallations(): Promise<{
		installOpenCode: boolean;
		installGemini: boolean;
	}> {
		clack.log.step("Optional Package Installations");

		const installOpenCode = await clack.confirm({
			message:
				"Install OpenCode CLI for enhanced code analysis? (Recommended for better code understanding and generation)",
		});

		if (clack.isCancel(installOpenCode)) {
			throw new Error("Package installation cancelled");
		}

		const installGemini = await clack.confirm({
			message:
				"Install Google Gemini CLI for AI-powered assistance? (Optional additional AI capabilities)",
		});

		if (clack.isCancel(installGemini)) {
			throw new Error("Package installation cancelled");
		}

		return {
			installOpenCode: installOpenCode as boolean,
			installGemini: installGemini as boolean,
		};
	}

	/**
	 * Prompt for skills dependencies installation
	 */
	async promptSkillsInstallation(): Promise<boolean> {
		const installSkills = await clack.confirm({
			message:
				"Install skills dependencies (Python packages, system tools)? (Optional for advanced features)",
			initialValue: false,
		});

		if (clack.isCancel(installSkills)) {
			return false;
		}

		return installSkills as boolean;
	}

	/**
	 * Show package installation results
	 */
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

	/**
	 * Prompt user to confirm fresh installation (complete directory removal)
	 */
	async promptFreshConfirmation(targetPath: string): Promise<boolean> {
		logger.warning("⚠️  WARNING: Fresh installation will completely remove the .claude directory!");
		logger.info(`Path: ${targetPath}`);
		logger.info("All custom files, configurations, and modifications will be permanently deleted.");

		const confirmation = await clack.text({
			message: "Type 'yes' to confirm complete removal:",
			placeholder: "yes",
			validate: (value) => {
				if (value.toLowerCase() !== "yes") {
					return "You must type 'yes' to confirm";
				}
				return;
			},
		});

		if (clack.isCancel(confirmation)) {
			return false;
		}

		return confirmation.toLowerCase() === "yes";
	}

	/**
	 * Prompt user to choose between updating everything or selective update
	 */
	async promptUpdateMode(): Promise<boolean> {
		const updateEverything = await clack.confirm({
			message: "Do you want to update everything?",
		});

		if (clack.isCancel(updateEverything)) {
			throw new Error("Update cancelled");
		}

		return updateEverything as boolean;
	}

	/**
	 * Prompt user to select directories for selective update
	 *
	 * @param global - Whether to use global installation mode
	 */
	async promptDirectorySelection(global = false): Promise<string[]> {
		clack.log.step("Select directories to update");

		const prefix = PathResolver.getPathPrefix(global);
		const categories = [
			{ key: "agents", label: "Agents", pattern: prefix ? `${prefix}/agents` : "agents" },
			{ key: "commands", label: "Commands", pattern: prefix ? `${prefix}/commands` : "commands" },
			{
				key: "workflows",
				label: "Workflows",
				pattern: prefix ? `${prefix}/workflows` : "workflows",
			},
			{ key: "skills", label: "Skills", pattern: prefix ? `${prefix}/skills` : "skills" },
			{ key: "hooks", label: "Hooks", pattern: prefix ? `${prefix}/hooks` : "hooks" },
		];

		const selectedCategories: string[] = [];

		for (const category of categories) {
			const shouldInclude = await clack.confirm({
				message: `Include ${category.label}?`,
			});

			if (clack.isCancel(shouldInclude)) {
				throw new Error("Update cancelled");
			}

			if (shouldInclude) {
				selectedCategories.push(category.pattern);
			}
		}

		if (selectedCategories.length === 0) {
			throw new Error("No directories selected for update");
		}

		return selectedCategories;
	}
}
