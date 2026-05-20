/**
 * Plan Read Command Handlers
 * Subcommands: parse, validate, status, kanban
 * Uses ASCII indicators [OK] [!] [X] [i] — no emojis
 */
import { existsSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { CkConfigManager } from "@/domains/config/index.js";
import {
	buildPlanSummary,
	parsePlanFile,
	scanPlanDir,
	validatePlanFile,
} from "@/domains/plan-parser/index.js";
import type { PlanPhase, PlanSummary, ValidationResult } from "@/domains/plan-parser/plan-types.js";
import { findProjectRoot } from "@/domains/plan-parser/plans-registry.js";
import { logger } from "@/shared/logger.js";
import { output } from "@/shared/output-manager.js";
import pc from "picocolors";
import type { PlanCommandOptions } from "./plan-command.js";
import { isJsonOutput, progressBar, renderPhasesTable, resolvePlanFile } from "./plan-command.js";
import { resolvePlanDependencies } from "./plan-dependencies.js";
import { getGlobalPlansDirFromCwd, resolveTargetFromBase } from "./plan-scope-context.js";

/** parse — output phases as ASCII table or JSON */
export async function handleParse(
	target: string | undefined,
	options: PlanCommandOptions,
): Promise<void> {
	const globalBaseDir = options.global ? await getGlobalPlansDirFromCwd() : undefined;
	const resolvedTarget =
		target && globalBaseDir ? resolveTargetFromBase(target, globalBaseDir) : target;
	if (target && globalBaseDir && !resolvedTarget) {
		output.error("[X] Target must stay within the configured global plans root");
		process.exitCode = 1;
		return;
	}
	const safeTarget = resolvedTarget ?? undefined;
	const planFile = resolvePlanFile(safeTarget, globalBaseDir);
	if (!planFile) {
		output.error(`[X] No plan.md found${target ? ` at '${target}'` : " in current directory"}`);
		process.exitCode = 1;
		return;
	}

	let phases: PlanPhase[];
	let frontmatter: Record<string, unknown>;
	try {
		({ phases, frontmatter } = parsePlanFile(planFile));
	} catch (err) {
		output.error(`[X] Failed to read plan: ${err instanceof Error ? err.message : String(err)}`);
		process.exitCode = 1;
		return;
	}

	if (isJsonOutput(options)) {
		console.log(
			JSON.stringify({ file: relative(process.cwd(), planFile), frontmatter, phases }, null, 2),
		);
		return;
	}

	const title =
		typeof frontmatter.title === "string" ? frontmatter.title : basename(dirname(planFile));
	console.log();
	console.log(pc.bold(`  Plan: ${title}`));
	console.log(`  File: ${planFile}`);
	console.log(`  Phases found: ${phases.length}`);
	console.log();
	if (phases.length > 0) {
		renderPhasesTable(phases);
	} else {
		console.log("  [!] No phases detected");
	}
	console.log();
}

/** validate — format compliance report with line numbers */
export async function handleValidate(
	target: string | undefined,
	options: PlanCommandOptions,
): Promise<void> {
	const globalBaseDir = options.global ? await getGlobalPlansDirFromCwd() : undefined;
	const resolvedTarget =
		target && globalBaseDir ? resolveTargetFromBase(target, globalBaseDir) : target;
	if (target && globalBaseDir && !resolvedTarget) {
		output.error("[X] Target must stay within the configured global plans root");
		process.exitCode = 1;
		return;
	}
	const safeTarget = resolvedTarget ?? undefined;
	const planFile = resolvePlanFile(safeTarget, globalBaseDir);
	if (!planFile) {
		output.error(`[X] No plan.md found${target ? ` at '${target}'` : " in current directory"}`);
		process.exitCode = 1;
		return;
	}

	let result: ValidationResult;
	try {
		result = validatePlanFile(planFile, options.strict ?? false);
	} catch (err) {
		output.error(`[X] Failed to read plan: ${err instanceof Error ? err.message : String(err)}`);
		process.exitCode = 1;
		return;
	}

	if (isJsonOutput(options)) {
		console.log(JSON.stringify(result, null, 2));
		return;
	}

	console.log();
	console.log(pc.bold(`  Validating: ${planFile}`));
	console.log();

	if (result.issues.length === 0) {
		console.log(`  [OK] No issues found — ${result.phases.length} phases detected`);
	} else {
		for (const issue of result.issues) {
			const icon =
				issue.severity === "error" ? "[X]" : issue.severity === "warning" ? "[!]" : "[i]";
			const lineInfo = `L${issue.line}`;
			console.log(`  ${icon} ${lineInfo}: ${issue.message}  (${issue.code})`);
			if (issue.fix) console.log(`      Fix: ${issue.fix}`);
		}
	}

	console.log();
	const validStr = result.valid ? pc.green("[OK] Valid") : pc.red("[X] Invalid");
	console.log(
		`  ${validStr} — ${result.issues.filter((i) => i.severity === "error").length} errors, ${result.issues.filter((i) => i.severity === "warning").length} warnings`,
	);
	console.log();

	if (!result.valid) process.exitCode = 1;
}

/** status — ASCII progress bar + summary. Lists all plans if given a plans/ dir */
export async function handleStatus(
	target: string | undefined,
	options: PlanCommandOptions,
): Promise<void> {
	const globalBaseDir = options.global ? await getGlobalPlansDirFromCwd() : undefined;
	const resolvedTarget =
		target && globalBaseDir ? resolveTargetFromBase(target, globalBaseDir) : target;
	if (target && globalBaseDir && !resolvedTarget) {
		output.error("[X] Target must stay within the configured global plans root");
		process.exitCode = 1;
		return;
	}
	const effectiveTarget = !resolvedTarget && globalBaseDir ? globalBaseDir : resolvedTarget;

	// Check if target is a plans/ directory (contains plan subdirs, not a plan.md itself)
	const t = effectiveTarget ? resolve(effectiveTarget) : null;
	const plansDir =
		t && existsSync(t) && statSync(t).isDirectory() && !existsSync(join(t, "plan.md")) ? t : null;

	if (plansDir) {
		// Multi-plan listing mode
		const planFiles = scanPlanDir(plansDir);
		if (planFiles.length === 0) {
			console.log(`  [!] No plans found in ${plansDir}`);
			return;
		}

		// Preload config once to avoid N+1 reads during dependency resolution
		const projectRoot = findProjectRoot(plansDir);
		const { config: preloadedConfig } = await CkConfigManager.loadFull(projectRoot);

		if (isJsonOutput(options)) {
			const summaries = planFiles.flatMap((pf) => {
				try {
					return [buildPlanSummary(pf)];
				} catch {
					return [];
				}
			});
			const withDependencies = await Promise.all(
				summaries.map(async (summary) => ({
					...summary,
					dependencyStatus: {
						blockedBy: await resolvePlanDependencies(summary.blockedBy, summary.planFile, {
							preloadedConfig,
						}),
						blocks: await resolvePlanDependencies(summary.blocks, summary.planFile, {
							preloadedConfig,
						}),
					},
				})),
			);
			console.log(JSON.stringify(withDependencies, null, 2));
			return;
		}

		console.log();
		console.log(pc.bold(`  Plans in: ${plansDir}`));
		console.log();
		for (const pf of planFiles) {
			try {
				const s = buildPlanSummary(pf);
				const blockedBy = await resolvePlanDependencies(s.blockedBy, pf, { preloadedConfig });
				const blocks = await resolvePlanDependencies(s.blocks, pf, { preloadedConfig });
				const bar = progressBar(s.completed, s.totalPhases);
				const title = s.title ?? basename(dirname(pf));
				console.log(`  ${pc.bold(title)}`);
				console.log(`  ${bar}`);
				if (s.inProgress > 0) console.log(`  [~] ${s.inProgress} in progress`);
				const selfRefs = [...blockedBy, ...blocks].filter((d) => d.isSelfReference);
				if (selfRefs.length > 0) {
					console.log(
						`  [X] Circular: ${selfRefs.map((d) => d.reference).join(", ")} (self-reference)`,
					);
				}
				const validBlockedBy = blockedBy.filter((d) => !d.isSelfReference);
				const validBlocks = blocks.filter((d) => !d.isSelfReference);
				if (validBlockedBy.length > 0) {
					console.log(
						`  [!] Blocked by: ${validBlockedBy.map((dependency) => `${dependency.reference} (${dependency.exists ? (dependency.status ?? "pending") : "not found"})`).join(", ")}`,
					);
				}
				if (validBlocks.length > 0) {
					console.log(
						`  [i] Blocks: ${validBlocks.map((dependency) => `${dependency.reference} (${dependency.exists ? (dependency.status ?? "pending") : "not found"})`).join(", ")}`,
					);
				}
				console.log();
			} catch {
				console.log(`  [X] Failed to read: ${basename(dirname(pf))}`);
				console.log();
			}
		}
		return;
	}

	// Single plan mode
	const safeTarget = resolvedTarget ?? undefined;
	const planFile = resolvePlanFile(safeTarget, globalBaseDir);
	if (!planFile) {
		output.error(`[X] No plan.md found${target ? ` at '${target}'` : " in current directory"}`);
		process.exitCode = 1;
		return;
	}

	let summary: PlanSummary;
	try {
		summary = buildPlanSummary(planFile);
	} catch (err) {
		output.error(`[X] Failed to read plan: ${err instanceof Error ? err.message : String(err)}`);
		process.exitCode = 1;
		return;
	}

	const blockedBy = await resolvePlanDependencies(summary.blockedBy, planFile);
	const blocks = await resolvePlanDependencies(summary.blocks, planFile);

	if (isJsonOutput(options)) {
		console.log(JSON.stringify({ ...summary, dependencyStatus: { blockedBy, blocks } }, null, 2));
		return;
	}

	const title = summary.title ?? basename(dirname(planFile));
	console.log();
	console.log(pc.bold(`  ${title}`));
	if (summary.status) console.log(`  Status: ${summary.status}`);
	console.log();
	console.log(`  Progress: ${progressBar(summary.completed, summary.totalPhases)}`);
	console.log(`  [OK] Completed:   ${summary.completed}`);
	console.log(`  [~]  In Progress: ${summary.inProgress}`);
	console.log(`  [ ]  Pending:     ${summary.pending}`);
	if (summary.branch) console.log(`  Branch: ${summary.branch}`);
	if (summary.tags.length > 0) console.log(`  Tags: ${summary.tags.join(", ")}`);
	if (blockedBy.length > 0) {
		console.log();
		console.log("  Blocked By:");
		for (const dependency of blockedBy) {
			const icon = dependency.exists ? "[OK]" : "[!]";
			const status = dependency.exists ? (dependency.status ?? "pending") : "not found";
			const titleText = dependency.title ? ` ${dependency.title}` : "";
			console.log(`  ${icon} ${dependency.reference}${titleText} (${status})`);
		}
	}
	if (blocks.length > 0) {
		console.log();
		console.log("  Blocks:");
		for (const dependency of blocks) {
			const icon = dependency.exists ? "[OK]" : "[!]";
			const status = dependency.exists ? (dependency.status ?? "pending") : "not found";
			const titleText = dependency.title ? ` ${dependency.title}` : "";
			console.log(`  ${icon} ${dependency.reference}${titleText} (${status})`);
		}
	}
	console.log();
}

/** kanban — open dashboard at /plans?dir=<plans-root>&view=kanban */
export async function handleKanban(
	target: string | undefined,
	options: PlanCommandOptions,
): Promise<void> {
	const globalBaseDir = options.global ? await getGlobalPlansDirFromCwd() : undefined;
	const resolvedTarget =
		target && globalBaseDir ? resolveTargetFromBase(target, globalBaseDir) : target;
	if (target && globalBaseDir && !resolvedTarget) {
		output.error("[X] Target must stay within the configured global plans root");
		process.exitCode = 1;
		return;
	}
	const safeTarget = resolvedTarget ?? undefined;
	const planFile = resolvePlanFile(safeTarget, globalBaseDir);
	if (!planFile) {
		output.error(`[X] No plan.md found${target ? ` at '${target}'` : " in current directory"}`);
		process.exitCode = 1;
		return;
	}

	logger.info("Starting ClaudeKit Dashboard (Plans kanban view)...");

	const { port, dev = false } = options;
	const noOpen = options.open === false;

	let server: { port: number; close: () => Promise<void> };
	try {
		const { startServer } = await import("@/domains/web-server/index.js");
		server = await startServer({ port, openBrowser: false, devMode: dev });
	} catch (err) {
		output.error(`[X] Failed to start server: ${err instanceof Error ? err.message : String(err)}`);
		process.exitCode = 1;
		return;
	}

	const route = `/plans?dir=${encodeURIComponent(dirname(dirname(planFile)))}&view=kanban`;
	const url = `http://localhost:${server.port}${route}`;

	console.log();
	console.log(pc.bold("  ClaudeKit Dashboard — Plans"));
	console.log(pc.dim("  ──────────────────────────────"));
	console.log(`  Local:  ${pc.cyan(url)}`);
	console.log(`  File:   ${planFile}`);
	console.log();
	console.log(pc.dim("  Press Ctrl+C to stop"));
	console.log();

	if (!noOpen) {
		try {
			const { default: open } = await import("open");
			await open(url);
		} catch {
			// Non-fatal: server still runs, user can open URL manually
			console.log(pc.dim("  [i] Could not open browser automatically"));
		}
	}

	// Block until Ctrl+C or SIGTERM — resolves the promise to let the function return cleanly
	await new Promise<void>((resolvePromise) => {
		const shutdown = async () => {
			console.log();
			logger.info("Shutting down...");
			// Race server.close() against a 3s timeout to avoid hanging on open connections
			await Promise.race([server.close(), new Promise<void>((r) => setTimeout(r, 3000))]);
			resolvePromise();
		};
		process.once("SIGINT", shutdown);
		process.once("SIGTERM", shutdown);
	});
}
