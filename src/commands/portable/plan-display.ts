/**
 * Plan display module — format reconciliation plans for terminal output
 * ASCII-only indicators, TTY-aware colors
 * Groups by action type, then sub-groups by portable type (agent, command, skill, etc.)
 */
import pc from "picocolors";
import { sanitizeSingleLineTerminalText } from "./output-sanitizer.js";
import type { ReconcileAction, ReconcilePlan } from "./reconcile-types.js";
import type { PortableInstallResult } from "./types.js";

const DEFAULT_MAX_PLAN_GROUP_ITEMS = 20;

type PortableType = "agent" | "command" | "skill" | "config" | "rules" | "hooks";
const TYPE_ORDER: PortableType[] = ["agent", "command", "skill", "config", "rules", "hooks"];
const TYPE_LABELS: Record<PortableType, string> = {
	agent: "Subagents",
	command: "Commands",
	skill: "Skills",
	config: "Config",
	rules: "Rules",
	hooks: "Hooks",
};

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

function subGroupByType(actions: ReconcileAction[]): Map<PortableType, ReconcileAction[]> {
	const map = new Map<PortableType, ReconcileAction[]>();
	for (const action of actions) {
		const type = action.type as PortableType;
		const list = map.get(type) || [];
		list.push(action);
		map.set(type, list);
	}
	return map;
}

/**
 * Display reconciliation plan before execution
 * Groups by action type, sub-grouped by portable type
 */
export function displayReconcilePlan(plan: ReconcilePlan, options: DisplayOptions): void {
	const { actions, summary } = plan;

	console.log();
	console.log("  Migration Plan");
	console.log();

	// Group actions by action type
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
 * Print a bounded action group with type sub-sections.
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

	const typeGroups = subGroupByType(actions);
	const maxItems = resolveMaxItemsPerGroup(options);
	let totalShown = 0;

	for (const type of TYPE_ORDER) {
		const typeActions = typeGroups.get(type);
		if (!typeActions || typeActions.length === 0) continue;

		// Print type sub-header
		const typeLabel = TYPE_LABELS[type];
		const subHeader = `    ${typeLabel} (${typeActions.length})`;
		console.log(options.color ? pc.dim(subHeader) : subHeader);

		const remaining = maxItems - totalShown;
		if (remaining <= 0) break;
		const shown = typeActions.slice(0, remaining);
		for (const action of shown) {
			printAction(action, prefix, options);
		}
		totalShown += shown.length;

		const hiddenInType = typeActions.length - shown.length;
		if (hiddenInType > 0) {
			const notice = `        ... and ${hiddenInType} more ${typeLabel.toLowerCase()}`;
			console.log(options.color ? pc.dim(notice) : notice);
		}
	}
}

/**
 * Print a single action
 */
function printAction(action: ReconcileAction, prefix: string, options: DisplayOptions): void {
	const itemLabel = sanitizeSingleLineTerminalText(action.item);
	const provider = sanitizeSingleLineTerminalText(action.provider);
	const providerLabel = `${provider}${action.global ? " (global)" : ""}`;
	console.log(`      ${prefix} ${itemLabel} -> ${providerLabel}`);
	if (action.reason) {
		const reason = sanitizeSingleLineTerminalText(action.reason);
		if (reason) {
			console.log(`        ${options.color ? pc.dim(reason) : reason}`);
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
 * Display migration summary after execution.
 * Uses plan-based counts (accurate) as primary display, with execution failures from results.
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

	// Plan-based counts are the source of truth for what happened
	const installed = summary.install;
	const updated = summary.update;
	const skipped = summary.skip;
	const deleted = summary.delete;
	const failed = resultSummary.failed;

	if (installed > 0) {
		console.log(`  ${options.color ? pc.green("[OK]") : "[OK]"} ${installed} installed`);
	}
	if (updated > 0) {
		console.log(`  ${options.color ? pc.green("[OK]") : "[OK]"} ${updated} updated`);
	}
	if (skipped > 0) {
		console.log(`  ${options.color ? pc.dim("[i]") : "[i]"}  ${skipped} skipped`);
	}
	if (deleted > 0) {
		console.log(`  ${options.color ? pc.dim("[-]") : "[-]"}  ${deleted} deleted`);
	}
	if (failed > 0) {
		console.log(`  ${options.color ? pc.red("[X]") : "[X]"} ${failed} failed`);
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
