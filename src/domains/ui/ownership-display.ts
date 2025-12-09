import * as clack from "@clack/prompts";
import pc from "picocolors";
import type { FileOwnership } from "../../types/index.js";

/**
 * Result of an ownership check for a file
 */
export interface OwnershipCheckResult {
	path: string;
	ownership: FileOwnership;
	action: "delete" | "preserve" | "skip";
	reason?: string;
}

/**
 * Summary of ownership-aware operation results
 */
export interface OwnershipSummary {
	totalFiles: number;
	ckOwned: number;
	userCreated: number;
	ckModified: number;
	toDelete: number;
	toPreserve: number;
}

/**
 * Ownership Display - UI utilities for ownership-aware operations
 *
 * Provides consistent formatting and display for:
 * - File ownership status
 * - Operation previews (dry-run mode)
 * - Summary reports
 */
export class OwnershipDisplay {
	/**
	 * Format ownership type with appropriate color
	 * @param ownership - File ownership type
	 * @returns Colored string representation
	 */
	static formatOwnership(ownership: FileOwnership): string {
		switch (ownership) {
			case "ck":
				return pc.blue("CK-owned");
			case "user":
				return pc.green("User-created");
			case "ck-modified":
				return pc.yellow("CK-modified");
			default:
				return pc.gray("Unknown");
		}
	}

	/**
	 * Format action with appropriate color and symbol
	 * @param action - The action to be taken
	 * @returns Colored string with symbol
	 */
	static formatAction(action: "delete" | "preserve" | "skip"): string {
		switch (action) {
			case "delete":
				return pc.red("✖ DELETE");
			case "preserve":
				return pc.green("✓ PRESERVE");
			case "skip":
				return pc.gray("○ SKIP");
			default:
				return pc.gray("? UNKNOWN");
		}
	}

	/**
	 * Calculate summary from ownership check results
	 * @param results - Array of ownership check results
	 * @returns Summary statistics
	 */
	static calculateSummary(results: OwnershipCheckResult[]): OwnershipSummary {
		const summary: OwnershipSummary = {
			totalFiles: results.length,
			ckOwned: 0,
			userCreated: 0,
			ckModified: 0,
			toDelete: 0,
			toPreserve: 0,
		};

		for (const result of results) {
			// Count by ownership
			switch (result.ownership) {
				case "ck":
					summary.ckOwned++;
					break;
				case "user":
					summary.userCreated++;
					break;
				case "ck-modified":
					summary.ckModified++;
					break;
			}

			// Count by action
			if (result.action === "delete") {
				summary.toDelete++;
			} else if (result.action === "preserve") {
				summary.toPreserve++;
			}
		}

		return summary;
	}

	/**
	 * Display ownership summary using clack
	 * @param summary - Summary to display
	 * @param title - Optional title for the summary
	 */
	static displaySummary(summary: OwnershipSummary, title = "Ownership Summary"): void {
		const lines = [
			`Total files: ${pc.bold(String(summary.totalFiles))}`,
			"",
			"By ownership:",
			`  ${pc.blue("●")} CK-owned:     ${summary.ckOwned}`,
			`  ${pc.green("●")} User-created: ${summary.userCreated}`,
			`  ${pc.yellow("●")} CK-modified:  ${summary.ckModified}`,
			"",
			"Actions:",
			`  ${pc.red("✖")} To delete:   ${summary.toDelete}`,
			`  ${pc.green("✓")} To preserve: ${summary.toPreserve}`,
		];

		clack.note(lines.join("\n"), title);
	}

	/**
	 * Display operation preview (dry-run mode)
	 * Shows what would happen without actually doing it
	 * @param results - Array of ownership check results
	 * @param maxItems - Maximum items to show (default 10)
	 */
	static displayOperationPreview(results: OwnershipCheckResult[], maxItems = 10): void {
		const summary = OwnershipDisplay.calculateSummary(results);

		// Header
		clack.log.info(pc.bold("DRY RUN - Preview of changes:"));
		console.log("");

		// Show files by action
		const toDelete = results.filter((r) => r.action === "delete");
		const toPreserve = results.filter((r) => r.action === "preserve");

		// Files to delete
		if (toDelete.length > 0) {
			console.log(pc.red(pc.bold(`Files to DELETE (${toDelete.length}):`)));
			const showDelete = toDelete.slice(0, maxItems);
			for (const result of showDelete) {
				console.log(`  ${pc.red("✖")} ${result.path}`);
			}
			if (toDelete.length > maxItems) {
				console.log(pc.gray(`  ... and ${toDelete.length - maxItems} more`));
			}
			console.log("");
		}

		// Files to preserve
		if (toPreserve.length > 0) {
			console.log(pc.green(pc.bold(`Files to PRESERVE (${toPreserve.length}):`)));
			const showPreserve = toPreserve.slice(0, maxItems);
			for (const result of showPreserve) {
				const reason = result.reason ? pc.gray(` (${result.reason})`) : "";
				console.log(`  ${pc.green("✓")} ${result.path}${reason}`);
			}
			if (toPreserve.length > maxItems) {
				console.log(pc.gray(`  ... and ${toPreserve.length - maxItems} more`));
			}
			console.log("");
		}

		// Summary
		OwnershipDisplay.displaySummary(summary, "Preview Summary");

		// Dry-run notice
		clack.log.warn(pc.yellow("No changes were made. Run without --dry-run to apply changes."));
	}

	/**
	 * Display a single file's ownership status
	 * @param path - File path
	 * @param ownership - File ownership
	 * @param action - Action to take
	 * @param reason - Optional reason for the action
	 */
	static displayFile(
		path: string,
		ownership: FileOwnership,
		action: "delete" | "preserve" | "skip",
		reason?: string,
	): void {
		const ownershipStr = OwnershipDisplay.formatOwnership(ownership);
		const actionStr = OwnershipDisplay.formatAction(action);
		const reasonStr = reason ? pc.gray(` - ${reason}`) : "";

		console.log(`  ${actionStr} ${path} [${ownershipStr}]${reasonStr}`);
	}

	/**
	 * Display warning for force-overwrite mode
	 */
	static displayForceWarning(): void {
		clack.log.warn(
			`${pc.yellow(pc.bold("FORCE MODE ENABLED"))}\n${pc.yellow("User modifications will be overwritten!")}\n${pc.gray("Use --dry-run first to preview changes.")}`,
		);
	}

	/**
	 * Display legacy installation warning
	 */
	static displayLegacyWarning(): void {
		clack.log.warn(
			`${pc.yellow(pc.bold("Legacy Installation Detected"))}\n${pc.yellow("No ownership metadata found.")}\n${pc.gray("Running migration to enable ownership tracking...")}`,
		);
	}

	/**
	 * Display success message with counts
	 * @param deleted - Number of files deleted
	 * @param preserved - Number of files preserved
	 */
	static displayCompletionSummary(deleted: number, preserved: number): void {
		const message = `${pc.green(`✓ Deleted ${deleted} CK-owned file(s)`)}\n${pc.blue(`✓ Preserved ${preserved} user/modified file(s)`)}`;

		clack.log.success(message);
	}
}
