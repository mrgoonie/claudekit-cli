/**
 * Portable registry — unified tracking of installed agents, commands, and skills
 * Extends skill-registry.json to portable-registry.json with backward compatibility.
 * Central registry at ~/.claudekit/portable-registry.json
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";
import { logger } from "../../shared/logger.js";
import type { PortableType, ProviderType } from "./types.js";

const home = homedir();
const REGISTRY_PATH = join(home, ".claudekit", "portable-registry.json");
const LEGACY_REGISTRY_PATH = join(home, ".claudekit", "skill-registry.json");

// Schema for registry entries
const PortableInstallationSchema = z.object({
	item: z.string(), // Item name (agent, command, or skill name)
	type: z.enum(["agent", "command", "skill"]),
	provider: z.string(), // Provider type
	global: z.boolean(),
	path: z.string(),
	installedAt: z.string(), // ISO 8601
	sourcePath: z.string(),
	cliVersion: z.string().optional(),
});
export type PortableInstallation = z.infer<typeof PortableInstallationSchema>;

const PortableRegistrySchema = z.object({
	version: z.literal("2.0"),
	installations: z.array(PortableInstallationSchema),
});
export type PortableRegistry = z.infer<typeof PortableRegistrySchema>;

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
 * Migrate legacy skill-registry.json to portable-registry.json
 */
async function migrateLegacyRegistry(): Promise<PortableRegistry | null> {
	try {
		if (!existsSync(LEGACY_REGISTRY_PATH)) return null;

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
		logger.verbose(
			`Failed to migrate legacy registry: ${error instanceof Error ? error.message : "Unknown"}`,
		);
		return null;
	}
}

/**
 * Read the portable registry, migrating from legacy if needed
 */
export async function readPortableRegistry(): Promise<PortableRegistry> {
	try {
		if (existsSync(REGISTRY_PATH)) {
			const content = await readFile(REGISTRY_PATH, "utf-8");
			const data = JSON.parse(content);
			return PortableRegistrySchema.parse(data);
		}

		// Try migrating legacy registry
		const migrated = await migrateLegacyRegistry();
		if (migrated) {
			await writePortableRegistry(migrated);
			return migrated;
		}

		return { version: "2.0", installations: [] };
	} catch (error) {
		logger.verbose(
			`Registry corrupted or invalid, returning empty: ${error instanceof Error ? error.message : "Unknown"}`,
		);
		return { version: "2.0", installations: [] };
	}
}

/**
 * Write the portable registry
 */
export async function writePortableRegistry(registry: PortableRegistry): Promise<void> {
	const dir = dirname(REGISTRY_PATH);
	if (!existsSync(dir)) {
		await mkdir(dir, { recursive: true });
	}
	await writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2), "utf-8");
}

/**
 * Add an installation to the registry
 */
export async function addPortableInstallation(
	item: string,
	type: PortableType,
	provider: ProviderType,
	global: boolean,
	path: string,
	sourcePath: string,
): Promise<void> {
	const registry = await readPortableRegistry();

	// Remove existing entry for same combo (update case)
	registry.installations = registry.installations.filter(
		(i) => !(i.item === item && i.type === type && i.provider === provider && i.global === global),
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
	});

	await writePortableRegistry(registry);
}

/**
 * Remove an installation from the registry
 */
export async function removePortableInstallation(
	item: string,
	type: PortableType,
	provider: ProviderType,
	global: boolean,
): Promise<PortableInstallation | null> {
	const registry = await readPortableRegistry();

	const index = registry.installations.findIndex(
		(i) => i.item === item && i.type === type && i.provider === provider && i.global === global,
	);

	if (index === -1) return null;

	const [removed] = registry.installations.splice(index, 1);
	await writePortableRegistry(registry);
	return removed;
}

/**
 * Find installations by item name and optional filters
 */
export function findPortableInstallations(
	registry: PortableRegistry,
	item: string,
	type?: PortableType,
	provider?: ProviderType,
	global?: boolean,
): PortableInstallation[] {
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
	registry: PortableRegistry,
	type: PortableType,
): PortableInstallation[] {
	return registry.installations.filter((i) => i.type === type);
}

/**
 * Sync registry with filesystem — remove orphaned entries
 */
export async function syncPortableRegistry(): Promise<{
	removed: PortableInstallation[];
}> {
	const registry = await readPortableRegistry();
	const removed: PortableInstallation[] = [];

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
}
