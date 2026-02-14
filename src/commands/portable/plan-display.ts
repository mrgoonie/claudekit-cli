/**
 * Plan display module — format reconciliation plans for terminal output
 * ASCII-only indicators, TTY-aware colors
 */
import pc from "picocolors";
import type { ReconcileAction, ReconcilePlan } from "./reconcile-types.js";
import type { PortableInstallResult } from "./types.js";

/**
 * Display reconciliation plan before execution
 * Groups by action type with color-coded indicators
 */
export function displayReconcilePlan(plan: ReconcilePlan, options: { color: boolean }): void {
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

	// Install actions (+, green)
	if (groups.install && groups.install.length > 0) {
		printHeader("[+] Install", groups.install.length, "green", options);
		for (const a of groups.install) {
			printAction(a, "+", options);
		}
	}

	// Update actions (~, yellow)
	if (groups.update && groups.update.length > 0) {
		printHeader("[~] Update", groups.update.length, "yellow", options);
		for (const a of groups.update) {
			printAction(a, "~", options);
		}
	}

	// Conflict actions (!, red)
	if (groups.conflict && groups.conflict.length > 0) {
		printHeader("[!] Conflict", groups.conflict.length, "red", options);
		for (const a of groups.conflict) {
			printAction(a, "!", options);
		}
	}

	// Delete actions (-, magenta)
	if (groups.delete && groups.delete.length > 0) {
		printHeader("[-] Delete", groups.delete.length, "magenta", options);
		for (const a of groups.delete) {
			printAction(a, "-", options);
		}
	}

	// Skip actions (i, dim) — show first 5, then "and N more..."
	if (groups.skip && groups.skip.length > 0) {
		printHeader("[i] Skip", groups.skip.length, "dim", options);
		const shown = groups.skip.slice(0, 5);
		for (const a of shown) {
			printAction(a, " ", options);
		}
		if (groups.skip.length > 5) {
			console.log(`      ... and ${groups.skip.length - 5} more unchanged item(s)`);
		}
	}

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
	options: { color: boolean },
): void {
	const text = `  ${label} (${count})`;
	if (options.color) {
		console.log(applyColor(text, colorName));
	} else {
		console.log(text);
	}
}

/**
 * Print a single action
 */
function printAction(action: ReconcileAction, prefix: string, options: { color: boolean }): void {
	const providerLabel = `${action.provider}${action.global ? " (global)" : ""}`;
	console.log(`    ${prefix} ${action.type}/${action.item} -> ${providerLabel}`);
	if (action.reason) {
		console.log(`      ${options.color ? pc.dim(action.reason) : action.reason}`);
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

/**
 * Display migration summary after execution
 */
export function displayMigrationSummary(
	plan: ReconcilePlan,
	_results: PortableInstallResult[],
	options: { color: boolean },
): void {
	console.log();
	console.log("  Migration Complete");
	console.log();

	const { summary } = plan;

	// Action counts
	if (summary.install > 0) {
		console.log(`  ${options.color ? pc.green("[OK]") : "[OK]"} ${summary.install} installed`);
	}
	if (summary.update > 0) {
		console.log(`  ${options.color ? pc.green("[OK]") : "[OK]"} ${summary.update} updated`);
	}
	if (summary.skip > 0) {
		console.log(`  ${options.color ? pc.dim("[i]") : "[i]"}  ${summary.skip} unchanged (skipped)`);
	}
	if (summary.delete > 0) {
		console.log(`  ${options.color ? pc.dim("[-]") : "[-]"}  ${summary.delete} deleted`);
	}

	// Conflict resolutions
	const conflicts = plan.actions.filter((a) => a.action === "conflict");
	if (conflicts.length > 0) {
		console.log();
		console.log("  Conflicts resolved:");
		for (const c of conflicts) {
			const res = c.resolution?.type ?? "skipped";
			console.log(`    ${c.provider}/${c.type}/${c.item}: ${res}`);
		}
	}

	console.log();
}
