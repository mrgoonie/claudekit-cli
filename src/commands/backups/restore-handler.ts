import { getDestructiveOperationBackupDir } from "@/services/file-operations/destructive-operation-backup-manager.js";
import {
	loadDestructiveOperationBackup,
	restoreDestructiveOperationBackup,
} from "@/services/file-operations/destructive-operation-backup.js";
import { acquireInstallationStateLock } from "@/services/file-operations/installation-state-lock.js";
import { withProcessLock } from "@/shared/process-lock.js";
import { confirm, isCancel, log } from "@/shared/safe-prompts.js";
import type { BackupsRestoreOptions } from "./types.js";

export async function handleBackupsRestore(
	backupId: string,
	options: BackupsRestoreOptions,
	deps?: { confirmFn?: typeof confirm },
): Promise<void> {
	const backupDir = await getDestructiveOperationBackupDir(backupId);
	const backup = await loadDestructiveOperationBackup(backupDir);

	const restored = await withProcessLock("kit-install", async () => {
		const confirmFn = deps?.confirmFn ?? confirm;
		const confirmed =
			options.yes === true
				? true
				: await confirmFn({
						message: `Restore backup ${backupId} to ${backup.manifest.sourceRoot}?`,
						initialValue: false,
					});

		if (isCancel(confirmed) || confirmed !== true) {
			if (!options.json) {
				log.info("Backup restore cancelled.");
			}
			return false;
		}

		const release = await acquireInstallationStateLock(backup.manifest.sourceRoot);

		try {
			await restoreDestructiveOperationBackup(backup);
		} finally {
			await release();
		}

		return true;
	});

	if (!restored) {
		if (options.json) {
			console.log(
				JSON.stringify(
					{
						ok: true,
						restored: false,
						cancelled: true,
						backupId,
					},
					null,
					2,
				),
			);
		}
		return;
	}

	if (options.json) {
		console.log(
			JSON.stringify(
				{
					ok: true,
					restored: true,
					backupId,
					sourceRoot: backup.manifest.sourceRoot,
					itemCount: backup.manifest.items.length,
				},
				null,
				2,
			),
		);
		return;
	}

	log.info(`Restored backup ${backupId} to ${backup.manifest.sourceRoot}`);
}
