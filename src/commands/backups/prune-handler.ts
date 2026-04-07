import {
	DEFAULT_DESTRUCTIVE_BACKUP_KEEP_COUNT,
	getDestructiveOperationBackupSummary,
	pruneDestructiveOperationBackups,
} from "@/services/file-operations/destructive-operation-backup-manager.js";
import { withProcessLock } from "@/shared/process-lock.js";
import { confirm, isCancel, log } from "@/shared/safe-prompts.js";
import type { BackupsPruneOptions } from "./types.js";

function parseKeepCount(keep?: string): number {
	if (!keep) return DEFAULT_DESTRUCTIVE_BACKUP_KEEP_COUNT;
	if (!/^\d+$/.test(keep)) {
		throw new Error(`Invalid keep count: ${keep}`);
	}
	const parsed = Number.parseInt(keep, 10);
	if (!Number.isFinite(parsed) || parsed < 0) {
		throw new Error(`Invalid keep count: ${keep}`);
	}
	return parsed;
}

export async function handleBackupsPrune(
	backupId: string | undefined,
	options: BackupsPruneOptions,
	deps?: { confirmFn?: typeof confirm },
): Promise<void> {
	if (backupId && options.all) {
		throw new Error("Cannot combine a backup id with --all.");
	}
	if (backupId && options.keep) {
		throw new Error("Cannot combine a backup id with --keep.");
	}
	if (options.all && options.keep) {
		throw new Error("Cannot combine --all with --keep.");
	}

	let promptMessage: string;
	if (backupId) {
		const summary = await getDestructiveOperationBackupSummary(backupId);
		promptMessage = `Delete backup ${summary.id}?`;
	} else if (options.all) {
		promptMessage = "Delete all ClaudeKit recovery backups?";
	} else {
		const keepCount = parseKeepCount(options.keep);
		promptMessage = `Prune old ClaudeKit recovery backups and keep the newest ${keepCount}?`;
	}

	const confirmed =
		options.yes === true
			? true
			: await (deps?.confirmFn ?? confirm)({
					message: promptMessage,
					initialValue: false,
				});

	if (isCancel(confirmed) || confirmed !== true) {
		if (options.json) {
			console.log(
				JSON.stringify(
					{
						ok: true,
						cancelled: true,
					},
					null,
					2,
				),
			);
			return;
		}
		log.info("Backup prune cancelled.");
		return;
	}

	const result = await withProcessLock("destructive-backups", async () => {
		return pruneDestructiveOperationBackups({
			all: options.all,
			backupIds: backupId ? [backupId] : undefined,
			keepCount: backupId || options.all ? undefined : parseKeepCount(options.keep),
		});
	});

	if (options.json) {
		console.log(
			JSON.stringify(
				{
					ok: true,
					...result,
				},
				null,
				2,
			),
		);
		return;
	}

	if (result.deletedIds.length === 0) {
		log.info("No recovery backups were deleted.");
		return;
	}

	log.info(
		`Deleted ${result.deletedIds.length} recovery backup(s): ${result.deletedIds.join(", ")}`,
	);
}
