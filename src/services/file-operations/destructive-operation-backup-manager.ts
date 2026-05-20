import { readdir, stat } from "node:fs/promises";
import { basename, join, resolve, sep } from "node:path";
import {
	type DestructiveOperationBackupManifest,
	loadDestructiveOperationBackup,
} from "@/services/file-operations/destructive-operation-backup.js";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
import type { KitType } from "@/types";
import { pathExists, remove } from "fs-extra";

export const DEFAULT_DESTRUCTIVE_BACKUP_KEEP_COUNT = 10;

export interface DestructiveOperationBackupSummary {
	id: string;
	path: string;
	sizeBytes: number;
	valid: boolean;
	createdAt?: string;
	operation?: DestructiveOperationBackupManifest["operation"];
	sourceRoot?: string;
	scope?: string;
	kit?: KitType;
	itemCount?: number;
	error?: string;
}

export interface DestructiveOperationBackupPruneResult {
	deletedIds: string[];
	keptIds: string[];
}

function getBackupsRoot(): string {
	return resolve(PathResolver.getConfigDir(false), "backups");
}

function validateBackupId(backupId: string): void {
	if (!backupId || !/^[A-Za-z0-9._:-]+$/.test(backupId) || backupId.includes("..")) {
		throw new Error(`Invalid backup id: ${backupId}`);
	}
}

function resolveBackupDir(backupId: string): string {
	validateBackupId(backupId);
	const backupsRoot = getBackupsRoot();
	const backupDir = resolve(backupsRoot, backupId);
	if (!backupDir.startsWith(`${backupsRoot}${sep}`) && backupDir !== backupsRoot) {
		throw new Error(`Backup id escapes backup root: ${backupId}`);
	}
	return backupDir;
}

async function getDirectorySize(dirPath: string): Promise<number> {
	let size = 0;
	const entries = await readdir(dirPath, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = join(dirPath, entry.name);
		if (entry.isSymbolicLink()) {
			continue;
		}

		if (entry.isDirectory()) {
			size += await getDirectorySize(fullPath);
			continue;
		}

		if (entry.isFile()) {
			size += (await stat(fullPath)).size;
		}
	}

	return size;
}

async function listBackupDirs(): Promise<string[]> {
	const backupsRoot = getBackupsRoot();
	if (!(await pathExists(backupsRoot))) {
		return [];
	}

	const entries = await readdir(backupsRoot, { withFileTypes: true });
	return entries
		.filter((entry) => entry.isDirectory())
		.map((entry) => join(backupsRoot, entry.name))
		.sort((left, right) => basename(right).localeCompare(basename(left)));
}

function sortBackupSummaries(
	left: DestructiveOperationBackupSummary,
	right: DestructiveOperationBackupSummary,
): number {
	if (left.valid && right.valid) {
		return (right.createdAt ?? "").localeCompare(left.createdAt ?? "");
	}
	if (left.valid) return -1;
	if (right.valid) return 1;
	return right.id.localeCompare(left.id);
}

async function summarizeBackup(backupDir: string): Promise<DestructiveOperationBackupSummary> {
	const id = basename(backupDir);
	const sizeBytes = await getDirectorySize(backupDir).catch(() => 0);

	try {
		const backup = await loadDestructiveOperationBackup(backupDir);
		return {
			id,
			path: backup.backupDir,
			sizeBytes,
			valid: true,
			createdAt: backup.manifest.createdAt,
			operation: backup.manifest.operation,
			sourceRoot: backup.manifest.sourceRoot,
			scope: backup.manifest.scope,
			kit: backup.manifest.kit,
			itemCount: backup.manifest.items.length,
		};
	} catch (error) {
		return {
			id,
			path: backupDir,
			sizeBytes,
			valid: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

export async function listDestructiveOperationBackups(
	limit?: number,
): Promise<DestructiveOperationBackupSummary[]> {
	const backupDirs = await listBackupDirs();
	const summaries: DestructiveOperationBackupSummary[] = [];

	for (const backupDir of backupDirs) {
		summaries.push(await summarizeBackup(backupDir));
	}

	summaries.sort(sortBackupSummaries);
	return limit ? summaries.slice(0, limit) : summaries;
}

export async function getDestructiveOperationBackupSummary(
	backupId: string,
): Promise<DestructiveOperationBackupSummary> {
	const backupDir = resolveBackupDir(backupId);
	if (!(await pathExists(backupDir))) {
		throw new Error(`Backup not found: ${backupId}`);
	}
	return summarizeBackup(backupDir);
}

export async function getDestructiveOperationBackupDir(backupId: string): Promise<string> {
	const backupDir = resolveBackupDir(backupId);
	if (!(await pathExists(backupDir))) {
		throw new Error(`Backup not found: ${backupId}`);
	}
	return backupDir;
}

export async function deleteDestructiveOperationBackup(backupId: string): Promise<void> {
	const backupDir = await getDestructiveOperationBackupDir(backupId);
	await remove(backupDir);
}

export async function pruneDestructiveOperationBackups(options?: {
	all?: boolean;
	backupIds?: string[];
	keepCount?: number;
	excludeIds?: string[];
}): Promise<DestructiveOperationBackupPruneResult> {
	const backupDirs = await listBackupDirs();
	const exclude = new Set(options?.excludeIds ?? []);
	const deletedIds: string[] = [];
	const keptIds: string[] = [];

	let targets: string[];
	if (options?.all) {
		targets = backupDirs.filter((backupDir) => !exclude.has(basename(backupDir)));
	} else if (options?.backupIds?.length) {
		targets = options.backupIds.map(resolveBackupDir);
	} else {
		const keepCount = Math.max(options?.keepCount ?? DEFAULT_DESTRUCTIVE_BACKUP_KEEP_COUNT, 0);
		const summaries = await listDestructiveOperationBackups();
		const keepIds = new Set(
			summaries
				.filter((summary) => summary.valid && !exclude.has(summary.id))
				.slice(0, keepCount)
				.map((summary) => summary.id),
		);
		targets = summaries
			.filter((summary) => !exclude.has(summary.id) && !keepIds.has(summary.id))
			.map((summary) => summary.path);
		keptIds.push(...[...keepIds]);
	}

	for (const backupDir of targets) {
		const backupId = basename(backupDir);
		if (!(await pathExists(backupDir))) {
			continue;
		}

		await remove(backupDir);
		deletedIds.push(backupId);
	}

	if (!options?.all && !options?.backupIds?.length) {
		const deleted = new Set(deletedIds);
		for (const backupDir of backupDirs) {
			const backupId = basename(backupDir);
			if (!deleted.has(backupId) && !keptIds.includes(backupId)) {
				keptIds.push(backupId);
			}
		}
	}

	return { deletedIds, keptIds };
}

export async function cleanupOldDestructiveOperationBackups(
	keepCount = DEFAULT_DESTRUCTIVE_BACKUP_KEEP_COUNT,
	currentBackupId?: string,
): Promise<void> {
	try {
		await pruneDestructiveOperationBackups({
			keepCount: currentBackupId ? Math.max(keepCount - 1, 0) : keepCount,
			excludeIds: currentBackupId ? [currentBackupId] : [],
		});
	} catch (error) {
		logger.warning(
			`Failed to prune old destructive backups: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}
