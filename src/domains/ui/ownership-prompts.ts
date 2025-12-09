import * as clack from "@clack/prompts";
import pc from "picocolors";
import type { OwnershipCheckResult, OwnershipSummary } from "./ownership-display.js";
import { OwnershipDisplay } from "./ownership-display.js";

/**
 * User decision for handling modified files
 */
export type ModifiedFileDecision = "keep" | "overwrite" | "backup" | "cancel";

/**
 * Ownership Prompts - Interactive prompts for ownership-aware operations
 *
 * Provides user interaction for:
 * - Confirming destructive operations
 * - Handling modified files
 * - Selecting files to preserve/delete
 */
export class OwnershipPrompts {
	/**
	 * Prompt user to confirm destructive operation
	 * @param summary - Summary of what will happen
	 * @param operationName - Name of the operation (e.g., "cleanup", "uninstall")
	 * @returns true if user confirms, false otherwise
	 */
	static async confirmDestructiveOperation(
		summary: OwnershipSummary,
		operationName = "operation",
	): Promise<boolean> {
		// Display summary first
		OwnershipDisplay.displaySummary(summary, `${operationName} Preview`);

		// Confirm with user
		const confirmed = await clack.confirm({
			message: `Proceed with ${operationName}? (${summary.toDelete} files will be deleted, ${summary.toPreserve} preserved)`,
			initialValue: false,
		});

		if (clack.isCancel(confirmed)) {
			return false;
		}

		return confirmed === true;
	}

	/**
	 * Prompt user for what to do with modified files
	 * @param modifiedFiles - List of modified file paths
	 * @returns User's decision
	 */
	static async promptModifiedFileDecision(modifiedFiles: string[]): Promise<ModifiedFileDecision> {
		if (modifiedFiles.length === 0) {
			return "keep";
		}

		// Show modified files
		clack.log.warn(pc.yellow(`Found ${modifiedFiles.length} modified file(s):`));
		const showFiles = modifiedFiles.slice(0, 5);
		for (const file of showFiles) {
			console.log(`  ${pc.yellow("●")} ${file}`);
		}
		if (modifiedFiles.length > 5) {
			console.log(pc.gray(`  ... and ${modifiedFiles.length - 5} more`));
		}
		console.log("");

		const decision = await clack.select<
			{ value: ModifiedFileDecision; label: string; hint: string }[],
			ModifiedFileDecision
		>({
			message: "How would you like to handle modified files?",
			options: [
				{
					value: "keep",
					label: "Keep modifications",
					hint: "Preserve your changes (recommended)",
				},
				{
					value: "backup",
					label: "Backup and overwrite",
					hint: "Save backups then update with new versions",
				},
				{
					value: "overwrite",
					label: "Overwrite",
					hint: "Replace with new versions (lose changes)",
				},
				{
					value: "cancel",
					label: "Cancel",
					hint: "Abort the operation",
				},
			],
		});

		if (clack.isCancel(decision)) {
			return "cancel";
		}

		return decision;
	}

	/**
	 * Prompt user to select which files to preserve (for advanced users)
	 * @param results - Array of ownership check results
	 * @returns Array of paths to preserve
	 */
	static async promptFileSelection(results: OwnershipCheckResult[]): Promise<string[]> {
		const preserveResults = results.filter((r) => r.action === "preserve");

		if (preserveResults.length === 0) {
			return [];
		}

		// Build options for multi-select
		const options = preserveResults.map((result) => ({
			value: result.path,
			label: result.path,
			hint: `${OwnershipDisplay.formatOwnership(result.ownership)}${result.reason ? ` - ${result.reason}` : ""}`,
		}));

		const selected = await clack.multiselect({
			message: "Select files to preserve (space to toggle, enter to confirm):",
			options,
			initialValues: preserveResults.map((r) => r.path), // All selected by default
			required: false,
		});

		if (clack.isCancel(selected)) {
			return preserveResults.map((r) => r.path); // Return all on cancel
		}

		return selected;
	}

	/**
	 * Prompt for force-overwrite confirmation
	 * @param fileCount - Number of files that will be affected
	 * @returns true if user confirms
	 */
	static async confirmForceOverwrite(fileCount: number): Promise<boolean> {
		OwnershipDisplay.displayForceWarning();

		const confirmed = await clack.confirm({
			message: `Are you sure you want to overwrite ${fileCount} user-modified file(s)?`,
			initialValue: false,
		});

		if (clack.isCancel(confirmed)) {
			return false;
		}

		return confirmed === true;
	}

	/**
	 * Prompt for legacy migration consent
	 * @returns true if user agrees to migration
	 */
	static async promptLegacyMigration(): Promise<boolean> {
		OwnershipDisplay.displayLegacyWarning();

		const proceed = await clack.confirm({
			message: "Would you like to migrate to the new ownership tracking system?",
			initialValue: true,
		});

		if (clack.isCancel(proceed)) {
			return false;
		}

		return proceed === true;
	}

	/**
	 * Display operation cancelled message
	 */
	static displayCancelled(): void {
		clack.log.info(pc.gray("Operation cancelled."));
	}

	/**
	 * Display operation complete message
	 * @param deleted - Number of files deleted
	 * @param preserved - Number of files preserved
	 */
	static displayComplete(deleted: number, preserved: number): void {
		OwnershipDisplay.displayCompletionSummary(deleted, preserved);
	}
}
