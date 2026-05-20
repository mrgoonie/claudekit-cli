import { listDestructiveOperationBackups } from "@/services/file-operations/destructive-operation-backup-manager.js";
import pc from "picocolors";
import { formatBackupRow } from "./formatters.js";
import type { BackupsListOptions } from "./types.js";

function parseLimit(limit?: string): number | undefined {
	if (!limit) return undefined;
	if (!/^\d+$/.test(limit)) {
		throw new Error(`Invalid backup limit: ${limit}`);
	}
	const parsed = Number.parseInt(limit, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		throw new Error(`Invalid backup limit: ${limit}`);
	}
	return parsed;
}

export async function handleBackupsList(options: BackupsListOptions): Promise<void> {
	const backups = await listDestructiveOperationBackups(parseLimit(options.limit));

	if (options.json) {
		console.log(JSON.stringify(backups, null, 2));
		return;
	}

	if (backups.length === 0) {
		console.log();
		console.log(pc.yellow("No ClaudeKit recovery backups found."));
		console.log();
		console.log(pc.dim("  Backups are stored under: ~/.claudekit/backups/"));
		console.log();
		return;
	}

	const rows = backups.map(formatBackupRow);
	const headers = ["ID", "OPERATION", "CREATED", "ITEMS", "SIZE", "STATUS"];
	const widths = headers.map((header, index) =>
		Math.max(header.length, ...rows.map((row) => row[index].length)),
	);

	console.log();
	console.log(pc.bold(`ClaudeKit Recovery Backups (${backups.length})`));
	console.log();
	console.log(pc.dim(headers.map((header, index) => header.padEnd(widths[index])).join("  ")));
	console.log(pc.dim(widths.map((width) => "-".repeat(width)).join("  ")));

	for (const row of rows) {
		console.log(
			row
				.map((column, index) => {
					if (index === 0) return pc.cyan(column.padEnd(widths[index]));
					if (index === 5 && column === "invalid") return pc.red(column.padEnd(widths[index]));
					return column.padEnd(widths[index]);
				})
				.join("  "),
		);
	}

	console.log();
}
