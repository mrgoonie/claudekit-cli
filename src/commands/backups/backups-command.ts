import type { cac } from "cac";
import { handleBackupsList } from "./list-handler.js";
import { handleBackupsPrune } from "./prune-handler.js";
import { handleBackupsRestore } from "./restore-handler.js";
import type { BackupsListOptions, BackupsPruneOptions, BackupsRestoreOptions } from "./types.js";

type BackupAction = "list" | "restore" | "prune";
type BackupsCommandOptions = BackupsListOptions & BackupsRestoreOptions & BackupsPruneOptions;

function emitJsonError(message: string): void {
	console.log(
		JSON.stringify(
			{
				ok: false,
				error: message,
			},
			null,
			2,
		),
	);
}

async function runBackupsCommand(
	action: string | undefined,
	id: string | undefined,
	options: BackupsCommandOptions,
): Promise<void> {
	const resolvedAction: BackupAction = (action ?? "list") as BackupAction;

	switch (resolvedAction) {
		case "list":
			await handleBackupsList(options);
			return;
		case "restore":
			if (!id) {
				throw new Error("Usage: ck backups restore <id>");
			}
			await handleBackupsRestore(id, options);
			return;
		case "prune":
			await handleBackupsPrune(id, options);
			return;
		default:
			throw new Error(`Unknown backups action: ${action}`);
	}
}

export function registerBackupsCommand(cli: ReturnType<typeof cac>): void {
	cli
		.command("backups [action] [id]", "List, restore, and prune ClaudeKit recovery backups")
		.option("--json", "Output in JSON format")
		.option("--limit <limit>", "Limit the number of backups shown")
		.option("-y, --yes", "Skip confirmation prompt")
		.option("--all", "Delete all recovery backups")
		.option("--keep <count>", "Keep the newest N backups and prune the rest")
		.action(async (action: string | undefined, id: string | undefined, options) => {
			try {
				await runBackupsCommand(action, id, options);
			} catch (error) {
				if (options.json) {
					emitJsonError(error instanceof Error ? error.message : "Unknown error");
					process.exitCode = 1;
					return;
				}
				throw error;
			}
		});
}
