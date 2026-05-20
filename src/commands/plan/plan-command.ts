/**
 * Plan Command
 * Subcommands: parse, validate, status, kanban, create, check, uncheck, add-phase
 * Uses ASCII indicators [OK] [!] [X] [i] — no emojis
 */
import { existsSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, parse, resolve } from "node:path";
import type { PlanPhase } from "@/domains/plan-parser/plan-types.js";
import { output } from "@/shared/output-manager.js";
import { handleKanban, handleParse, handleStatus, handleValidate } from "./plan-read-handlers.js";
import { handleAddPhase, handleCheck, handleCreate, handleUncheck } from "./plan-write-handlers.js";

// ─── Options type ─────────────────────────────────────────────────────────────

export interface PlanCommandOptions {
	json?: boolean;
	strict?: boolean;
	port?: number;
	open?: boolean;
	dev?: boolean;
	global?: boolean;
	// Write command options:
	title?: string;
	phases?: string;
	dir?: string;
	priority?: string;
	issue?: string;
	after?: string;
	start?: boolean;
	// Tracking metadata (for CLI-strict plan tracking):
	source?: "skill" | "cli" | "dashboard";
	sessionId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve a plan file from a target string (file path or directory).
 * If target is a directory, looks for plan.md inside it.
 * If no target given, walks up parent directories to find plan.md.
 */
function resolveTargetPath(target: string, baseDir?: string): string {
	if (!baseDir) {
		return resolve(target);
	}

	if (isAbsolute(target)) {
		return resolve(target);
	}

	const cwdCandidate = resolve(target);
	if (existsSync(cwdCandidate)) {
		return cwdCandidate;
	}

	return resolve(baseDir, target);
}

export function resolvePlanFile(target?: string, baseDir?: string): string | null {
	const t = target
		? resolveTargetPath(target, baseDir)
		: baseDir
			? resolve(baseDir)
			: process.cwd();

	if (existsSync(t)) {
		const stat = statSync(t);
		if (stat.isFile()) return t;
		// Target is a directory — look for plan.md
		const candidate = join(t, "plan.md");
		if (existsSync(candidate)) return candidate;
	}

	// Walk up parent directories (only when no explicit target)
	if (!target && !baseDir) {
		let dir = process.cwd();
		const root = parse(dir).root;
		while (dir !== root) {
			const candidate = join(dir, "plan.md");
			if (existsSync(candidate)) return candidate;
			dir = dirname(dir);
		}
	}

	return null;
}

/**
 * Returns true if JSON output is requested via --json flag
 */
export function isJsonOutput(options: PlanCommandOptions): boolean {
	return options.json === true;
}

/**
 * Render a simple ASCII progress bar
 * e.g. "[####----]  4/8 (50%)"
 */
export function progressBar(completed: number, total: number, width = 20): string {
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
export function renderPhasesTable(phases: PlanPhase[]): void {
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
	const knownActions = new Set([
		"parse",
		"validate",
		"status",
		"kanban",
		"create",
		"check",
		"uncheck",
		"add-phase",
	]);

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
		case "create":
			await handleCreate(resolvedTarget, options);
			break;
		case "check":
			await handleCheck(resolvedTarget, options);
			break;
		case "uncheck":
			await handleUncheck(resolvedTarget, options);
			break;
		case "add-phase":
			await handleAddPhase(resolvedTarget, options);
			break;
		default:
			output.error(
				`[X] Unknown action '${act}'. Use: parse, validate, status, kanban, create, check, uncheck, add-phase`,
			);
			process.exitCode = 1;
	}
}
