/**
 * Plan Write Command Handlers
 * Subcommands: create, check, uncheck, add-phase
 * Uses ASCII indicators [OK] [!] [X] [i] — no emojis
 */
import { basename, dirname, relative, resolve } from "node:path";
import {
	addPhase,
	buildPlanSummary,
	scaffoldPlan,
	updatePhaseStatus,
} from "@/domains/plan-parser/index.js";
import {
	trackPhaseChecked,
	trackPhaseUnchecked,
	trackPlanCompleted,
	trackPlanCreated,
} from "@/domains/plan-parser/plan-telemetry.js";
import {
	findProjectRoot,
	registerNewPlan,
	updateRegistryAddPhase,
	updateRegistryPhaseStatus,
} from "@/domains/plan-parser/plans-registry.js";
import { output } from "@/shared/output-manager.js";
import pc from "picocolors";
import type { PlanCommandOptions } from "./plan-command.js";
import { isJsonOutput, resolvePlanFile } from "./plan-command.js";
import { getGlobalPlansDirFromCwd, resolveTargetFromBase } from "./plan-scope-context.js";

// ─── Handlers ────────────────────────────────────────────────────────────────

/**
 * create — scaffold a new plan directory with plan.md and phase files.
 * Requires: --title, --phases (comma-separated), --dir or target arg.
 */
export async function handleCreate(
	target: string | undefined,
	options: PlanCommandOptions,
): Promise<void> {
	// Validate required options
	if (!options.title) {
		output.error("[X] --title is required for create");
		process.exitCode = 1;
		return;
	}
	if (!options.phases) {
		output.error("[X] --phases is required for create (comma-separated names)");
		process.exitCode = 1;
		return;
	}

	// Parse comma-separated phases
	const phaseNames = options.phases
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	if (phaseNames.length === 0) {
		output.error("[X] At least one phase name required");
		process.exitCode = 1;
		return;
	}

	// Validate priority
	const validPriorities = ["P1", "P2", "P3"] as const;
	const priority = options.priority ?? "P2";
	if (!validPriorities.includes(priority as (typeof validPriorities)[number])) {
		output.error(`[X] Invalid priority "${priority}". Use: P1, P2, P3`);
		process.exitCode = 1;
		return;
	}

	// Resolve dir: --dir flag > target arg > error
	const dir = options.dir ?? target;
	if (!dir) {
		output.error("[X] --dir or target directory required for create");
		process.exitCode = 1;
		return;
	}

	const globalBaseDir = options.global ? await getGlobalPlansDirFromCwd() : undefined;
	const resolvedDir = globalBaseDir ? resolveTargetFromBase(dir, globalBaseDir) : resolve(dir);
	if (globalBaseDir && !resolvedDir) {
		output.error("[X] Target directory must stay within the configured global plans root");
		process.exitCode = 1;
		return;
	}
	const safeResolvedDir = resolvedDir ?? resolve(dir);
	const result = scaffoldPlan({
		title: options.title,
		phases: phaseNames.map((name) => ({ name })),
		dir: safeResolvedDir,
		priority: priority as "P1" | "P2" | "P3",
		issue: options.issue ? Number(options.issue) : undefined,
		source: options.source ?? "cli",
		sessionId: options.sessionId,
	});

	// Register plan in global plans registry (~/.claude/plans-registries/)
	const source = options.source ?? "cli";
	try {
		const projectRoot = findProjectRoot(safeResolvedDir);
		registerNewPlan({
			dir: safeResolvedDir,
			title: options.title,
			priority: priority as "P1" | "P2" | "P3",
			source,
			phases: result.phaseIds,
			cwd: projectRoot,
		});
	} catch {
		// Registry update is non-critical; continue silently
	}

	// Telemetry (no-op stub, debug logging when CK_TELEMETRY=1)
	try {
		trackPlanCreated(safeResolvedDir, source);
	} catch {
		// Telemetry is non-critical; continue silently
	}

	if (isJsonOutput(options)) {
		const cwd = process.cwd();
		console.log(
			JSON.stringify(
				{
					planFile: relative(cwd, result.planFile),
					phaseFiles: result.phaseFiles.map((f) => relative(cwd, f)),
				},
				null,
				2,
			),
		);
		return;
	}

	console.log();
	console.log(pc.bold(`  [OK] Plan created: ${options.title}`));
	console.log(`  Directory: ${safeResolvedDir}`);
	console.log(`  Phases: ${result.phaseFiles.length}`);
	for (const f of result.phaseFiles) {
		console.log(`    [ ] ${basename(f)}`);
	}
	console.log();
}

/**
 * check — mark a phase as completed (or in-progress with --start).
 * Positional target is the phase ID (e.g. "1", "2b").
 */
export async function handleCheck(
	target: string | undefined,
	options: PlanCommandOptions,
): Promise<void> {
	if (!target) {
		output.error("[X] Phase ID required: ck plan check <id>");
		process.exitCode = 1;
		return;
	}

	const planFile = resolvePlanFile();
	if (!planFile) {
		output.error("[X] No plan.md found in current directory or parent");
		process.exitCode = 1;
		return;
	}

	const newStatus = options.start ? "in-progress" : "completed";
	try {
		updatePhaseStatus(planFile, target, newStatus as "pending" | "in-progress" | "completed");
	} catch (err) {
		output.error(`[X] ${err instanceof Error ? err.message : String(err)}`);
		process.exitCode = 1;
		return;
	}

	// Update registry with new status and progress
	const planDir = dirname(planFile);
	let planStatus = "pending";
	try {
		const projectRoot = findProjectRoot(planDir);
		const summary = buildPlanSummary(planFile);
		planStatus = summary.status ?? "pending";
		updateRegistryPhaseStatus({
			planDir,
			planStatus,
			progressPct: summary.progressPct,
			cwd: projectRoot,
		});
	} catch {
		// Registry update is non-critical; continue silently
	}

	// Telemetry (no-op stub, debug logging when CK_TELEMETRY=1)
	try {
		trackPhaseChecked(planDir, target, options.source ?? "cli");
		if (planStatus === "done") {
			trackPlanCompleted(planDir, options.source ?? "cli");
		}
	} catch {
		// Telemetry is non-critical; continue silently
	}

	if (isJsonOutput(options)) {
		console.log(
			JSON.stringify({
				phaseId: target,
				status: newStatus,
				planFile: relative(process.cwd(), planFile),
			}),
		);
		return;
	}

	const icon = newStatus === "completed" ? "[OK]" : "[~]";
	console.log(`  ${icon} Phase ${target}: ${newStatus}`);
}

/**
 * uncheck — reset a phase status back to pending.
 * Positional target is the phase ID (e.g. "1", "2b").
 */
export async function handleUncheck(
	target: string | undefined,
	options: PlanCommandOptions,
): Promise<void> {
	if (!target) {
		output.error("[X] Phase ID required: ck plan uncheck <id>");
		process.exitCode = 1;
		return;
	}

	const planFile = resolvePlanFile();
	if (!planFile) {
		output.error("[X] No plan.md found in current directory or parent");
		process.exitCode = 1;
		return;
	}

	try {
		updatePhaseStatus(planFile, target, "pending");
	} catch (err) {
		output.error(`[X] ${err instanceof Error ? err.message : String(err)}`);
		process.exitCode = 1;
		return;
	}

	// Update registry with new status and progress
	const planDir = dirname(planFile);
	try {
		const projectRoot = findProjectRoot(planDir);
		const summary = buildPlanSummary(planFile);
		updateRegistryPhaseStatus({
			planDir,
			planStatus: summary.status ?? "pending",
			progressPct: summary.progressPct,
			cwd: projectRoot,
		});
	} catch {
		// Registry update is non-critical; continue silently
	}

	// Telemetry (no-op stub, debug logging when CK_TELEMETRY=1)
	try {
		trackPhaseUnchecked(planDir, target, options.source ?? "cli");
	} catch {
		// Telemetry is non-critical; continue silently
	}

	if (isJsonOutput(options)) {
		console.log(
			JSON.stringify({
				phaseId: target,
				status: "pending",
				planFile: relative(process.cwd(), planFile),
			}),
		);
		return;
	}

	console.log(`  [ ] Phase ${target}: pending`);
}

/**
 * add-phase — append a new phase (or sub-phase with --after) to plan.md.
 * Positional target is the new phase name.
 */
export async function handleAddPhase(
	target: string | undefined,
	options: PlanCommandOptions,
): Promise<void> {
	if (!target) {
		output.error("[X] Phase name required: ck plan add-phase <name>");
		process.exitCode = 1;
		return;
	}

	const planFile = resolvePlanFile();
	if (!planFile) {
		output.error("[X] No plan.md found in current directory or parent");
		process.exitCode = 1;
		return;
	}

	try {
		const result = addPhase(planFile, target, options.after);

		// Update registry with new phase
		try {
			const planDir = dirname(planFile);
			const projectRoot = findProjectRoot(planDir);
			updateRegistryAddPhase({
				planDir,
				phaseId: result.phaseId,
				cwd: projectRoot,
			});
		} catch {
			// Registry update is non-critical; continue silently
		}

		if (isJsonOutput(options)) {
			console.log(
				JSON.stringify({
					phaseId: result.phaseId,
					phaseFile: relative(process.cwd(), result.phaseFile),
				}),
			);
			return;
		}

		console.log(`  [OK] Added phase ${result.phaseId}: ${target}`);
		console.log(`  File: ${result.phaseFile}`);
	} catch (err) {
		output.error(`[X] ${err instanceof Error ? err.message : String(err)}`);
		process.exitCode = 1;
	}
}
