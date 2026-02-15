/**
 * Plan display module — format reconciliation plans for terminal output
 * ASCII-only indicators, TTY-aware colors
 */
import pc from "picocolors";
import { sanitizeSingleLineTerminalText } from "./output-sanitizer.js";
import type { ReconcileAction, ReconcilePlan } from "./reconcile-types.js";
import type { PortableInstallResult } from "./types.js";

const DEFAULT_MAX_PLAN_GROUP_ITEMS = 20;

interface DisplayOptions {
	color: boolean;
	maxItemsPerGroup?: number;
}

function resolveMaxItemsPerGroup(options: DisplayOptions): number {
	const { maxItemsPerGroup } = options;
	if (
		typeof maxItemsPerGroup === "number" &&
		Number.isInteger(maxItemsPerGroup) &&
		maxItemsPerGroup > 0
	) {
		return maxItemsPerGroup;
	}
	return DEFAULT_MAX_PLAN_GROUP_ITEMS;
}

/**
 * Display reconciliation plan before execution
 * Groups by action type with color-coded indicators
 */
export function displayReconcilePlan(plan: ReconcilePlan, options: DisplayOptions): void {
	const { actions, summary } = plan;

	console.log();
	console.log("  Migration Plan");
	console.log();

	// Group actions by type for readability
	const groups: Record<string, ReconcileAction[]> = {};
	for (const action of actions) {
		if (!groups[action.action]) {
			groups[action.action] = [];
		}
		groups[action.action].push(action);
	}

	printActionGroup("[+] Install", groups.install, "+", "green", options);
	printActionGroup("[~] Update", groups.update, "~", "yellow", options);
	printActionGroup("[!] Conflict", groups.conflict, "!", "red", options);
	printActionGroup("[-] Delete", groups.delete, "-", "magenta", options);
	printActionGroup("[i] Skip", groups.skip, " ", "dim", options);

	// Summary line
	console.log();
	console.log(
		`  Summary: ${summary.install} install, ${summary.update} update, ${summary.skip} skip, ${summary.conflict} conflict, ${summary.delete} delete`,
	);
	console.log();
}

/**
 * Print section header with count
 */
function printHeader(
	label: string,
	count: number,
	colorName: string,
	options: DisplayOptions,
): void {
	const text = `  ${label} (${count})`;
	if (options.color) {
		console.log(applyColor(text, colorName));
	} else {
		console.log(text);
	}
}

/**
 * Print a bounded action group with truncation notice.
 */
function printActionGroup(
	label: string,
	actions: ReconcileAction[] | undefined,
	prefix: string,
	colorName: string,
	options: DisplayOptions,
): void {
	if (!actions || actions.length === 0) return;

	printHeader(label, actions.length, colorName, options);

	const maxItems = resolveMaxItemsPerGroup(options);
	const shown = actions.slice(0, maxItems);
	for (const action of shown) {
		printAction(action, prefix, options);
	}

	const hiddenCount = actions.length - shown.length;
	if (hiddenCount > 0) {
		const notice = `      ... and ${hiddenCount} more item(s) not shown`;
		console.log(options.color ? pc.dim(notice) : notice);
	}
}

/**
 * Print a single action
 */
function printAction(action: ReconcileAction, prefix: string, options: DisplayOptions): void {
	const typeLabel = sanitizeSingleLineTerminalText(action.type);
	const itemLabel = sanitizeSingleLineTerminalText(action.item);
	const provider = sanitizeSingleLineTerminalText(action.provider);
	const providerLabel = `${provider}${action.global ? " (global)" : ""}`;
	console.log(`    ${prefix} ${typeLabel}/${itemLabel} -> ${providerLabel}`);
	if (action.reason) {
		const reason = sanitizeSingleLineTerminalText(action.reason);
		if (reason) {
			console.log(`      ${options.color ? pc.dim(reason) : reason}`);
		}
	}
}

/**
 * Apply color to text based on color name
 */
function applyColor(text: string, colorName: string): string {
	switch (colorName) {
		case "green":
			return pc.green(text);
		case "yellow":
			return pc.yellow(text);
		case "red":
			return pc.red(text);
		case "magenta":
			return pc.magenta(text);
		case "dim":
			return pc.dim(text);
		default:
			return text;
	}
}

function summarizeExecutionResults(results: PortableInstallResult[]): {
	applied: number;
	skipped: number;
	failed: number;
} {
	let applied = 0;
	let skipped = 0;
	let failed = 0;

	for (const result of results) {
		if (!result.success) {
			failed += 1;
			continue;
		}
		if (result.skipped) {
			skipped += 1;
			continue;
		}
		applied += 1;
	}

	return { applied, skipped, failed };
}

/**
 * Display migration summary after execution
 */
export function displayMigrationSummary(
	plan: ReconcilePlan,
	results: PortableInstallResult[],
	options: { color: boolean },
): void {
	console.log();
	console.log("  Migration Complete");
	console.log();

	const { summary } = plan;
	const resultSummary = summarizeExecutionResults(results);

	if (results.length > 0) {
		// Execution-aligned results for this run.
		if (resultSummary.applied > 0) {
			console.log(
				`  ${options.color ? pc.green("[OK]") : "[OK]"} ${resultSummary.applied} applied`,
			);
		}
		if (resultSummary.skipped > 0) {
			console.log(`  ${options.color ? pc.dim("[i]") : "[i]"}  ${resultSummary.skipped} skipped`);
		}
		if (resultSummary.failed > 0) {
			console.log(`  ${options.color ? pc.red("[X]") : "[X]"} ${resultSummary.failed} failed`);
		}
	} else {
		// Fallback to plan counts when execution result detail is unavailable.
		if (summary.install > 0) {
			console.log(
				`  ${options.color ? pc.green("[OK]") : "[OK]"} ${summary.install} install (planned)`,
			);
		}
		if (summary.update > 0) {
			console.log(
				`  ${options.color ? pc.green("[OK]") : "[OK]"} ${summary.update} update (planned)`,
			);
		}
		if (summary.skip > 0) {
			console.log(
				`  ${options.color ? pc.dim("[i]") : "[i]"}  ${summary.skip} unchanged (planned)`,
			);
		}
		if (summary.delete > 0) {
			console.log(`  ${options.color ? pc.dim("[-]") : "[-]"}  ${summary.delete} delete (planned)`);
		}
	}

	// Conflict resolutions
	const conflicts = plan.actions.filter((a) => a.action === "conflict");
	if (conflicts.length > 0) {
		console.log();
		console.log("  Conflicts resolved:");
		for (const c of conflicts) {
			const conflictKey = sanitizeSingleLineTerminalText(`${c.provider}/${c.type}/${c.item}`);
			const resolution = sanitizeSingleLineTerminalText(c.resolution?.type ?? "skipped");
			console.log(`    ${conflictKey}: ${resolution}`);
		}
	}

	console.log();
}
