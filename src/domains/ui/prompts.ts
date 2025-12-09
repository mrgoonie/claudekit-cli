import {
	isGeminiInstalled,
	isOpenCodeInstalled,
} from "../../services/package-installer/package-installer.js";
import { logger } from "../../shared/logger.js";
import { PathResolver } from "../../shared/path-resolver.js";
import {
	confirm,
	intro,
	isCancel,
	log,
	note,
	outro,
	select,
	text,
} from "../../shared/safe-prompts.js";
import { AVAILABLE_KITS, type KitConfig, type KitType } from "../../types/index.js";
import { VersionSelector, type VersionSelectorOptions } from "../versioning/version-selector.js";

export class PromptsManager {
	/**
	 * Prompt user to select a kit
	 */
	async selectKit(defaultKit?: KitType): Promise<KitType> {
		const kit = await select({
			message: "Select a ClaudeKit:",
			options: Object.entries(AVAILABLE_KITS).map(([key, config]) => ({
				value: key as KitType,
				label: config.name,
				hint: config.description,
			})),
			initialValue: defaultKit,
		});

		if (isCancel(kit)) {
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

		const version = await select({
			message: "Select a version:",
			options: versions.map((v) => ({
				value: v,
				label: v,
			})),
			initialValue: defaultVersion,
		});

		if (isCancel(version)) {
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
	 * @returns Directory path (defaults to defaultDir if empty input)
	 */
	async getDirectory(defaultDir = "."): Promise<string> {
		// text returns string | symbol (cancel) | undefined (empty input)
		const dir = await text({
			message: "Enter target directory:",
			placeholder: `Press Enter for "${defaultDir}"`,
			// Don't use initialValue - it pre-fills and causes ".myproject" issue
			validate: () => {
				// Allow empty input - will use default
				return;
			},
		});

		if (isCancel(dir)) {
			throw new Error("Directory input cancelled");
		}

		// Handle undefined (empty input) and empty string cases
		const trimmed = (dir ?? "").trim();
		return trimmed.length > 0 ? trimmed : defaultDir;
	}

	/**
	 * Confirm action
	 */
	async confirm(message: string): Promise<boolean> {
		const result = await confirm({
			message,
		});

		if (isCancel(result)) {
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
	 * Auto-detects if packages are already installed and skips prompts accordingly
	 */
	async promptPackageInstallations(): Promise<{
		installOpenCode: boolean;
		installGemini: boolean;
	}> {
		log.step("Optional Package Installations");

		// Check if packages are already installed (uses shared utils)
		const [openCodeInstalled, geminiInstalled] = await Promise.all([
			isOpenCodeInstalled(),
			isGeminiInstalled(),
		]);

		let installOpenCode = false;
		let installGemini = false;

		// Only prompt for OpenCode if not installed
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

		// Only prompt for Gemini if not installed
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

	/**
	 * Prompt for skills dependencies installation
	 */
	async promptSkillsInstallation(): Promise<boolean> {
		const installSkills = await confirm({
			message:
				"Install skills dependencies (Python packages, system tools)? (Optional for advanced features)",
			initialValue: false,
		});

		if (isCancel(installSkills)) {
			return false;
		}

		return installSkills;
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
		logger.warning("[!] WARNING: Fresh installation will completely remove the .claude directory!");
		logger.info(`Path: ${targetPath}`);
		logger.info("All custom files, configurations, and modifications will be permanently deleted.");

		const confirmation = await text({
			message: "Type 'yes' to confirm complete removal:",
			placeholder: "yes",
			validate: (value) => {
				if (value.toLowerCase() !== "yes") {
					return "You must type 'yes' to confirm";
				}
				return;
			},
		});

		if (isCancel(confirmation)) {
			return false;
		}

		return confirmation.toLowerCase() === "yes";
	}

	/**
	 * Prompt user to choose between updating everything or selective update
	 */
	async promptUpdateMode(): Promise<boolean> {
		const updateEverything = await confirm({
			message: "Do you want to update everything?",
		});

		if (isCancel(updateEverything)) {
			throw new Error("Update cancelled");
		}

		return updateEverything as boolean;
	}

	/**
	 * Prompt user to handle local installation when switching to global mode
	 * Returns: "remove" to delete local .claude/, "keep" to proceed with warning, "cancel" to abort
	 */
	async promptLocalMigration(): Promise<"remove" | "keep" | "cancel"> {
		const result = await select({
			message: "Local ClaudeKit installation detected. Local settings take precedence over global.",
			options: [
				{
					value: "remove",
					label: "Remove local installation",
					hint: "Delete .claude/ and use global only",
				},
				{
					value: "keep",
					label: "Keep both installations",
					hint: "Local will take precedence",
				},
				{ value: "cancel", label: "Cancel", hint: "Abort global installation" },
			],
		});

		if (isCancel(result)) {
			return "cancel";
		}

		return result as "remove" | "keep" | "cancel";
	}

	/**
	 * Prompt user to select directories for selective update
	 *
	 * @param global - Whether to use global installation mode
	 */
	async promptDirectorySelection(global = false): Promise<string[]> {
		log.step("Select directories to update");

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
			const shouldInclude = await confirm({
				message: `Include ${category.label}?`,
			});

			if (isCancel(shouldInclude)) {
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
