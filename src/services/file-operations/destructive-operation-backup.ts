import { mkdir, rename } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, normalize, resolve, sep } from "node:path";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
import type { KitType } from "@/types";
import { copy, lstat, pathExists, readJson, remove, writeJson } from "fs-extra";

type DestructiveOperationMode = "delete" | "mutate";
type DestructiveOperationKind = "file" | "directory";
type DestructiveOperationType = "fresh-install" | "uninstall";

export interface DestructiveOperationBackupRequest {
	operation: DestructiveOperationType;
	sourceRoot: string;
	deletePaths: string[];
	mutatePaths?: string[];
	scope?: string;
	kit?: KitType;
}

export interface DestructiveOperationBackupItem {
	path: string;
	mode: DestructiveOperationMode;
	kind: DestructiveOperationKind;
	snapshotPath: string;
}

export interface DestructiveOperationBackupManifest {
	version: 1;
	operation: DestructiveOperationType;
	createdAt: string;
	sourceRoot: string;
	scope?: string;
	kit?: KitType;
	items: DestructiveOperationBackupItem[];
	restoreNotes: string[];
}

export interface DestructiveOperationBackup {
	backupDir: string;
	manifestPath: string;
	manifest: DestructiveOperationBackupManifest;
}

const SNAPSHOT_DIR = "snapshot";
const MANIFEST_FILE = "manifest.json";

function normalizeRelativePath(sourceRoot: string, inputPath: string): string {
	if (!inputPath || isAbsolute(inputPath)) {
		throw new Error(`Unsafe backup path: ${inputPath}`);
	}

	const normalized = normalize(inputPath).replaceAll("\\", "/");
	const resolvedRoot = resolve(sourceRoot);
	const resolvedPath = resolve(sourceRoot, normalized);

	if (
		normalized === ".." ||
		normalized.startsWith("../") ||
		(!resolvedPath.startsWith(`${resolvedRoot}${sep}`) && resolvedPath !== resolvedRoot)
	) {
		throw new Error(`Path escapes installation root: ${inputPath}`);
	}

	return normalized;
}

function buildTargets(
	sourceRoot: string,
	deletePaths: string[],
	mutatePaths: string[],
): Array<{ path: string; mode: DestructiveOperationMode }> {
	const targetModes = new Map<string, DestructiveOperationMode>();

	for (const path of mutatePaths) {
		targetModes.set(normalizeRelativePath(sourceRoot, path), "mutate");
	}

	for (const path of deletePaths) {
		targetModes.set(normalizeRelativePath(sourceRoot, path), "delete");
	}

	const sortedTargets = [...targetModes.entries()]
		.map(([path, mode]) => ({ path, mode }))
		.sort((left, right) => {
			const depth = left.path.split("/").length - right.path.split("/").length;
			return depth === 0 ? left.path.localeCompare(right.path) : depth;
		});

	return sortedTargets.filter((target, index, targets) => {
		return !targets.slice(0, index).some((parent) => {
			return parent.path === target.path || target.path.startsWith(`${parent.path}/`);
		});
	});
}

async function snapshotItem(
	sourceRoot: string,
	backupDir: string,
	target: { path: string; mode: DestructiveOperationMode },
): Promise<DestructiveOperationBackupItem | null> {
	const sourcePath = resolve(sourceRoot, target.path);
	if (!(await pathExists(sourcePath))) {
		return null;
	}

	const stats = await lstat(sourcePath);
	if (stats.isSymbolicLink()) {
		throw new Error(`Symlink targets are not supported for destructive backups: ${target.path}`);
	}

	const kind: DestructiveOperationKind = stats.isDirectory() ? "directory" : "file";
	const snapshotPath = join(SNAPSHOT_DIR, target.path);
	const snapshotFullPath = join(backupDir, snapshotPath);

	await mkdir(dirname(snapshotFullPath), { recursive: true });
	await copy(sourcePath, snapshotFullPath, { overwrite: true });

	return {
		path: target.path,
		mode: target.mode,
		kind,
		snapshotPath,
	};
}

function buildRestoreTempPath(sourcePath: string, suffix: "current" | "restore"): string {
	const random = Math.random().toString(36).slice(2, 8);
	return join(dirname(sourcePath), `.ck-${suffix}-${basename(sourcePath)}-${Date.now()}-${random}`);
}

async function restoreSnapshotItemAtomically(
	sourcePath: string,
	snapshotPath: string,
): Promise<void> {
	const restoreTempPath = buildRestoreTempPath(sourcePath, "restore");
	const currentTempPath = buildRestoreTempPath(sourcePath, "current");
	const sourceExists = await pathExists(sourcePath);

	await mkdir(dirname(restoreTempPath), { recursive: true });
	await copy(snapshotPath, restoreTempPath, { overwrite: true });

	try {
		if (sourceExists) {
			await rename(sourcePath, currentTempPath);
		}

		await rename(restoreTempPath, sourcePath);
		await remove(currentTempPath).catch(() => {});
	} catch (error) {
		await remove(restoreTempPath).catch(() => {});

		if (sourceExists && (await pathExists(currentTempPath)) && !(await pathExists(sourcePath))) {
			await rename(currentTempPath, sourcePath).catch((restoreError) => {
				throw new Error(
					`Failed to roll back restore swap for ${sourcePath}: ${restoreError instanceof Error ? restoreError.message : "Unknown error"}`,
				);
			});
		}

		throw new Error(
			`Failed to restore ${sourcePath}: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	} finally {
		await remove(restoreTempPath).catch(() => {});
		await remove(currentTempPath).catch(() => {});
	}
}

export async function createDestructiveOperationBackup(
	request: DestructiveOperationBackupRequest,
): Promise<DestructiveOperationBackup> {
	const backupDir = PathResolver.getBackupDir();
	const manifestPath = join(backupDir, MANIFEST_FILE);
	const targets = buildTargets(request.sourceRoot, request.deletePaths, request.mutatePaths ?? []);

	try {
		await mkdir(join(backupDir, SNAPSHOT_DIR), { recursive: true });

		const items: DestructiveOperationBackupItem[] = [];
		for (const target of targets) {
			const snapshot = await snapshotItem(request.sourceRoot, backupDir, target);
			if (snapshot) {
				items.push(snapshot);
			}
		}

		const manifest: DestructiveOperationBackupManifest = {
			version: 1,
			operation: request.operation,
			createdAt: new Date().toISOString(),
			sourceRoot: resolve(request.sourceRoot),
			scope: request.scope,
			kit: request.kit,
			items,
			restoreNotes: [
				"Backup was created before ClaudeKit performed a destructive operation.",
				"Restore the snapshot paths back into sourceRoot to recover the previous state.",
			],
		};

		await writeJson(manifestPath, manifest, { spaces: 2 });
		logger.debug(`Created destructive backup at: ${backupDir}`);

		return { backupDir, manifestPath, manifest };
	} catch (error) {
		await remove(backupDir).catch(() => {});
		throw new Error(
			`Failed to create destructive backup: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}

export async function loadDestructiveOperationBackup(
	backupDir: string,
): Promise<DestructiveOperationBackup> {
	const manifestPath = join(backupDir, MANIFEST_FILE);
	const manifest = await readJson(manifestPath);
	return {
		backupDir,
		manifestPath,
		manifest: manifest as DestructiveOperationBackupManifest,
	};
}

export async function restoreDestructiveOperationBackup(
	backup: DestructiveOperationBackup,
): Promise<void> {
	for (const item of backup.manifest.items) {
		const sourcePath = resolve(
			backup.manifest.sourceRoot,
			normalizeRelativePath(backup.manifest.sourceRoot, item.path),
		);
		const snapshotPath = join(backup.backupDir, item.snapshotPath);

		if (!(await pathExists(snapshotPath))) {
			throw new Error(`Backup snapshot is missing for ${item.path}`);
		}

		await restoreSnapshotItemAtomically(sourcePath, snapshotPath);
	}

	logger.debug(`Restored destructive backup from: ${backup.backupDir}`);
}
