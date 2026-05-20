import { join } from "node:path";
import { migrateToMultiKit } from "@/domains/migration/metadata-migration.js";
import { acquireInstallationStateLock } from "@/services/file-operations/installation-state-lock.js";
import { logger } from "@/shared/logger.js";
import type { KitMetadata, KitType, Metadata, TrackedFile } from "@/types";
import { MetadataSchema, USER_CONFIG_PATTERNS } from "@/types";
import { ensureFile, pathExists, readFile, remove, writeFile } from "fs-extra";
import { readManifest } from "./manifest-reader.js";

/**
 * Write or update metadata.json with installation manifest (multi-kit aware)
 * Uses file locking to prevent race conditions during concurrent kit installations.
 * @param claudeDir - Path to .claude directory
 * @param kitName - Name of the kit being installed
 * @param version - Version being installed
 * @param scope - Installation scope (local or global)
 * @param kitType - Kit type identifier (engineer, marketing)
 * @param trackedFiles - Array of tracked files to write
 * @param userConfigFiles - Array of user config file patterns
 */
export async function writeManifest(
	claudeDir: string,
	kitName: string,
	version: string,
	scope: "local" | "global",
	kitType: KitType | undefined,
	trackedFiles: TrackedFile[],
	userConfigFiles: string[],
): Promise<void> {
	const metadataPath = join(claudeDir, "metadata.json");

	// Determine kit type from name if not provided (use word boundaries to avoid false matches)
	const kit: KitType = kitType || (/\bmarketing\b/i.test(kitName) ? "marketing" : "engineer");

	// Ensure file exists for locking (proper-lockfile requires existing file)
	await ensureFile(metadataPath);

	// Acquire exclusive lock to prevent concurrent modification
	let release: (() => Promise<void>) | null = null;
	try {
		release = await acquireInstallationStateLock(claudeDir);

		// Migrate legacy metadata if needed (inside lock)
		const migrationResult = await migrateToMultiKit(claudeDir);
		if (!migrationResult.success) {
			logger.warning(`Metadata migration warning: ${migrationResult.error}`);
		}

		// Read existing metadata (now guaranteed multi-kit format after migration)
		let existingMetadata: Partial<Metadata> = { kits: {} };
		if (await pathExists(metadataPath)) {
			try {
				const content = await readFile(metadataPath, "utf-8");
				const parsed = JSON.parse(content);
				// Only use if it's a valid object (not empty from ensureFile)
				if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
					existingMetadata = parsed;
				}
			} catch (error) {
				logger.debug(`Could not read existing metadata: ${error}`);
			}
		}

		// Build kit-specific metadata
		const installedAt = new Date().toISOString();
		const kitMetadata: KitMetadata = {
			version,
			installedAt,
			files: trackedFiles.length > 0 ? trackedFiles : undefined,
		};

		// Detect multi-kit scenario: are there OTHER kits besides the one being installed?
		// - If installing "marketing" and "engineer" already exists → otherKitsExist = true
		// - If re-installing "engineer" and only "engineer" exists → otherKitsExist = false
		const existingKits = existingMetadata.kits || {};
		const otherKitsExist = Object.keys(existingKits).some((k) => k !== kit);

		// Build metadata with multi-kit structure
		// - kits[kit].files: per-kit file tracking (canonical source)
		// - Root name/version/installedAt: DEPRECATED legacy fields for backward compat
		//   → Single kit: overwrite with current kit values
		//   → Multi-kit: preserve first kit's values (never overwrite after second kit added)
		const metadata: Metadata = {
			kits: {
				...existingKits,
				[kit]: kitMetadata,
			},
			scope,
			// Legacy fields preserved for tools that read root-level metadata
			// Use metadata.kits[kit].version for accurate per-kit version info
			name: otherKitsExist ? (existingMetadata.name ?? kitName) : kitName,
			version: otherKitsExist ? (existingMetadata.version ?? version) : version,
			installedAt: otherKitsExist ? (existingMetadata.installedAt ?? installedAt) : installedAt,
			userConfigFiles: [...USER_CONFIG_PATTERNS, ...userConfigFiles],
		};

		// Validate schema
		const validated = MetadataSchema.parse(metadata);

		// Write to file (still inside lock)
		await writeFile(metadataPath, JSON.stringify(validated, null, 2), "utf-8");
		logger.debug(`Wrote manifest for kit "${kit}" with ${trackedFiles.length} tracked files`);
	} finally {
		// Always release lock
		if (release) {
			await release();
			logger.debug(`Released lock on ${metadataPath}`);
		}
	}
}

/**
 * Remove a kit from metadata.json (for kit-scoped uninstall)
 * Uses file locking to prevent race conditions.
 * @param claudeDir - Path to .claude directory
 * @param kit - Kit to remove
 * @returns true if kit was removed, false if not found
 */
export async function removeKitFromManifest(
	claudeDir: string,
	kit: KitType,
	options?: { lockHeld?: boolean },
): Promise<boolean> {
	const metadataPath = join(claudeDir, "metadata.json");

	if (!(await pathExists(metadataPath))) return false;

	// Acquire exclusive lock
	let release: (() => Promise<void>) | null = null;
	try {
		if (!options?.lockHeld) {
			release = await acquireInstallationStateLock(claudeDir);
		}

		// Read current metadata inside lock
		const metadata = await readManifest(claudeDir);
		if (!metadata?.kits?.[kit]) return false;

		// Remove kit from kits object
		const { [kit]: _removed, ...remainingKits } = metadata.kits;

		// If no kits remain, remove metadata.json inside the lock.
		if (Object.keys(remainingKits).length === 0) {
			await remove(metadataPath);
			logger.debug("No kits remaining, removed metadata.json");
			return true;
		}

		// Update metadata with remaining kits
		const updated: Metadata = {
			...metadata,
			kits: remainingKits,
		};

		await writeFile(metadataPath, JSON.stringify(updated, null, 2), "utf-8");
		logger.debug(
			`Removed kit "${kit}" from metadata, ${Object.keys(remainingKits).length} kit(s) remaining`,
		);

		return true;
	} finally {
		if (release) {
			await release();
			logger.debug(`Released lock on ${metadataPath}`);
		}
	}
}

/**
 * Rewrite metadata.json so it only retains a subset of tracked files.
 * Used after partial uninstalls that preserve protected tracked files or other kits.
 */
export async function retainTrackedFilesInManifest(
	claudeDir: string,
	retainedPaths: string[],
	options?: { excludeKit?: KitType; lockHeld?: boolean },
): Promise<boolean> {
	const metadataPath = join(claudeDir, "metadata.json");

	if (!(await pathExists(metadataPath))) return false;

	const normalizedPaths = new Set(retainedPaths.map((path) => path.replace(/\\/g, "/")));
	if (normalizedPaths.size === 0) return false;

	let release: (() => Promise<void>) | null = null;
	try {
		if (!options?.lockHeld) {
			release = await acquireInstallationStateLock(claudeDir);
		}

		const metadata = await readManifest(claudeDir);
		if (!metadata) return false;

		if (metadata.kits) {
			const retainedKits = Object.entries(metadata.kits).reduce<NonNullable<Metadata["kits"]>>(
				(acc, [kitName, kitMeta]) => {
					if (kitName === options?.excludeKit) {
						return acc;
					}

					const keptFiles = (kitMeta.files || []).flatMap((file) => {
						const normalizedPath = file.path.replace(/\\/g, "/");
						if (!normalizedPaths.has(normalizedPath)) {
							return [];
						}

						return [
							{
								...file,
								path: normalizedPath,
							},
						];
					});

					if (keptFiles.length > 0) {
						acc[kitName as KitType] = {
							...kitMeta,
							files: keptFiles,
						};
					}

					return acc;
				},
				{},
			);

			if (Object.keys(retainedKits).length === 0) {
				return false;
			}

			const retainedFiles = Object.values(retainedKits).flatMap((kitMeta) => kitMeta.files || []);
			const retainedInstalledFiles = retainedFiles.map((file) => file.path);
			const updated = MetadataSchema.parse({
				...metadata,
				kits: retainedKits,
				files: retainedFiles.length > 0 ? retainedFiles : undefined,
				installedFiles: retainedInstalledFiles.length > 0 ? retainedInstalledFiles : undefined,
			});
			await writeFile(metadataPath, JSON.stringify(updated, null, 2), "utf-8");
			return true;
		}

		const retainedFiles = (metadata.files || []).flatMap((file) => {
			const normalizedPath = file.path.replace(/\\/g, "/");
			if (!normalizedPaths.has(normalizedPath)) {
				return [];
			}

			return [
				{
					...file,
					path: normalizedPath,
				},
			];
		});
		const retainedInstalledFiles = (metadata.installedFiles || []).filter((path) =>
			normalizedPaths.has(path.replace(/\\/g, "/")),
		);

		if (retainedFiles.length === 0 && retainedInstalledFiles.length === 0) {
			return false;
		}

		const updated = MetadataSchema.parse({
			...metadata,
			files: retainedFiles.length > 0 ? retainedFiles : undefined,
			installedFiles: retainedInstalledFiles.length > 0 ? retainedInstalledFiles : undefined,
		});
		await writeFile(metadataPath, JSON.stringify(updated, null, 2), "utf-8");
		return true;
	} finally {
		if (release) {
			await release();
			logger.debug(`Released lock on ${metadataPath}`);
		}
	}
}
