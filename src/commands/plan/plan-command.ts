/**
 * Plan Command
 * Subcommands: parse, validate, status, kanban
 * Uses ASCII indicators [OK] [!] [X] [i] — no emojis
 */
import { existsSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import {
	buildPlanSummary,
	parsePlanFile,
	scanPlanDir,
	validatePlanFile,
} from "@/domains/plan-parser/index.js";
import type { PlanPhase, PlanSummary, ValidationResult } from "@/domains/plan-parser/plan-types.js";
import { logger } from "@/shared/logger.js";
import { output } from "@/shared/output-manager.js";
import pc from "picocolors";

// ─── Options type ─────────────────────────────────────────────────────────────

export interface PlanCommandOptions {
	json?: boolean;
	strict?: boolean;
	port?: number;
	open?: boolean;
	dev?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve a plan file from a target string (file path or directory).
 * If target is a directory, looks for plan.md inside it.
 */
function resolvePlanFile(target?: string): string | null {
	const t = target ? resolve(target) : process.cwd();

	if (existsSync(t)) {
		const stat = statSync(t);
		if (stat.isFile()) return t;
		// Target is a directory — look for plan.md
		const candidate = join(t, "plan.md");
		if (existsSync(candidate)) return candidate;
	}

	return null;
}

/**
 * Returns true if JSON output is requested via --json flag or --format json
 */
function isJsonOutput(options: PlanCommandOptions): boolean {
	return options.json === true;
}

/**
 * Render a simple ASCII progress bar
 * e.g. "[####----]  4/8 (50%)"
 */
function progressBar(completed: number, total: number, width = 20): string {
	if (!Number.isFinite(completed) || !Number.isFinite(total)) return `[${"-".repeat(width)}]  ?/?`;
	if (total <= 0) return `[${"-".repeat(width)}]  0/0`;
	const filled = Math.max(0, Math.min(width, Math.round((completed / total) * width)));
	const bar = `${"#".repeat(filled)}${"-".repeat(Math.max(0, width - filled))}`;
	const pct = Math.round((completed / total) * 100);
	return `[${bar}]  ${completed}/${total} (${pct}%)`;
}

/**
 * Render phases as an ASCII table
 */
function renderPhasesTable(phases: PlanPhase[]): void {
	const maxId = Math.max(4, ...phases.map((p) => p.phaseId.length));
	const maxName = Math.max(4, ...phases.map((p) => p.name.length));
	const maxStatus = 11; // "in-progress"

	const pad = (s: string, n: number) => s.padEnd(n);
	// Use ASCII-safe separators for Windows CMD/PowerShell compatibility
	const line = `${"-".repeat(maxId + 2)}+${"-".repeat(maxName + 2)}+${"-".repeat(maxStatus + 2)}`;

	console.log(`  ${pad("ID", maxId)}  | ${pad("Name", maxName)}  | Status`);
	console.log(`  ${line}`);

	for (const p of phases) {
		const statusIcon =
			p.status === "completed" ? "[OK]" : p.status === "in-progress" ? "[~]" : "[ ]";
		const idStr = pad(p.phaseId, maxId);
		const nameStr = pad(p.name.slice(0, maxName), maxName);
		console.log(`  ${idStr}  | ${nameStr}  | ${statusIcon} ${p.status}`);
	}
}

// ─── Subcommand Handlers ──────────────────────────────────────────────────────

/** parse — output phases as ASCII table or JSON */
export async function handleParse(
	target: string | undefined,
	options: PlanCommandOptions,
): Promise<void> {
	const planFile = resolvePlanFile(target);
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
		console.log(JSON.stringify({ file: planFile, frontmatter, phases }, null, 2));
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
	const planFile = resolvePlanFile(target);
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
	// Check if target is a plans/ directory (contains plan subdirs, not a plan.md itself)
	const t = target ? resolve(target) : null;
	const plansDir =
		t && existsSync(t) && statSync(t).isDirectory() && !existsSync(join(t, "plan.md")) ? t : null;

	if (plansDir) {
		// Multi-plan listing mode
		const planFiles = scanPlanDir(plansDir);
		if (planFiles.length === 0) {
			console.log(`  [!] No plans found in ${plansDir}`);
			return;
		}

		if (isJsonOutput(options)) {
			const summaries = planFiles.flatMap((pf) => {
				try {
					return [buildPlanSummary(pf)];
				} catch {
					return [];
				}
			});
			console.log(JSON.stringify(summaries, null, 2));
			return;
		}

		console.log();
		console.log(pc.bold(`  Plans in: ${plansDir}`));
		console.log();
		for (const pf of planFiles) {
			try {
				const s = buildPlanSummary(pf);
				const bar = progressBar(s.completed, s.totalPhases);
				const title = s.title ?? basename(dirname(pf));
				console.log(`  ${pc.bold(title)}`);
				console.log(`  ${bar}`);
				if (s.inProgress > 0) console.log(`  [~] ${s.inProgress} in progress`);
				console.log();
			} catch {
				console.log(`  [X] Failed to read: ${basename(dirname(pf))}`);
				console.log();
			}
		}
		return;
	}

	// Single plan mode
	const planFile = resolvePlanFile(target);
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

	if (isJsonOutput(options)) {
		console.log(JSON.stringify(summary, null, 2));
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
	console.log();
}

/** kanban — open dashboard at /kanban?file=<path> */
export async function handleKanban(
	target: string | undefined,
	options: PlanCommandOptions,
): Promise<void> {
	const planFile = resolvePlanFile(target);
	if (!planFile) {
		output.error(`[X] No plan.md found${target ? ` at '${target}'` : " in current directory"}`);
		process.exitCode = 1;
		return;
	}

	logger.info("Starting ClaudeKit Dashboard (Kanban view)...");

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

	const encodedPath = encodeURIComponent(planFile);
	const url = `http://localhost:${server.port}/kanban?file=${encodedPath}`;

	console.log();
	console.log(pc.bold("  ClaudeKit Dashboard — Kanban"));
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

// ─── Main dispatcher ──────────────────────────────────────────────────────────

/**
 * Entry point for `ck plan [action] [target]`
 * Actions: parse, validate, status, kanban (default: status)
 */
export async function planCommand(
	action: string | undefined,
	target: string | undefined,
	options: PlanCommandOptions,
): Promise<void> {
	// Known subcommands — checked before path heuristic to avoid false positives
	const knownActions = new Set(["parse", "validate", "status", "kanban"]);

	let resolvedAction = action;
	let resolvedTarget = target;

	// If action is not a known subcommand, check if it's a file/path/directory target
	if (resolvedAction && !knownActions.has(resolvedAction)) {
		const looksLikePath =
			resolvedAction.includes("/") ||
			resolvedAction.includes("\\") ||
			resolvedAction.endsWith(".md") ||
			resolvedAction === "." ||
			resolvedAction === "..";
		// Fallback: bare name that exists on disk (e.g. "ck plan my-feature-plan")
		const existsOnDisk = !looksLikePath && existsSync(resolve(resolvedAction));
		if (looksLikePath || existsOnDisk) {
			resolvedTarget = resolvedAction;
			resolvedAction = undefined;
		}
	}

	const act = resolvedAction ?? "status";

	switch (act) {
		case "parse":
			await handleParse(resolvedTarget, options);
			break;
		case "validate":
			await handleValidate(resolvedTarget, options);
			break;
		case "status":
			await handleStatus(resolvedTarget, options);
			break;
		case "kanban":
			await handleKanban(resolvedTarget, options);
			break;
		default:
			output.error(`[X] Unknown action '${act}'. Use: parse, validate, status, kanban`);
			process.exitCode = 1;
	}
}
