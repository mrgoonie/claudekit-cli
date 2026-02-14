/**
 * Portable registry — unified tracking of installed agents, commands, and skills
 * Extends skill-registry.json to portable-registry.json with backward compatibility.
 * Central registry at ~/.claudekit/portable-registry.json
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import lockfile from "proper-lockfile";
import { z } from "zod";
import { logger } from "../../shared/logger.js";
import { computeFileChecksum } from "./checksum-utils.js";
import type { PortableType, ProviderType } from "./types.js";

const home = homedir();
const REGISTRY_PATH = join(home, ".claudekit", "portable-registry.json");
const REGISTRY_LOCK_PATH = join(home, ".claudekit", "portable-registry.lock");
const LEGACY_REGISTRY_PATH = join(home, ".claudekit", "skill-registry.json");

// Schema for v2.0 registry entries (with .passthrough() for forward compat)
const PortableInstallationSchema = z
	.object({
		item: z.string(), // Item name (agent, command, skill, config, or rules name)
		type: z.enum(["agent", "command", "skill", "config", "rules"]),
		provider: z.string(), // Provider type
		global: z.boolean(),
		path: z.string(),
		installedAt: z.string(), // ISO 8601
		sourcePath: z.string(),
		cliVersion: z.string().optional(),
	})
	.passthrough(); // Allow v3 fields to pass through for forward compat
export type PortableInstallation = z.infer<typeof PortableInstallationSchema>;

const PortableRegistrySchema = z
	.object({
		version: z.literal("2.0"),
		installations: z.array(PortableInstallationSchema),
	})
	.passthrough(); // Allow v3 fields to pass through
export type PortableRegistry = z.infer<typeof PortableRegistrySchema>;

// Schema for v3.0 registry entries (adds idempotency tracking)
const PortableInstallationSchemaV3 = z.object({
	item: z.string(),
	type: z.enum(["agent", "command", "skill", "config", "rules"]),
	provider: z.string(),
	global: z.boolean(),
	path: z.string(),
	installedAt: z.string(), // ISO 8601
	sourcePath: z.string(),
	cliVersion: z.string().optional(),
	// v3.0 fields for idempotency
	sourceChecksum: z.string(), // SHA-256 of source content after conversion
	targetChecksum: z.string(), // SHA-256 of target file content
	installSource: z.enum(["kit", "manual"]), // Origin of installation
	ownedSections: z.array(z.string()).optional(), // For merge targets: section names CK owns
});
export type PortableInstallationV3 = z.infer<typeof PortableInstallationSchemaV3>;

const PortableRegistrySchemaV3 = z.object({
	version: z.literal("3.0"),
	installations: z.array(PortableInstallationSchemaV3),
	lastReconciled: z.string().optional(), // ISO 8601 timestamp of last reconciliation
	appliedManifestVersion: z.string().optional(), // Last manifest version applied
});
export type PortableRegistryV3 = z.infer<typeof PortableRegistrySchemaV3>;

// Legacy schema for migration
const LegacyInstallationSchema = z.object({
	skill: z.string(),
	agent: z.string(),
	global: z.boolean(),
	path: z.string(),
	installedAt: z.string(),
	sourcePath: z.string(),
	cliVersion: z.string().optional(),
});

const LegacyRegistrySchema = z.object({
	version: z.literal("1.0"),
	installations: z.array(LegacyInstallationSchema),
});

/**
 * Get CLI version from package.json
 */
function getCliVersion(): string {
	try {
		if (process.env.npm_package_version) {
			return process.env.npm_package_version;
		}
		const { readFileSync } = require("node:fs");
		const { dirname: dn, join: jp } = require("node:path");
		const { fileURLToPath } = require("node:url");
		const __dirname = dn(fileURLToPath(import.meta.url));
		const pkgPath = jp(__dirname, "../../../package.json");
		const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
		return pkg.version || "unknown";
	} catch {
		return "unknown";
	}
}

/**
 * Migrate legacy skill-registry.json to portable-registry.json v2.0
 * Uses readFile directly to avoid TOCTOU race condition
 */
async function migrateLegacyRegistry(): Promise<PortableRegistry | null> {
	try {
		const content = await readFile(LEGACY_REGISTRY_PATH, "utf-8");
		const data = JSON.parse(content);
		const legacy = LegacyRegistrySchema.parse(data);

		// Convert legacy entries to new format
		const installations: PortableInstallation[] = legacy.installations.map((i) => ({
			item: i.skill,
			type: "skill" as const,
			provider: i.agent,
			global: i.global,
			path: i.path,
			installedAt: i.installedAt,
			sourcePath: i.sourcePath,
			cliVersion: i.cliVersion,
		}));

		return { version: "2.0", installations };
	} catch (error) {
		// ENOENT is expected if legacy registry doesn't exist
		if (error instanceof Error && "code" in error && error.code === "ENOENT") {
			return null;
		}
		logger.verbose(
			`Failed to migrate legacy registry: ${error instanceof Error ? error.message : "Unknown"}`,
		);
		return null;
	}
}

/**
 * Migrate v2.0 registry to v3.0 with idempotency tracking
 * Reads actual target files from disk to compute real targetChecksum
 * Includes file lock to prevent concurrent migration corruption
 */
async function migrateRegistryV2ToV3(v2Registry: PortableRegistry): Promise<PortableRegistryV3> {
	const v3Installations: PortableInstallationV3[] = [];

	for (const item of v2Registry.installations) {
		// Read target file from disk for real checksum (not "unknown")
		// Use Buffer-based checksum to handle binary files correctly
		let targetChecksum = "unknown";
		try {
			if (existsSync(item.path)) {
				targetChecksum = await computeFileChecksum(item.path);
			}
		} catch (error) {
			logger.verbose(
				`Failed to read target file for checksum during v2→v3 migration: ${item.path}`,
			);
			// Keep "unknown" as fallback
		}

		v3Installations.push({
			...item,
			sourceChecksum: "unknown", // Will be populated on next install
			targetChecksum,
			installSource: "kit", // Default for existing entries
			ownedSections: undefined, // Not tracked in v2
		});
	}

	return {
		version: "3.0",
		installations: v3Installations,
		lastReconciled: undefined,
		appliedManifestVersion: undefined,
	};
}

/**
 * Check if migration lock exists and is recent (< 30 seconds)
 * Returns true if we should skip migration (another process is migrating)
 */
async function isMigrationLocked(): Promise<boolean> {
	const MIGRATION_LOCK_PATH = join(home, ".claudekit", ".migration.lock");
	try {
		if (!existsSync(MIGRATION_LOCK_PATH)) return false;

		const lockContent = await readFile(MIGRATION_LOCK_PATH, "utf-8");
		const lockTime = Number.parseInt(lockContent, 10);
		const now = Date.now();

		// Lock is valid if < 30 seconds old
		if (now - lockTime < 30000) {
			logger.verbose("Migration lock detected, skipping migration");
			return true;
		}

		// Stale lock — remove it
		logger.verbose("Removing stale migration lock");
		const { unlink } = await import("node:fs/promises");
		await unlink(MIGRATION_LOCK_PATH);
		return false;
	} catch {
		return false;
	}
}

/**
 * Create migration lock file with current timestamp
 */
async function createMigrationLock(): Promise<void> {
	const MIGRATION_LOCK_PATH = join(home, ".claudekit", ".migration.lock");
	await writeFile(MIGRATION_LOCK_PATH, Date.now().toString(), "utf-8");
}

/**
 * Remove migration lock file
 */
async function removeMigrationLock(): Promise<void> {
	const MIGRATION_LOCK_PATH = join(home, ".claudekit", ".migration.lock");
	try {
		const { unlink } = await import("node:fs/promises");
		await unlink(MIGRATION_LOCK_PATH);
	} catch {
		// Ignore errors — lock may have been cleaned up already
	}
}

/**
 * Read the portable registry, auto-migrating to v3.0 if needed
 */
export async function readPortableRegistry(): Promise<PortableRegistryV3> {
	try {
		// Try reading main registry first (no existsSync to avoid TOCTOU)
		try {
			const content = await readFile(REGISTRY_PATH, "utf-8");
			const data = JSON.parse(content);

			// Try parsing as v3.0 first
			const v3Result = PortableRegistrySchemaV3.safeParse(data);
			if (v3Result.success) {
				return v3Result.data;
			}

			// Try parsing as v2.0 and auto-migrate
			const v2Result = PortableRegistrySchema.safeParse(data);
			if (v2Result.success) {
				// Check if another process is already migrating
				if (await isMigrationLocked()) {
					logger.verbose("Migration in progress by another process, returning v2 data as-is");
					// Fail-safe: return v2 data wrapped as v3 without persisting
					return await migrateRegistryV2ToV3(v2Result.data);
				}

				logger.verbose("Auto-migrating registry from v2.0 to v3.0");
				await createMigrationLock();
				try {
					const v3Registry = await migrateRegistryV2ToV3(v2Result.data);
					await writePortableRegistry(v3Registry);
					return v3Registry;
				} finally {
					await removeMigrationLock();
				}
			}

			// Neither v2 nor v3 — corrupted
			logger.verbose("Registry corrupted, returning empty v3.0");
			return { version: "3.0", installations: [] };
		} catch (error) {
			// If ENOENT, try legacy migration; otherwise rethrow
			if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
				throw error;
			}
		}

		// Try migrating legacy registry (v1.0 → v2.0 → v3.0)
		const migratedV2 = await migrateLegacyRegistry();
		if (migratedV2) {
			if (await isMigrationLocked()) {
				logger.verbose("Migration in progress by another process, returning v2 data as-is");
				return await migrateRegistryV2ToV3(migratedV2);
			}

			await createMigrationLock();
			try {
				const v3Registry = await migrateRegistryV2ToV3(migratedV2);
				await writePortableRegistry(v3Registry);
				return v3Registry;
			} finally {
				await removeMigrationLock();
			}
		}

		return { version: "3.0", installations: [] };
	} catch (error) {
		logger.verbose(
			`Registry read error, returning empty v3.0: ${error instanceof Error ? error.message : "Unknown"}`,
		);
		return { version: "3.0", installations: [] };
	}
}

/**
 * Write the portable registry (v3.0)
 */
export async function writePortableRegistry(registry: PortableRegistryV3): Promise<void> {
	const dir = dirname(REGISTRY_PATH);
	if (!existsSync(dir)) {
		await mkdir(dir, { recursive: true });
	}
	await writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2), "utf-8");
}

async function withRegistryLock<T>(operation: () => Promise<T>): Promise<T> {
	const lockDir = dirname(REGISTRY_LOCK_PATH);
	if (!existsSync(lockDir)) {
		await mkdir(lockDir, { recursive: true });
	}
	if (!existsSync(REGISTRY_LOCK_PATH)) {
		await writeFile(REGISTRY_LOCK_PATH, "", "utf-8");
	}

	const release = await lockfile.lock(REGISTRY_LOCK_PATH, {
		realpath: false,
		retries: {
			retries: 5,
			factor: 2,
			minTimeout: 100,
			maxTimeout: 5000,
		},
	});

	try {
		return await operation();
	} finally {
		await release();
	}
}

/**
 * Add an installation to the registry (v3.0 with idempotency tracking)
 */
export async function addPortableInstallation(
	item: string,
	type: PortableType,
	provider: ProviderType,
	global: boolean,
	path: string,
	sourcePath: string,
	options?: {
		sourceChecksum?: string;
		targetChecksum?: string;
		ownedSections?: string[];
		installSource?: "kit" | "manual";
	},
): Promise<void> {
	await withRegistryLock(async () => {
		const registry = await readPortableRegistry();

		// Remove existing entry for same combo (update case)
		registry.installations = registry.installations.filter(
			(i) =>
				!(i.item === item && i.type === type && i.provider === provider && i.global === global),
		);

		registry.installations.push({
			item,
			type,
			provider,
			global,
			path,
			installedAt: new Date().toISOString(),
			sourcePath,
			cliVersion: getCliVersion(),
			sourceChecksum: options?.sourceChecksum || "unknown",
			targetChecksum: options?.targetChecksum || "unknown",
			installSource: options?.installSource || "kit",
			ownedSections: options?.ownedSections,
		});

		await writePortableRegistry(registry);
	});
}

/**
 * Remove an installation from the registry
 */
export async function removePortableInstallation(
	item: string,
	type: PortableType,
	provider: ProviderType,
	global: boolean,
): Promise<PortableInstallationV3 | null> {
	return withRegistryLock(async () => {
		const registry = await readPortableRegistry();

		const index = registry.installations.findIndex(
			(i) => i.item === item && i.type === type && i.provider === provider && i.global === global,
		);

		if (index === -1) return null;

		const [removed] = registry.installations.splice(index, 1);
		await writePortableRegistry(registry);
		return removed;
	});
}

/**
 * Find installations by item name and optional filters
 */
export function findPortableInstallations(
	registry: PortableRegistryV3,
	item: string,
	type?: PortableType,
	provider?: ProviderType,
	global?: boolean,
): PortableInstallationV3[] {
	return registry.installations.filter((i) => {
		if (i.item.toLowerCase() !== item.toLowerCase()) return false;
		if (type && i.type !== type) return false;
		if (provider && i.provider !== provider) return false;
		if (global !== undefined && i.global !== global) return false;
		return true;
	});
}

/**
 * Get all installations for a specific type
 */
export function getInstallationsByType(
	registry: PortableRegistryV3,
	type: PortableType,
): PortableInstallationV3[] {
	return registry.installations.filter((i) => i.type === type);
}

/**
 * Sync registry with filesystem — remove orphaned entries
 */
export async function syncPortableRegistry(): Promise<{
	removed: PortableInstallationV3[];
}> {
	return withRegistryLock(async () => {
		const registry = await readPortableRegistry();
		const removed: PortableInstallationV3[] = [];

		registry.installations = registry.installations.filter((i) => {
			if (!existsSync(i.path)) {
				removed.push(i);
				return false;
			}
			return true;
		});

		if (removed.length > 0) {
			await writePortableRegistry(registry);
		}

		return { removed };
	});
}
