/**
 * Interactive merge UI for hunk-by-hunk file synchronization
 */
import * as p from "@clack/prompts";
import pc from "picocolors";
import { SyncEngine } from "./sync-engine.js";
import type { FileHunk, MergeResult } from "./types.js";

/** Width of hunk separator line */
const HUNK_SEPARATOR_WIDTH = 50;
/** Default extended context lines */
const EXTENDED_CONTEXT_LINES = 10;

/**
 * MergeUI handles interactive hunk display and user decisions
 */
export class MergeUI {
	/**
	 * Display a hunk with colored diff and prompt for action
	 *
	 * @param hunk - The hunk to display
	 * @param hunkIndex - Index of this hunk (0-based)
	 * @param totalHunks - Total number of hunks
	 * @param filename - File being merged
	 * @returns User's chosen action
	 */
	static async promptHunk(
		hunk: FileHunk,
		hunkIndex: number,
		totalHunks: number,
		_filename: string,
	): Promise<"accept" | "reject" | "view" | "skip"> {
		// Display hunk header
		const lineRange = `${hunk.oldStart}-${hunk.oldStart + hunk.oldLines - 1}`;
		console.log(pc.cyan(`\nHunk ${hunkIndex + 1}/${totalHunks}: Lines ${lineRange}`));
		console.log(pc.dim("─".repeat(HUNK_SEPARATOR_WIDTH)));

		// Display diff lines with colors
		for (const line of hunk.lines) {
			const prefix = line[0];
			if (prefix === "+") {
				console.log(pc.green(line));
			} else if (prefix === "-") {
				console.log(pc.red(line));
			} else {
				console.log(pc.dim(line));
			}
		}

		console.log(pc.dim("─".repeat(HUNK_SEPARATOR_WIDTH)));

		// Prompt user for action
		const action = await p.select({
			message: "Action?",
			options: [
				{ value: "accept", label: "[a]ccept - Apply this change" },
				{ value: "reject", label: "[r]eject - Keep current" },
				{ value: "view", label: "[v]iew - More context" },
				{ value: "skip", label: "[s]kip - Skip entire file" },
			],
		});

		if (p.isCancel(action)) {
			return "skip";
		}

		return action as "accept" | "reject" | "view" | "skip";
	}

	/**
	 * Show extended context around a hunk
	 *
	 * @param currentContent - Current file content
	 * @param hunk - The hunk to show context for
	 * @param contextLines - Number of extra context lines to show
	 */
	static showExtendedContext(
		currentContent: string,
		hunk: FileHunk,
		contextLines = EXTENDED_CONTEXT_LINES,
	): void {
		const lines = currentContent.split("\n");

		const startLine = Math.max(0, hunk.oldStart - 1 - contextLines);
		const endLine = Math.min(lines.length, hunk.oldStart + hunk.oldLines - 1 + contextLines);

		console.log(pc.cyan(`\nExtended context (lines ${startLine + 1}-${endLine}):`));
		console.log(pc.dim("─".repeat(HUNK_SEPARATOR_WIDTH)));

		for (let i = startLine; i < endLine; i++) {
			const lineNum = String(i + 1).padStart(4, " ");
			const isInHunk = i >= hunk.oldStart - 1 && i < hunk.oldStart - 1 + hunk.oldLines;
			const prefix = isInHunk ? pc.yellow("*") : " ";
			console.log(`${pc.dim(lineNum)} ${prefix} ${lines[i]}`);
		}

		console.log(pc.dim("─".repeat(HUNK_SEPARATOR_WIDTH)));
	}

	/**
	 * Run interactive merge flow for a single file
	 *
	 * @param filename - File being merged
	 * @param currentContent - Current file content
	 * @param newContent - New upstream content
	 * @param hunks - Hunks to review
	 * @returns Merge result or 'skipped'
	 */
	static async mergeFile(
		filename: string,
		currentContent: string,
		_newContent: string,
		hunks: FileHunk[],
	): Promise<MergeResult | "skipped"> {
		console.log(pc.bold(`\n━━━ ${filename} ━━━`));
		console.log(pc.dim(`${hunks.length} change${hunks.length === 1 ? "" : "s"} to review\n`));

		const decisions: boolean[] = [];

		for (let i = 0; i < hunks.length; i++) {
			let action: "accept" | "reject" | "view" | "skip";

			do {
				action = await MergeUI.promptHunk(hunks[i], i, hunks.length, filename);

				if (action === "view") {
					MergeUI.showExtendedContext(currentContent, hunks[i]);
				}
			} while (action === "view");

			if (action === "skip") {
				return "skipped";
			}

			decisions.push(action === "accept");
		}

		const result = SyncEngine.applyHunks(currentContent, hunks, decisions);
		const applied = decisions.filter(Boolean).length;
		const rejected = decisions.length - applied;

		return { result, applied, rejected };
	}

	/**
	 * Display merge summary for a file
	 */
	static displayMergeSummary(filename: string, applied: number, rejected: number): void {
		if (applied > 0 && rejected > 0) {
			console.log(
				pc.dim(`  ${filename}: `) +
					pc.green(`${applied} applied`) +
					pc.dim(", ") +
					pc.yellow(`${rejected} rejected`),
			);
		} else if (applied > 0) {
			console.log(pc.dim(`  ${filename}: `) + pc.green(`${applied} applied`));
		} else {
			console.log(pc.dim(`  ${filename}: `) + pc.yellow(`${rejected} rejected`));
		}
	}

	/**
	 * Display skip notification
	 */
	static displaySkipped(filename: string): void {
		console.log(pc.dim(`  ${filename}: `) + pc.yellow("skipped"));
	}
}
