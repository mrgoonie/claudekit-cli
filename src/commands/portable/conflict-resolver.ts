/**
 * Conflict resolution prompts for interactive migration
 * Uses @clack/prompts (matches codebase pattern, not inquirer)
 */
import * as p from "@clack/prompts";
import { displayDiff } from "./diff-display.js";
import { sanitizeSingleLineTerminalText } from "./output-sanitizer.js";
import type { ConflictResolution, ReconcileAction } from "./reconcile-types.js";

const MAX_SHOW_DIFF_ATTEMPTS = 5;
export type NonInteractiveConflictPolicy = "keep" | "overwrite" | "skip";

function resolveNonInteractiveConflict(
	policy: NonInteractiveConflictPolicy | string | undefined,
): ConflictResolution {
	if (policy === "overwrite") {
		return { type: "overwrite" };
	}
	// "keep" (default) and "skip" both preserve user content safely.
	return { type: "keep" };
}

/**
 * Resolve a conflict interactively or non-interactively
 * Non-interactive: safe default = keep user version
 * Interactive: prompt user with options (overwrite/keep/smart-merge/show-diff)
 */
export async function resolveConflict(
	action: ReconcileAction,
	options: {
		interactive: boolean;
		color: boolean;
		nonInteractivePolicy?: NonInteractiveConflictPolicy | string;
	},
): Promise<ConflictResolution> {
	if (!options.interactive) {
		return resolveNonInteractiveConflict(options.nonInteractivePolicy);
	}

	// Display conflict header once
	const conflictKey = sanitizeSingleLineTerminalText(
		`${action.provider}/${action.type}/${action.item}`,
	);
	console.log("\n+---------------------------------------------+");
	console.log(`| [!] Conflict: ${conflictKey}`);
	console.log("+---------------------------------------------+");
	console.log("  CK updated source since last install");
	console.log("  Target file was also modified (user edits detected)");
	console.log();

	// Build choices — smart merge only available for merge targets with ownedSections
	const choices: Array<{ value: string; label: string }> = [
		{ value: "overwrite", label: "Overwrite with CK version (lose your edits)" },
		{ value: "keep", label: "Keep your version (skip CK update)" },
	];

	if (action.ownedSections && action.ownedSections.length > 0) {
		choices.push({
			value: "smart-merge",
			label: "Smart merge (update CK sections, preserve your additions)",
		});
	}

	choices.push({ value: "show-diff", label: "Show diff" });

	// Loop until user makes a resolution choice (prevents unbounded recursion)
	let showDiffAttempts = 0;
	while (true) {
		const choice = await p.select({
			message: "How to resolve?",
			options: choices,
		});

		if (p.isCancel(choice)) {
			return { type: "keep" }; // Cancel = safe default
		}

		if (choice === "show-diff") {
			showDiffAttempts += 1;
			if (action.diff) {
				displayDiff(action.diff, options);
			} else {
				console.log("  [i] Diff not available (target content not loaded)");
			}

			if (showDiffAttempts >= MAX_SHOW_DIFF_ATTEMPTS) {
				console.log("  [!] Diff view limit reached, keeping your version for safety.");
				return { type: "keep" };
			}

			console.log(); // Add spacing before re-prompt
			continue; // Loop back to prompt
		}

		// Type-safe resolution return based on choice
		if (choice === "overwrite") {
			return { type: "overwrite" };
		}
		if (choice === "keep") {
			return { type: "keep" };
		}
		if (choice === "smart-merge") {
			return { type: "smart-merge" };
		}

		// Unknown prompt output: safe default.
		return { type: "keep" };
	}
}
