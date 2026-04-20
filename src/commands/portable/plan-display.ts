/**
 * Plan display module — format reconciliation plans for terminal output
 * ASCII-only indicators, TTY-aware colors
 * Groups by action type, then sub-groups by portable type (agent, command, skill, etc.)
 */
import { basename, dirname, extname } from "node:path";
import pc from "picocolors";
import {
	formatCdHint,
	formatDisplayPath,
	renderNextStepsFooter,
	renderPanel,
} from "../../ui/ck-cli-design/index.js";
import { sanitizeSingleLineTerminalText } from "./output-sanitizer.js";
import type { ReconcileAction, ReconcilePlan } from "./reconcile-types.js";
import type {
	PortableInstallResult,
	PortableType as PortableItemType,
	ProviderType,
} from "./types.js";

const DEFAULT_MAX_PLAN_GROUP_ITEMS = 20;

type ReconcilePortableType = ReconcileAction["type"];
const TYPE_ORDER: ReconcilePortableType[] = [
	"agent",
	"command",
	"skill",
	"config",
	"rules",
	"hooks",
];
const TYPE_LABELS: Record<ReconcilePortableType, string> = {
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

function subGroupByType(actions: ReconcileAction[]): Map<ReconcilePortableType, ReconcileAction[]> {
	const map = new Map<ReconcilePortableType, ReconcileAction[]>();
	for (const action of actions) {
		const type = action.type;
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

		const remaining = maxItems - totalShown;
		if (remaining <= 0) break;

		// Print type sub-header
		const typeLabel = TYPE_LABELS[type];
		const subHeader = `    ${typeLabel} (${typeActions.length})`;
		console.log(options.color ? pc.dim(subHeader) : subHeader);
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
	options: { color: boolean; dryRun?: boolean },
): void {
	const footer = buildCompletionFooter(plan, results, options.dryRun === true);
	console.log();
	console.log(
		renderPanel({
			subtitle: footer.subtitle,
			title: footer.title,
			zones: footer.zones,
		}).join("\n"),
	);

	if (footer.conflicts.length > 0) {
		console.log();
		console.log("  Conflicts resolved:");
		for (const conflict of footer.conflicts) {
			console.log(`    ${conflict}`);
		}
	}

	console.log();
}

export function buildCompletionFooter(
	plan: ReconcilePlan,
	results: PortableInstallResult[],
	dryRun: boolean,
): {
	conflicts: string[];
	subtitle: string;
	title: string;
	zones: Array<{ label: string; lines: string[] }>;
} {
	const providersInRun = collectProviders(plan, results);
	const conflicts = plan.actions
		.filter((action) => action.action === "conflict" && action.resolution?.type)
		.map((action) =>
			sanitizeSingleLineTerminalText(
				`${action.provider}/${action.type}/${action.item}: ${action.resolution?.type ?? "skipped"}`,
			),
		);
	const resultSummary = summarizeExecutionResults(results);
	const typeCounts = dryRun
		? mergeTypeCounts(collectPlannedTypeCounts(plan), collectResultTypeCounts(results))
		: collectResultTypeCounts(results);
	const whereLines = dryRun
		? mergeWhereLines(collectPlannedWhereLines(plan), collectResultWhereLines(results))
		: collectResultWhereLines(results);
	const issuesCount = results.filter((result) => !result.success).length;
	const deleteCount = results.filter(
		(result) => result.success && !result.skipped && result.operation === "delete",
	).length;
	const zones: Array<{ label: string; lines: string[] }> = [
		{
			label: "WHERE",
			lines: whereLines.length > 0 ? whereLines : ["No destination paths written"],
		},
		{
			label: "WHAT",
			lines: dryRun
				? buildWhatLines(typeCounts, "would change")
				: buildWhatLines(typeCounts, buildApplySummary(resultSummary, deleteCount)),
		},
		{
			label: "NEXT",
			lines: renderNextStepsFooter({ commands: buildNextCommands(providersInRun, typeCounts) }),
		},
	];

	if (!dryRun && issuesCount > 0) {
		zones.push({
			label: "ISSUES",
			lines: [
				`${issuesCount} item(s) failed`,
				"Re-run ck migrate after fixing the reported errors.",
			],
		});
	}

	return {
		conflicts,
		subtitle: dryRun
			? `${sumTypeCounts(typeCounts)} item(s) would change`
			: `${resultSummary.applied} applied, ${issuesCount} failed`,
		title: dryRun ? "Dry run complete" : "Migration complete",
		zones,
	};
}

function collectProviders(plan: ReconcilePlan, results: PortableInstallResult[]): ProviderType[] {
	const providersFromResults = results.map((result) => result.provider as ProviderType);
	const providersFromPlan = plan.actions.map((action) => action.provider as ProviderType);
	return Array.from(new Set([...providersFromResults, ...providersFromPlan]));
}

function collectResultTypeCounts(results: PortableInstallResult[]): Map<PortableItemType, number> {
	const counts = new Map<PortableItemType, number>();
	for (const result of results) {
		if (!result.success || result.skipped || !result.portableType) continue;
		counts.set(result.portableType, (counts.get(result.portableType) ?? 0) + 1);
	}
	return counts;
}

function collectPlannedTypeCounts(plan: ReconcilePlan): Map<PortableItemType, number> {
	const counts = new Map<PortableItemType, number>();
	for (const action of plan.actions) {
		if (!shouldCountInFooter(action)) continue;
		counts.set(action.type, (counts.get(action.type) ?? 0) + 1);
	}
	return counts;
}

function collectResultWhereLines(results: PortableInstallResult[]): string[] {
	const destinations = Array.from(
		new Set(
			results
				.filter(
					(result) =>
						result.success &&
						!result.skipped &&
						result.path.length > 0 &&
						result.operation !== "delete",
				)
				.map((result) => normalizeWhereDestination(result.path, result.portableType ?? "config")),
		),
	).slice(0, 5);
	return destinations.map(
		(destination) =>
			`${formatDisplayPath(destination)} -> ${formatCdHint(resolveCdTarget(destination))}`,
	);
}

function collectPlannedWhereLines(plan: ReconcilePlan): string[] {
	const destinations = Array.from(
		new Set(
			plan.actions
				.filter((action) => shouldCountInFooter(action) && action.targetPath.length > 0)
				.map((action) => normalizeWhereDestination(action.targetPath, action.type)),
		),
	).slice(0, 5);
	return destinations.map(
		(destination) =>
			`${formatDisplayPath(destination)} -> ${formatCdHint(resolveCdTarget(destination))}`,
	);
}

function resolveCdTarget(destination: string): string {
	return extname(destination).length > 0 ? dirname(destination) : destination;
}

function normalizeWhereDestination(path: string, portableType: PortableItemType): string {
	if (portableType === "agent" || portableType === "command" || portableType === "skill") {
		return dirname(path);
	}
	if (portableType === "hooks") {
		return dirname(path);
	}
	if (portableType === "rules") {
		const fileName = basename(path).toLowerCase();
		if (
			fileName === "agents.md" ||
			fileName === "gemini.md" ||
			fileName === ".goosehints" ||
			fileName === "custom_modes.yaml" ||
			fileName === "custom_modes.yml"
		) {
			return path;
		}
		return dirname(path);
	}
	return path;
}

function shouldCountInFooter(action: ReconcileAction): boolean {
	if (action.action === "install" || action.action === "update" || action.action === "delete") {
		return true;
	}
	if (action.action !== "conflict") return false;
	const resolution = action.resolution?.type;
	return resolution === "overwrite" || resolution === "smart-merge" || resolution === "resolved";
}

function buildWhatLines(counts: Map<PortableItemType, number>, trailingSummary: string): string[] {
	const orderedCounts: PortableItemType[] = [
		"agent",
		"skill",
		"command",
		"config",
		"rules",
		"hooks",
	];
	const labels: Record<PortableItemType, string> = {
		agent: "agents",
		command: "commands",
		config: "config",
		hooks: "hooks",
		rules: "rules",
		skill: "skills",
	};
	const parts = orderedCounts
		.map((type) => (counts.get(type) ? `${counts.get(type)} ${labels[type]}` : null))
		.filter((part): part is string => part !== null);
	if (parts.length === 0) {
		return [trailingSummary];
	}
	return [parts.join(" · "), trailingSummary];
}

function buildNextCommands(
	providersInRun: ProviderType[],
	typeCounts: Map<PortableItemType, number>,
): string[] {
	const firstProvider = providersInRun[0];
	const commands = ["ck doctor"];
	if (!firstProvider) return commands;

	const preferredChecks: Array<{ flag: PortableItemType; command: string }> = [
		{ flag: "skill", command: `ck skills --installed --agent ${firstProvider}` },
		{ flag: "agent", command: `ck agents --installed --agent ${firstProvider}` },
		{ flag: "command", command: `ck commands --installed --agent ${firstProvider}` },
	];

	for (const check of preferredChecks) {
		if ((typeCounts.get(check.flag) ?? 0) > 0 && commands.length < 3) {
			commands.push(check.command);
		}
	}

	return commands.slice(0, 3);
}

function mergeTypeCounts(
	primary: Map<PortableItemType, number>,
	fallback: Map<PortableItemType, number>,
): Map<PortableItemType, number> {
	const merged = new Map(primary);
	for (const [portableType, count] of fallback) {
		merged.set(portableType, (merged.get(portableType) ?? 0) + count);
	}
	return merged;
}

function mergeWhereLines(primary: string[], fallback: string[]): string[] {
	return Array.from(new Set([...primary, ...fallback]));
}

function buildApplySummary(
	resultSummary: { applied: number; skipped: number; failed: number },
	deleteCount: number,
): string {
	const appliedCount = Math.max(0, resultSummary.applied - deleteCount);
	const parts = [`${appliedCount} applied`];
	if (deleteCount > 0) {
		parts.push(`${deleteCount} deleted`);
	}
	parts.push(`${resultSummary.skipped} skipped`);
	return parts.join(", ");
}

function sumTypeCounts(counts: Map<PortableItemType, number>): number {
	let total = 0;
	for (const count of counts.values()) {
		total += count;
	}
	return total;
}
