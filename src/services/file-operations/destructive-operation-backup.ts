import { mkdir, readdir, readlink, rename, symlink } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, normalize, resolve, sep } from "node:path";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
import type { KitType } from "@/types";
import { copy, lstat, pathExists, readJson, realpath, remove, writeJson } from "fs-extra";
import { z } from "zod";

type DestructiveOperationMode = "delete" | "mutate";
type DestructiveOperationKind = "file" | "directory" | "symlink";
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

interface RestorePlan {
	sourceExists: boolean;
	sourcePath: string;
	snapshotPath: string;
	restoreTempPath: string;
	currentTempPath: string;
}

const SNAPSHOT_DIR = "snapshot";
const MANIFEST_FILE = "manifest.json";

function normalizeRelativePath(rootDir: string, inputPath: string): string {
	if (!inputPath || isAbsolute(inputPath)) {
		throw new Error(`Unsafe backup path: ${inputPath}`);
	}

	const normalized = normalize(inputPath).replaceAll("\\", "/");
	const resolvedRoot = resolve(rootDir);
	const resolvedPath = resolve(rootDir, normalized);

	if (
		normalized === ".." ||
		normalized.startsWith("../") ||
		(!resolvedPath.startsWith(`${resolvedRoot}${sep}`) && resolvedPath !== resolvedRoot)
	) {
		throw new Error(`Path escapes installation root: ${inputPath}`);
	}

	return normalized;
}

function getManagedBackupRoot(): string {
	return resolve(PathResolver.getConfigDir(false), "backups");
}

async function getExistingRealpath(pathToResolve: string): Promise<string> {
	if (await pathExists(pathToResolve)) {
		return resolve(await realpath(pathToResolve));
	}

	return resolve(pathToResolve);
}

async function assertManagedBackupDir(backupDir: string): Promise<string> {
	const resolvedBackupDir = await getExistingRealpath(backupDir);
	const managedBackupRoot = await getExistingRealpath(getManagedBackupRoot());

	if (
		!resolvedBackupDir.startsWith(`${managedBackupRoot}${sep}`) &&
		resolvedBackupDir !== managedBackupRoot
	) {
		throw new Error(`Backup directory is outside ClaudeKit-managed storage: ${backupDir}`);
	}

	return resolvedBackupDir;
}

const destructiveOperationBackupItemSchema = z.object({
	path: z.string().min(1),
	mode: z.enum(["delete", "mutate"]),
	kind: z.enum(["file", "directory", "symlink"]),
	snapshotPath: z.string().min(1),
});

const destructiveOperationBackupManifestSchema = z.object({
	version: z.literal(1),
	operation: z.enum(["fresh-install", "uninstall"]),
	createdAt: z.string().datetime(),
	sourceRoot: z.string().min(1),
	scope: z.string().optional(),
	kit: z.enum(["engineer", "marketing"]).optional(),
	items: z.array(destructiveOperationBackupItemSchema),
	restoreNotes: z.array(z.string()),
});

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
		const realTargetPath = resolve(await realpath(sourcePath));
		const resolvedSourceRoot = await getExistingRealpath(sourceRoot);
		if (
			!realTargetPath.startsWith(`${resolvedSourceRoot}${sep}`) &&
			realTargetPath !== resolvedSourceRoot
		) {
			throw new Error(`Symlink target escapes installation root: ${target.path}`);
		}

		const snapshotPath = join(SNAPSHOT_DIR, target.path);
		const snapshotFullPath = join(backupDir, snapshotPath);
		const linkTarget = await readlink(sourcePath);

		await mkdir(dirname(snapshotFullPath), { recursive: true });
		await symlink(linkTarget, snapshotFullPath);

		return {
			path: target.path,
			mode: target.mode,
			kind: "symlink",
			snapshotPath,
		};
	}

	const kind: DestructiveOperationKind = stats.isDirectory() ? "directory" : "file";
	const snapshotPath = join(SNAPSHOT_DIR, target.path);
	const snapshotFullPath = join(backupDir, snapshotPath);

	await mkdir(dirname(snapshotFullPath), { recursive: true });
	if (kind === "directory") {
		await copyDirectorySnapshot(sourcePath, snapshotFullPath, sourceRoot);
	} else {
		await copy(sourcePath, snapshotFullPath, { overwrite: true });
	}

	return {
		path: target.path,
		mode: target.mode,
		kind,
		snapshotPath,
	};
}

async function copyDirectorySnapshot(
	sourceDir: string,
	destDir: string,
	rootDir: string,
): Promise<void> {
	await mkdir(destDir, { recursive: true });
	const entries = await readdir(sourceDir, { withFileTypes: true });

	for (const entry of entries) {
		const sourceEntry = join(sourceDir, entry.name);
		const destEntry = join(destDir, entry.name);

		if (entry.isSymbolicLink()) {
			const realTargetPath = resolve(await realpath(sourceEntry));
			const resolvedRoot = await getExistingRealpath(rootDir);
			if (!realTargetPath.startsWith(`${resolvedRoot}${sep}`) && realTargetPath !== resolvedRoot) {
				throw new Error(`Nested symlink target escapes installation root: ${sourceEntry}`);
			}

			await symlink(await readlink(sourceEntry), destEntry);
			continue;
		}

		if (entry.isDirectory()) {
			await copyDirectorySnapshot(sourceEntry, destEntry, rootDir);
			continue;
		}

		if (entry.isFile()) {
			await copy(sourceEntry, destEntry, { overwrite: true });
		}
	}
}

function buildRestoreTempPath(sourcePath: string, suffix: "current" | "restore"): string {
	const random = Math.random().toString(36).slice(2, 8);
	return join(dirname(sourcePath), `.ck-${suffix}-${basename(sourcePath)}-${Date.now()}-${random}`);
}

async function assertSafeRestoreDestination(targetPath: string, rootDir: string): Promise<void> {
	const resolvedRoot = await getExistingRealpath(rootDir);
	const lexicalRoot = resolve(rootDir);
	let currentPath = dirname(targetPath);

	while (true) {
		const resolvedCurrent = resolve(currentPath);
		if (!resolvedCurrent.startsWith(`${lexicalRoot}${sep}`) && resolvedCurrent !== lexicalRoot) {
			throw new Error(`Restore target escapes installation root: ${targetPath}`);
		}

		if (await pathExists(currentPath)) {
			const stats = await lstat(currentPath);
			if (stats.isSymbolicLink()) {
				throw new Error(`Restore target uses a symlinked parent directory: ${currentPath}`);
			}

			const resolvedCurrentReal = await getExistingRealpath(currentPath);
			if (
				!resolvedCurrentReal.startsWith(`${resolvedRoot}${sep}`) &&
				resolvedCurrentReal !== resolvedRoot
			) {
				throw new Error(`Restore target escapes installation root: ${targetPath}`);
			}
		}

		if (resolvedCurrent === lexicalRoot) {
			return;
		}

		currentPath = dirname(currentPath);
	}
}

async function copySnapshotDirectoryForRestore(
	snapshotDir: string,
	destDir: string,
	rootDir: string,
): Promise<void> {
	await mkdir(destDir, { recursive: true });
	const entries = await readdir(snapshotDir, { withFileTypes: true });

	for (const entry of entries) {
		const sourceEntry = join(snapshotDir, entry.name);
		const destEntry = join(destDir, entry.name);

		if (entry.isSymbolicLink()) {
			const linkTarget = await readlink(sourceEntry);
			const resolvedTarget = resolve(dirname(destEntry), linkTarget);
			const lexicalRoot = resolve(rootDir);
			if (!resolvedTarget.startsWith(`${lexicalRoot}${sep}`) && resolvedTarget !== lexicalRoot) {
				throw new Error(`Nested restore symlink escapes installation root: ${destEntry}`);
			}

			await symlink(linkTarget, destEntry);
			continue;
		}

		if (entry.isDirectory()) {
			await copySnapshotDirectoryForRestore(sourceEntry, destEntry, rootDir);
			continue;
		}

		if (entry.isFile()) {
			await copy(sourceEntry, destEntry, { overwrite: true });
		}
	}
}

async function stageRestorePlan(plan: RestorePlan, rootDir: string): Promise<void> {
	await mkdir(dirname(plan.restoreTempPath), { recursive: true });
	const snapshotStats = await lstat(plan.snapshotPath);
	if (snapshotStats.isSymbolicLink()) {
		await symlink(await readlink(plan.snapshotPath), plan.restoreTempPath);
		return;
	}
	if (snapshotStats.isDirectory()) {
		await copySnapshotDirectoryForRestore(plan.snapshotPath, plan.restoreTempPath, rootDir);
		return;
	}

	await copy(plan.snapshotPath, plan.restoreTempPath, { overwrite: true });
}

async function applyRestorePlan(plan: RestorePlan): Promise<void> {
	if (plan.sourceExists) {
		await rename(plan.sourcePath, plan.currentTempPath);
	}

	await rename(plan.restoreTempPath, plan.sourcePath);
}

async function rollbackAppliedRestorePlans(plans: RestorePlan[]): Promise<void> {
	for (const plan of [...plans].reverse()) {
		if (plan.sourceExists) {
			const currentTempExists = await pathExists(plan.currentTempPath);
			if (currentTempExists && (await pathExists(plan.sourcePath))) {
				await remove(plan.sourcePath).catch(() => {});
			}

			if (currentTempExists) {
				await rename(plan.currentTempPath, plan.sourcePath);
			}
			continue;
		}

		if (await pathExists(plan.sourcePath)) {
			await remove(plan.sourcePath).catch(() => {});
		}
	}
}

async function cleanupRestorePlanTemps(plans: RestorePlan[]): Promise<void> {
	for (const plan of plans) {
		await remove(plan.restoreTempPath).catch(() => {});
		await remove(plan.currentTempPath).catch(() => {});
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
	const resolvedBackupDir = await assertManagedBackupDir(backupDir);
	const manifestPath = join(resolvedBackupDir, MANIFEST_FILE);
	const manifest = destructiveOperationBackupManifestSchema.parse(await readJson(manifestPath));

	if (!isAbsolute(manifest.sourceRoot)) {
		throw new Error(`Backup manifest source root must be absolute: ${manifest.sourceRoot}`);
	}
	const resolvedSourceRoot = resolve(manifest.sourceRoot);

	for (const item of manifest.items) {
		normalizeRelativePath(resolvedSourceRoot, item.path);
		const normalizedSnapshotPath = normalizeRelativePath(resolvedBackupDir, item.snapshotPath);
		if (
			normalizedSnapshotPath !== SNAPSHOT_DIR &&
			!normalizedSnapshotPath.startsWith(`${SNAPSHOT_DIR}/`)
		) {
			throw new Error(
				`Backup manifest snapshot path is outside the snapshot payload: ${item.snapshotPath}`,
			);
		}
	}

	return {
		backupDir: resolvedBackupDir,
		manifestPath,
		manifest: {
			...manifest,
			sourceRoot: resolvedSourceRoot,
		},
	};
}

export async function restoreDestructiveOperationBackup(
	backup: DestructiveOperationBackup,
): Promise<void> {
	const restorePlans: RestorePlan[] = [];

	for (const item of backup.manifest.items) {
		const sourcePath = resolve(
			backup.manifest.sourceRoot,
			normalizeRelativePath(backup.manifest.sourceRoot, item.path),
		);
		const snapshotPath = resolve(
			backup.backupDir,
			normalizeRelativePath(backup.backupDir, item.snapshotPath),
		);

		try {
			await lstat(snapshotPath);
		} catch {
			throw new Error(`Backup snapshot is missing for ${item.path}`);
		}

		await assertSafeRestoreDestination(sourcePath, backup.manifest.sourceRoot);
		restorePlans.push({
			sourceExists: await pathExists(sourcePath),
			sourcePath,
			snapshotPath,
			restoreTempPath: buildRestoreTempPath(sourcePath, "restore"),
			currentTempPath: buildRestoreTempPath(sourcePath, "current"),
		});
	}

	try {
		const appliedPlans: RestorePlan[] = [];
		let currentPlan: RestorePlan | null = null;
		try {
			for (const plan of restorePlans) {
				currentPlan = plan;
				await stageRestorePlan(plan, backup.manifest.sourceRoot);
				await applyRestorePlan(plan);
				appliedPlans.push(plan);
				currentPlan = null;
			}
		} catch (error) {
			await rollbackAppliedRestorePlans(
				currentPlan ? [...appliedPlans, currentPlan] : appliedPlans,
			);
			throw new Error(
				`Failed to restore backup payload: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	} finally {
		await cleanupRestorePlanTemps(restorePlans);
	}

	logger.debug(`Restored destructive backup from: ${backup.backupDir}`);
}
