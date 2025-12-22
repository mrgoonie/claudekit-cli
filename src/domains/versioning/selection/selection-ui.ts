/**
 * UI selection prompts for version selection
 */
import { logger } from "@/shared/logger.js";
import type { EnrichedRelease, KitConfig } from "@/types";
import * as clack from "@clack/prompts";
import pc from "picocolors";
import { type VersionChoice, VersionDisplayFormatter } from "../version-display.js";
import { isValidVersionFormat, normalizeVersionTag } from "./version-filter.js";

/**
 * Handle case when no releases are found
 */
export async function handleNoReleases(
	kit: KitConfig,
	allowManualEntry: boolean,
): Promise<string | null> {
	clack.note(
		`No releases found for ${kit.name}.\nThis could be due to:\n• No releases published yet\n• Network connectivity issues\n• Repository access permissions`,
		pc.yellow("No Releases Available"),
	);

	if (!allowManualEntry) {
		throw new Error(`No releases available for ${kit.name}`);
	}

	const tryManual = await clack.confirm({
		message: "Would you like to enter a version manually?",
	});

	if (clack.isCancel(tryManual) || !tryManual) {
		return null;
	}

	return await getManualVersion(kit);
}

/**
 * Get version through manual entry
 */
export async function getManualVersion(kit: KitConfig): Promise<string | null> {
	const version = await clack.text({
		message: `Enter version tag for ${kit.name}:`,
		placeholder: "v1.0.0",
		validate: (value) => {
			if (!value || value.trim().length === 0) {
				return "Version is required";
			}
			// Basic version format validation
			if (!isValidVersionFormat(value)) {
				return "Please enter a valid version (e.g., v1.0.0)";
			}
			return;
		},
	});

	if (clack.isCancel(version)) {
		return null;
	}

	return normalizeVersionTag(version);
}

/**
 * Create and show the version selection prompt
 */
export async function createVersionPrompt(
	kit: KitConfig,
	choices: VersionChoice[],
	_defaultIndex: number,
	allowManualEntry: boolean,
	releases: EnrichedRelease[],
	currentVersion: string | null = null,
): Promise<string | null> {
	// Build final choices with clear ordering
	const clackChoices: Array<{ value: string; label: string; hint?: string }> = [];

	// 1. Add "Latest Stable" shortcut first
	const latestStable = releases.find((r) => r.isLatestStable && !r.prerelease);
	if (latestStable) {
		clackChoices.push({
			value: latestStable.tag_name,
			label: `${pc.bold(pc.green("Latest Stable"))} (${latestStable.displayVersion})`,
			hint: "recommended",
		});
	}

	// 2. Add utility options for easy access
	if (allowManualEntry) {
		clackChoices.push({
			value: "manual-entry",
			label: pc.cyan("↳ Enter Version Manually"),
			hint: "for older versions",
		});
	}
	clackChoices.push({
		value: "cancel",
		label: pc.red("✕ Cancel"),
	});

	// 3. Add version list (excluding separator)
	const versionChoices = choices.filter(
		(choice) => choice.value !== "separator" && choice.value !== "cancel",
	);
	for (const choice of versionChoices) {
		// Mark currently installed version
		const isCurrentlyInstalled =
			currentVersion && (choice.value === currentVersion || choice.value === `v${currentVersion}`);
		const installedMarker = isCurrentlyInstalled ? pc.cyan(" (installed)") : "";
		clackChoices.push({
			value: choice.value,
			label: `${choice.label}${installedMarker}`,
			hint: choice.hint,
		});
	}

	// Build prompt message with current version info if available
	const currentVersionHint = currentVersion ? pc.dim(` (current: ${currentVersion})`) : "";
	const selected = await clack.select({
		message: `Select version for ${pc.bold(kit.name)}${currentVersionHint}:`,
		options: clackChoices,
		initialValue: latestStable?.tag_name, // Default to Latest Stable
	});

	if (clack.isCancel(selected)) {
		return null;
	}

	// Handle manual entry
	if (selected === "manual-entry") {
		return await getManualVersion(kit);
	}

	// Handle cancel
	if (selected === "cancel") {
		return null;
	}

	// Validate selected version
	if (!VersionDisplayFormatter.isValidVersionChoice(selected as string)) {
		throw new Error(`Invalid version selection: ${selected}`);
	}

	// Show confirmation
	const selectedChoice = choices.find((c) => c.value === selected);
	if (selectedChoice && !selectedChoice.isLatest) {
		clack.note(
			VersionDisplayFormatter.formatSuccess(selected as string, kit.name),
			"Version Selected",
		);
	}

	return selected as string;
}

/**
 * Handle errors during version selection
 */
export async function handleSelectionError(
	error: any,
	kit: KitConfig,
	allowManualEntry: boolean,
	retryCallback: () => Promise<string | null>,
): Promise<string | null> {
	// Log the detailed error
	logger.error(`Version selection error: ${error.message}`);

	// Handle different error types
	if (error.message.includes("401") || error.message.includes("403")) {
		// Authentication errors
		clack.note(
			VersionDisplayFormatter.formatError(
				"Authentication failed",
				"Please check your GitHub token with: ck auth",
			),
			pc.red("Authentication Error"),
		);
	} else if (error.message.includes("404")) {
		// Repository not found or no access
		clack.note(
			VersionDisplayFormatter.formatError(
				"Repository access denied",
				"Make sure you have access to the repository",
			),
			pc.red("Access Error"),
		);
	} else if (error.message.includes("rate limit") || error.message.includes("403")) {
		// Rate limiting
		clack.note(
			VersionDisplayFormatter.formatError(
				"GitHub API rate limit exceeded",
				"Please wait a moment and try again",
			),
			pc.yellow("Rate Limited"),
		);
	} else if (error.message.includes("network") || error.message.includes("ENOTFOUND")) {
		// Network errors
		clack.note(
			VersionDisplayFormatter.formatError(
				"Network connection failed",
				"Please check your internet connection",
			),
			pc.yellow("Network Error"),
		);
	} else {
		// Generic errors
		clack.note(
			VersionDisplayFormatter.formatError(
				error.message || "Unknown error occurred",
				"Please try again or contact support",
			),
			pc.red("Error"),
		);
	}

	// Offer retry option
	if (allowManualEntry) {
		const retry = await clack.confirm({
			message: "Would you like to try entering a version manually?",
		});

		if (clack.isCancel(retry) || !retry) {
			return null;
		}

		return await getManualVersion(kit);
	}

	const retry = await clack.confirm({
		message: "Would you like to retry?",
	});

	if (clack.isCancel(retry) || !retry) {
		return null;
	}

	// Retry the selection
	return retryCallback();
}

/**
 * Get the default index for selection
 */
export function getDefaultIndex(choices: VersionChoice[], defaultValue?: string): number {
	// If default value provided, find it
	if (defaultValue) {
		const index = choices.findIndex((c) => c.value === defaultValue);
		if (index >= 0) {
			return index;
		}
	}

	// Otherwise, get the recommended default
	return VersionDisplayFormatter.getDefaultChoiceIndex(choices);
}
