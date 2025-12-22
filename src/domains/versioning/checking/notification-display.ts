/**
 * Update notification display utilities
 */
import pc from "picocolors";
import { type VersionCheckResult, normalizeVersion } from "./version-utils.js";

/**
 * Options for displaying update notifications
 */
export interface DisplayNotificationOptions {
	/** Whether this is a global kit installation (affects command shown) */
	isGlobal?: boolean;
}

/**
 * Helper function to create notification box content
 */
function createNotificationBox(
	borderColor: (text: string) => string,
	boxWidth: number,
): {
	topBorder: string;
	bottomBorder: string;
	emptyLine: string;
	padLine: (text: string, visibleLen?: number) => string;
} {
	const contentWidth = boxWidth - 2;

	const topBorder = borderColor(`╭${"─".repeat(contentWidth)}╮`);
	const bottomBorder = borderColor(`╰${"─".repeat(contentWidth)}╯`);
	const emptyLine = borderColor("│") + " ".repeat(contentWidth) + borderColor("│");

	const padLine = (text: string, visibleLen?: number): string => {
		const len = visibleLen ?? text.length;
		const displayText = len > contentWidth ? `${text.slice(0, contentWidth - 3)}...` : text;
		const actualLen = visibleLen ?? displayText.length;
		const totalPadding = contentWidth - actualLen;
		const leftPadding = Math.max(0, Math.floor(totalPadding / 2));
		const rightPadding = Math.max(0, totalPadding - leftPadding);
		return (
			borderColor("│") +
			" ".repeat(leftPadding) +
			displayText +
			" ".repeat(rightPadding) +
			borderColor("│")
		);
	};

	return { topBorder, bottomBorder, emptyLine, padLine };
}

/**
 * Display Kit update notification (styled box with colors)
 * @param result - Version check result
 * @param options - Display options (isGlobal affects command shown)
 */
export function displayKitNotification(
	result: VersionCheckResult,
	options: DisplayNotificationOptions = {},
): void {
	if (!result.updateAvailable) return;

	const { currentVersion, latestVersion } = result;
	const { isGlobal = false } = options;

	// Normalize versions for display (strip 'v' prefix for consistency)
	const displayCurrent = normalizeVersion(currentVersion);
	const displayLatest = normalizeVersion(latestVersion);

	// Box width based on content
	const boxWidth = 52;
	const { topBorder, bottomBorder, emptyLine, padLine } = createNotificationBox(pc.cyan, boxWidth);

	// Build content with visual hierarchy
	const headerText = pc.bold(pc.yellow("⬆ Kit Update Available"));
	const headerLen = "⬆ Kit Update Available".length;

	const versionText = `${pc.dim(displayCurrent)} ${pc.white("→")} ${pc.green(pc.bold(displayLatest))}`;
	const versionLen = displayCurrent.length + 3 + displayLatest.length;

	// Command depends on installation type
	const updateCmd = isGlobal ? "ck init -g" : "ck init";
	const commandText = `Run: ${pc.cyan(pc.bold(updateCmd))}`;
	const commandLen = `Run: ${updateCmd}`.length;

	console.log("");
	console.log(topBorder);
	console.log(emptyLine);
	console.log(padLine(headerText, headerLen));
	console.log(padLine(versionText, versionLen));
	console.log(emptyLine);
	console.log(padLine(commandText, commandLen));
	console.log(emptyLine);
	console.log(bottomBorder);
	console.log("");
}

/**
 * Display CLI update notification (styled box with colors)
 */
export function displayCliNotification(result: VersionCheckResult): void {
	if (!result.updateAvailable) return;

	const { currentVersion, latestVersion } = result;

	// Box width based on content
	const boxWidth = 52;
	const { topBorder, bottomBorder, emptyLine, padLine } = createNotificationBox(
		pc.magenta,
		boxWidth,
	);

	// Build content with visual hierarchy
	const headerText = pc.bold(pc.yellow("⬆ CLI Update Available"));
	const headerLen = "⬆ CLI Update Available".length;

	const versionText = `${pc.dim(currentVersion)} ${pc.white("→")} ${pc.green(pc.bold(latestVersion))}`;
	const versionLen = currentVersion.length + 3 + latestVersion.length;

	const commandText = `Run: ${pc.magenta(pc.bold("ck update"))}`;
	const commandLen = "Run: ck update".length;

	console.log("");
	console.log(topBorder);
	console.log(emptyLine);
	console.log(padLine(headerText, headerLen));
	console.log(padLine(versionText, versionLen));
	console.log(emptyLine);
	console.log(padLine(commandText, commandLen));
	console.log(emptyLine);
	console.log(bottomBorder);
	console.log("");
}
