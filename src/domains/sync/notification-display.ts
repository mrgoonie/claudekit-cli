/**
 * Config sync notification display
 * Uses same box pattern as versioning/checking/notification-display.ts
 */
import { stdout } from "node:process";
import pc from "picocolors";

/**
 * Helper to create notification box components
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
 * Display config update notification box
 * @param currentVersion - Current installed version
 * @param latestVersion - Latest available version
 * @param isGlobal - Whether this is a global installation
 */
export function displayConfigUpdateNotification(
	currentVersion: string,
	latestVersion: string,
	isGlobal = false,
): void {
	// Strip 'v' prefix for consistency
	const displayCurrent = currentVersion.replace(/^v/, "");
	const displayLatest = latestVersion.replace(/^v/, "");

	// Use terminal width if available, fallback to 52
	const terminalWidth = stdout.columns || 80;
	const boxWidth = Math.min(52, terminalWidth - 4);
	const { topBorder, bottomBorder, emptyLine, padLine } = createNotificationBox(pc.cyan, boxWidth);

	const headerText = pc.bold(pc.yellow("📦 Config Updates Available"));
	const headerLen = "📦 Config Updates Available".length;

	const versionText = `${pc.dim(displayCurrent)} ${pc.white("→")} ${pc.green(pc.bold(displayLatest))}`;
	const versionLen = displayCurrent.length + 3 + displayLatest.length;

	const updateCmd = isGlobal ? "ck init -g --sync" : "ck init --sync";
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
