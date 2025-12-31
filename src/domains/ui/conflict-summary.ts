/**
 * Conflict resolution summary display for dual-kit installations
 */
import type { FileConflictInfo } from "@/domains/installation/selective-merger.js";
import { logger } from "@/shared/logger.js";
import pc from "picocolors";
import type { HookConflictInfo, McpConflictInfo } from "../config/merger/types.js";

export interface ConflictSummary {
	files: {
		updated: FileConflictInfo[];
		kept: FileConflictInfo[];
	};
	hooks: {
		updated: HookConflictInfo[];
		kept: HookConflictInfo[];
	};
	mcp: {
		updated: McpConflictInfo[];
		kept: McpConflictInfo[];
	};
}

/**
 * Display conflict resolution summary at install end
 */
export function displayConflictSummary(summary: ConflictSummary): void {
	const totalUpdated =
		summary.files.updated.length + summary.hooks.updated.length + summary.mcp.updated.length;
	const totalKept = summary.files.kept.length + summary.hooks.kept.length + summary.mcp.kept.length;

	if (totalUpdated === 0 && totalKept === 0) {
		logger.verbose("No conflicts detected during installation");
		return;
	}

	console.log();
	console.log(pc.bold("Dual-Kit Conflict Resolution"));
	console.log(pc.dim("─".repeat(40)));

	// Files
	if (summary.files.updated.length > 0 || summary.files.kept.length > 0) {
		const updated = summary.files.updated.length;
		const kept = summary.files.kept.length;
		const winners = formatWinners(summary.files.updated);
		console.log(
			`  Files:   ${pc.green(`${updated} updated`)}${winners}, ${pc.dim(`${kept} kept`)}`,
		);
	}

	// Hooks
	if (summary.hooks.updated.length > 0 || summary.hooks.kept.length > 0) {
		const updated = summary.hooks.updated.length;
		const kept = summary.hooks.kept.length;
		const winners = formatHookWinners(summary.hooks.updated);
		console.log(
			`  Hooks:   ${pc.green(`${updated} updated`)}${winners}, ${pc.dim(`${kept} kept`)}`,
		);
	}

	// MCP
	if (summary.mcp.updated.length > 0 || summary.mcp.kept.length > 0) {
		const updated = summary.mcp.updated.length;
		const kept = summary.mcp.kept.length;
		const winners = formatMcpWinners(summary.mcp.updated);
		console.log(
			`  MCP:     ${pc.green(`${updated} updated`)}${winners}, ${pc.dim(`${kept} kept`)}`,
		);
	}

	// Verbose details
	if (logger.isVerbose() && totalUpdated > 0) {
		console.log();
		console.log(pc.dim("Details:"));

		for (const file of summary.files.updated) {
			console.log(`  ${pc.dim("-")} ${file.relativePath}: ${pc.green(file.winner)} won`);
		}
		for (const hook of summary.hooks.updated) {
			const shortCmd = hook.command.length > 40 ? `${hook.command.slice(0, 40)}...` : hook.command;
			console.log(`  ${pc.dim("-")} hook: ${shortCmd} → ${pc.green(hook.winner)}`);
		}
		for (const mcp of summary.mcp.updated) {
			console.log(`  ${pc.dim("-")} mcp: ${mcp.serverName} → ${pc.green(mcp.winner)}`);
		}
	}

	console.log();
}

function formatWinners(items: FileConflictInfo[]): string {
	const counts = new Map<string, number>();
	for (const item of items) {
		const kit = item.winner === "incoming" ? item.incomingKit : item.existingKit;
		counts.set(kit, (counts.get(kit) ?? 0) + 1);
	}
	if (counts.size === 0) return "";
	const parts = Array.from(counts.entries()).map(([kit, count]) => `${kit}: ${count}`);
	return pc.dim(` (${parts.join(", ")})`);
}

function formatHookWinners(items: HookConflictInfo[]): string {
	const counts = new Map<string, number>();
	for (const item of items) {
		counts.set(item.winner, (counts.get(item.winner) ?? 0) + 1);
	}
	if (counts.size === 0) return "";
	const parts = Array.from(counts.entries()).map(([kit, count]) => `${kit}: ${count}`);
	return pc.dim(` (${parts.join(", ")})`);
}

function formatMcpWinners(items: McpConflictInfo[]): string {
	const counts = new Map<string, number>();
	for (const item of items) {
		counts.set(item.winner, (counts.get(item.winner) ?? 0) + 1);
	}
	if (counts.size === 0) return "";
	const parts = Array.from(counts.entries()).map(([kit, count]) => `${kit}: ${count}`);
	return pc.dim(` (${parts.join(", ")})`);
}

/**
 * Build conflict summary from merge results
 */
export function buildConflictSummary(
	fileConflicts: FileConflictInfo[],
	hookConflicts: HookConflictInfo[],
	mcpConflicts: McpConflictInfo[],
): ConflictSummary {
	return {
		files: {
			updated: fileConflicts.filter((c) => c.winner === "incoming"),
			kept: fileConflicts.filter((c) => c.winner === "existing"),
		},
		hooks: {
			updated: hookConflicts.filter((c) => c.winner !== "existing"),
			kept: hookConflicts.filter((c) => c.winner === "existing"),
		},
		mcp: {
			updated: mcpConflicts.filter((c) => c.winner !== "existing"),
			kept: mcpConflicts.filter((c) => c.winner === "existing"),
		},
	};
}
