import { join } from "node:path";
import { migrateToMultiKit } from "@/domains/migration/metadata-migration.js";
import { logger } from "@/shared/logger.js";
import type { KitMetadata, KitType, Metadata, TrackedFile } from "@/types";
import { MetadataSchema, USER_CONFIG_PATTERNS } from "@/types";
import { ensureFile, pathExists, readFile, writeFile } from "fs-extra";
import { lock } from "proper-lockfile";
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
		release = await lock(metadataPath, {
			retries: { retries: 5, minTimeout: 100, maxTimeout: 1000 },
			stale: 60000, // Consider lock stale after 60 seconds (allows for slow I/O and migrations)
		});
		logger.debug(`Acquired lock on ${metadataPath}`);

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

		// Build multi-kit metadata structure (file tracking in kits[kit].files only - no duplication)
		const metadata: Metadata = {
			kits: {
				...(existingMetadata.kits || {}), // Explicit fallback for legacy installs without kits
				[kit]: kitMetadata,
			},
			scope,
			// Legacy fields preserved for `ck version` display and backward compatibility
			// These are NOT used for file tracking - only kits[kit].files is authoritative
			name: kitName,
			version,
			installedAt,
			userConfigFiles: [...USER_CONFIG_PATTERNS, ...userConfigFiles],
			// NOTE: files and installedFiles removed - use kits[kit].files instead (DRY)
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
export async function removeKitFromManifest(claudeDir: string, kit: KitType): Promise<boolean> {
	const metadataPath = join(claudeDir, "metadata.json");

	if (!(await pathExists(metadataPath))) return false;

	// Acquire exclusive lock
	let release: (() => Promise<void>) | null = null;
	try {
		release = await lock(metadataPath, {
			retries: { retries: 5, minTimeout: 100, maxTimeout: 1000 },
			stale: 60000, // Consider lock stale after 60 seconds (consistent with writeManifest)
		});
		logger.debug(`Acquired lock on ${metadataPath} for kit removal`);

		// Read current metadata inside lock
		const metadata = await readManifest(claudeDir);
		if (!metadata?.kits?.[kit]) return false;

		// Remove kit from kits object
		const { [kit]: _removed, ...remainingKits } = metadata.kits;

		// If no kits remaining, delete metadata.json
		if (Object.keys(remainingKits).length === 0) {
			logger.debug("No kits remaining, metadata.json will be cleaned up");
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
