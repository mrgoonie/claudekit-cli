/**
 * Portable registry — unified tracking of installed agents, commands, and skills
 * Extends skill-registry.json to portable-registry.json with backward compatibility.
 * Central registry at ~/.claudekit/portable-registry.json
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import lockfile from "proper-lockfile";
import { z } from "zod";
import { logger } from "../../shared/logger.js";
import { computeFileChecksum } from "./checksum-utils.js";
import { UNKNOWN_CHECKSUM, normalizeChecksum } from "./reconcile-types.js";
import type { PortableType, ProviderType } from "./types.js";

function getPortableRegistryPaths() {
	const home = homedir();
	const claudekitDir = join(home, ".claudekit");
	return {
		registryPath: join(claudekitDir, "portable-registry.json"),
		registryLockPath: join(claudekitDir, "portable-registry.lock"),
		legacyRegistryPath: join(claudekitDir, "skill-registry.json"),
		migrationLockPath: join(claudekitDir, ".migration.lock"),
	};
}

// Schema for v2.0 registry entries (with .passthrough() for forward compat)
const PortableInstallationSchema = z
	.object({
		item: z.string(), // Item name (agent, command, skill, config, or rules name)
		type: z.enum(["agent", "command", "skill", "config", "rules", "hooks"]),
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
	type: z.enum(["agent", "command", "skill", "config", "rules", "hooks"]),
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

const RepairablePortableRegistrySchemaV3 = z
	.object({
		version: z.literal("3.0"),
		installations: z.array(PortableInstallationSchema),
		lastReconciled: z.string().optional(),
		appliedManifestVersion: z.string().optional(),
	})
	.passthrough();
type RepairablePortableRegistryV3 = z.infer<typeof RepairablePortableRegistrySchemaV3>;

type PreparedStaleRegistryV3Repair = {
	sourceContent: string;
	repairedRegistry: PortableRegistryV3;
};

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

function isErrnoCode(error: unknown, code: string): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as NodeJS.ErrnoException).code === code
	);
}

function normalizeInstallationChecksums(
	installation: PortableInstallationV3,
): PortableInstallationV3 {
	return {
		...installation,
		sourceChecksum: normalizeChecksum(installation.sourceChecksum),
		targetChecksum: normalizeChecksum(installation.targetChecksum),
	};
}

function normalizePortableRegistryChecksums(registry: PortableRegistryV3): PortableRegistryV3 {
	return {
		...registry,
		installations: registry.installations.map(normalizeInstallationChecksums),
	};
}

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
	const { legacyRegistryPath } = getPortableRegistryPaths();
	try {
		const content = await readFile(legacyRegistryPath, "utf-8");
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
		let targetChecksum: string = UNKNOWN_CHECKSUM;
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
			sourceChecksum: UNKNOWN_CHECKSUM, // Will be populated on next install
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

function getStringField(item: PortableInstallation, field: string): string | undefined {
	const record = item as Record<string, unknown>;
	if (!(field in record) || record[field] === undefined) {
		return undefined;
	}
	const value = record[field];
	if (typeof value !== "string") {
		throw new Error("portable-registry.json has unsupported schema/version");
	}
	return value;
}

function getOwnedSections(item: PortableInstallation): string[] | undefined {
	const record = item as Record<string, unknown>;
	if (!("ownedSections" in record) || record.ownedSections === undefined) {
		return undefined;
	}
	const value = record.ownedSections;
	if (!Array.isArray(value) || !value.every((section) => typeof section === "string")) {
		throw new Error("portable-registry.json has unsupported schema/version");
	}
	return value;
}

function getInstallSource(item: PortableInstallation): "kit" | "manual" {
	const installSource = getStringField(item, "installSource");
	if (installSource === undefined) {
		return "kit";
	}
	if (installSource !== "kit" && installSource !== "manual") {
		throw new Error("portable-registry.json has unsupported schema/version");
	}
	return installSource;
}

async function repairStaleRegistryV3(
	registry: RepairablePortableRegistryV3,
): Promise<PortableRegistryV3> {
	const installations: PortableInstallationV3[] = [];

	for (const item of registry.installations) {
		let targetChecksum =
			normalizeChecksum(getStringField(item, "targetChecksum")) || UNKNOWN_CHECKSUM;
		if (targetChecksum === UNKNOWN_CHECKSUM && existsSync(item.path)) {
			try {
				targetChecksum = await computeFileChecksum(item.path);
			} catch {
				targetChecksum = UNKNOWN_CHECKSUM;
			}
		}

		installations.push({
			...item,
			sourceChecksum: normalizeChecksum(getStringField(item, "sourceChecksum")) || UNKNOWN_CHECKSUM,
			targetChecksum,
			installSource: getInstallSource(item),
			ownedSections: getOwnedSections(item),
		});
	}

	return normalizePortableRegistryChecksums({
		...registry,
		version: "3.0",
		installations,
		lastReconciled: registry.lastReconciled,
		appliedManifestVersion: registry.appliedManifestVersion,
	});
}

async function persistCurrentStaleRegistryV3Repair(
	preparedRepair?: PreparedStaleRegistryV3Repair,
): Promise<PortableRegistryV3> {
	return withRegistryLock(async () => {
		const { registryPath } = getPortableRegistryPaths();
		let content: string;
		try {
			content = await readFile(registryPath, "utf-8");
		} catch (error) {
			if (isErrnoCode(error, "ENOENT")) {
				return readPortableRegistryInternal({ persistStaleV3Repair: false });
			}
			throw error;
		}

		let data: unknown;
		try {
			data = JSON.parse(content);
		} catch (error) {
			throw new Error(
				`portable-registry.json is not valid JSON: ${error instanceof Error ? error.message : "Unknown parse error"}`,
			);
		}

		const v3Result = PortableRegistrySchemaV3.safeParse(data);
		if (v3Result.success) {
			return normalizePortableRegistryChecksums(v3Result.data);
		}

		const repairableV3Result = RepairablePortableRegistrySchemaV3.safeParse(data);
		if (!repairableV3Result.success) {
			return readPortableRegistryInternal({ persistStaleV3Repair: false });
		}

		const repairedRegistry =
			preparedRepair && preparedRepair.sourceContent === content
				? preparedRepair.repairedRegistry
				: await repairStaleRegistryV3(repairableV3Result.data);
		if (await isMigrationLocked()) {
			logger.verbose("Migration in progress by another process, using repaired v3 view");
			return repairedRegistry;
		}

		logger.verbose("Repairing stale portable registry v3.0 fields");
		await writePortableRegistry(repairedRegistry);
		return repairedRegistry;
	});
}

/**
 * Check if migration lock exists and is recent (< 30 seconds)
 * Returns true if we should skip migration (another process is migrating)
 */
async function isMigrationLocked(): Promise<boolean> {
	const { migrationLockPath } = getPortableRegistryPaths();
	try {
		// Single atomic read avoids existsSync/readFile TOCTOU gap.
		const lockContent = await readFile(migrationLockPath, "utf-8");
		const lockTime = Number.parseInt(lockContent, 10);
		if (Number.isNaN(lockTime)) {
			logger.verbose("Migration lock timestamp is invalid, treating lock as active");
			return true;
		}
		const now = Date.now();

		// Lock is valid if < 30 seconds old
		if (now - lockTime < 30000) {
			logger.verbose("Migration lock detected, skipping migration");
			return true;
		}

		// Stale lock — remove it
		logger.verbose("Removing stale migration lock");
		await unlink(migrationLockPath);
		return false;
	} catch (error) {
		if (isErrnoCode(error, "ENOENT")) {
			return false;
		}
		logger.verbose(
			`Failed to inspect migration lock, treating as locked: ${error instanceof Error ? error.message : "Unknown"}`,
		);
		return true;
	}
}

/**
 * Create migration lock file with current timestamp
 */
async function createMigrationLock(): Promise<void> {
	const { migrationLockPath } = getPortableRegistryPaths();
	const lockDir = dirname(migrationLockPath);
	if (!existsSync(lockDir)) {
		await mkdir(lockDir, { recursive: true });
	}
	await writeFile(migrationLockPath, Date.now().toString(), "utf-8");
}

/**
 * Remove migration lock file
 */
async function removeMigrationLock(): Promise<void> {
	const { migrationLockPath } = getPortableRegistryPaths();
	try {
		await unlink(migrationLockPath);
	} catch {
		// Ignore errors — lock may have been cleaned up already
	}
}

/**
 * Read the portable registry, auto-migrating to v3.0 if needed
 */
export async function readPortableRegistry(): Promise<PortableRegistryV3> {
	return readPortableRegistryInternal({ persistStaleV3Repair: true });
}

async function readPortableRegistryInternal(options: {
	persistStaleV3Repair: boolean;
}): Promise<PortableRegistryV3> {
	const { registryPath } = getPortableRegistryPaths();
	try {
		const content = await readFile(registryPath, "utf-8");
		let data: unknown;
		try {
			data = JSON.parse(content);
		} catch (error) {
			throw new Error(
				`portable-registry.json is not valid JSON: ${error instanceof Error ? error.message : "Unknown parse error"}`,
			);
		}

		const v3Result = PortableRegistrySchemaV3.safeParse(data);
		if (v3Result.success) {
			return normalizePortableRegistryChecksums(v3Result.data);
		}

		const repairableV3Result = RepairablePortableRegistrySchemaV3.safeParse(data);
		if (repairableV3Result.success) {
			const repairedRegistry = await repairStaleRegistryV3(repairableV3Result.data);
			if (!options.persistStaleV3Repair) {
				return repairedRegistry;
			}
			if (await isMigrationLocked()) {
				logger.verbose("Migration in progress by another process, using repaired v3 view");
				return repairedRegistry;
			}

			return persistCurrentStaleRegistryV3Repair({
				sourceContent: content,
				repairedRegistry,
			});
		}

		const v2Result = PortableRegistrySchema.safeParse(data);
		if (!v2Result.success) {
			throw new Error("portable-registry.json has unsupported schema/version");
		}

		if (await isMigrationLocked()) {
			logger.verbose("Migration in progress by another process, using in-memory v2→v3 view");
			return normalizePortableRegistryChecksums(await migrateRegistryV2ToV3(v2Result.data));
		}

		logger.verbose("Auto-migrating registry from v2.0 to v3.0");
		await createMigrationLock();
		try {
			const v3Registry = normalizePortableRegistryChecksums(
				await migrateRegistryV2ToV3(v2Result.data),
			);
			await writePortableRegistry(v3Registry);
			return v3Registry;
		} finally {
			await removeMigrationLock();
		}
	} catch (error) {
		if (!isErrnoCode(error, "ENOENT")) {
			throw error;
		}
	}

	// Try migrating legacy registry (v1.0 → v2.0 → v3.0)
	const migratedV2 = await migrateLegacyRegistry();
	if (migratedV2) {
		if (await isMigrationLocked()) {
			logger.verbose("Migration in progress by another process, using in-memory v2→v3 view");
			return normalizePortableRegistryChecksums(await migrateRegistryV2ToV3(migratedV2));
		}

		await createMigrationLock();
		try {
			const v3Registry = normalizePortableRegistryChecksums(
				await migrateRegistryV2ToV3(migratedV2),
			);
			await writePortableRegistry(v3Registry);
			return v3Registry;
		} finally {
			await removeMigrationLock();
		}
	}

	return { version: "3.0", installations: [] };
}

async function readPortableRegistryWithinRegistryLock(): Promise<PortableRegistryV3> {
	return readPortableRegistryInternal({ persistStaleV3Repair: false });
}

/**
 * Write the portable registry (v3.0)
 */
export async function writePortableRegistry(registry: PortableRegistryV3): Promise<void> {
	const { registryPath } = getPortableRegistryPaths();
	const dir = dirname(registryPath);
	if (!existsSync(dir)) {
		await mkdir(dir, { recursive: true });
	}
	const normalizedRegistry = normalizePortableRegistryChecksums(registry);
	const tempPath = `${registryPath}.tmp-${process.pid}-${Date.now()}`;
	try {
		await writeFile(tempPath, JSON.stringify(normalizedRegistry, null, 2), "utf-8");
		await rename(tempPath, registryPath);
	} catch (error) {
		try {
			await unlink(tempPath);
		} catch {
			// Best-effort temp cleanup
		}
		throw error;
	}
}

async function withRegistryLock<T>(operation: () => Promise<T>): Promise<T> {
	const { registryLockPath } = getPortableRegistryPaths();
	const lockDir = dirname(registryLockPath);
	if (!existsSync(lockDir)) {
		await mkdir(lockDir, { recursive: true });
	}
	if (!existsSync(registryLockPath)) {
		await writeFile(registryLockPath, "", "utf-8");
	}

	const release = await lockfile.lock(registryLockPath, {
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
		const registry = await readPortableRegistryWithinRegistryLock();

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
			sourceChecksum: normalizeChecksum(options?.sourceChecksum) || UNKNOWN_CHECKSUM,
			targetChecksum: normalizeChecksum(options?.targetChecksum) || UNKNOWN_CHECKSUM,
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
	options?: { path?: string },
): Promise<PortableInstallationV3 | null> {
	return withRegistryLock(async () => {
		const registry = await readPortableRegistryWithinRegistryLock();

		const index = registry.installations.findIndex(
			(i) =>
				i.item === item &&
				i.type === type &&
				i.provider === provider &&
				i.global === global &&
				(!options?.path || resolve(i.path) === resolve(options.path)),
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
 * Update appliedManifestVersion atomically under registry lock.
 * Prevents a read-modify-write race when multiple processes update the registry.
 */
export async function updateAppliedManifestVersion(version: string): Promise<void> {
	await withRegistryLock(async () => {
		const registry = await readPortableRegistryWithinRegistryLock();
		registry.appliedManifestVersion = version;
		await writePortableRegistry(registry);
	});
}

/**
 * Batch-remove installations matching a filter under registry lock.
 * Single read-filter-write cycle, consistent with syncPortableRegistry pattern.
 */
export async function removeInstallationsByFilter(
	predicate: (entry: PortableInstallationV3) => boolean,
): Promise<PortableInstallationV3[]> {
	return withRegistryLock(async () => {
		const registry = await readPortableRegistryWithinRegistryLock();
		const removed: PortableInstallationV3[] = [];

		registry.installations = registry.installations.filter((entry) => {
			if (predicate(entry)) {
				removed.push(entry);
				return false;
			}
			return true;
		});

		if (removed.length > 0) {
			await writePortableRegistry(registry);
		}

		return removed;
	});
}

/**
 * Sync registry with filesystem — remove orphaned entries
 */
export async function syncPortableRegistry(): Promise<{
	removed: PortableInstallationV3[];
}> {
	return withRegistryLock(async () => {
		const registry = await readPortableRegistryWithinRegistryLock();
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
