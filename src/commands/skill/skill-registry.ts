/**
 * Skill registry - tracks installed skills across agents
 * Central registry at ~/.claudekit/skill-registry.json
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";
import type { AgentType } from "./types.js";

const home = homedir();
const REGISTRY_PATH = join(home, ".claudekit", "skill-registry.json");

// Schema for registry entries
const SkillInstallationSchema = z.object({
	skill: z.string(),
	agent: z.string(),
	global: z.boolean(),
	path: z.string(),
	installedAt: z.string(), // ISO 8601
	sourcePath: z.string(),
	cliVersion: z.string().optional(),
});
export type SkillInstallation = z.infer<typeof SkillInstallationSchema>;

const SkillRegistrySchema = z.object({
	version: z.literal("1.0"),
	installations: z.array(SkillInstallationSchema),
});
export type SkillRegistry = z.infer<typeof SkillRegistrySchema>;

/**
 * Get CLI version from package.json (best effort)
 */
function getCliVersion(): string {
	try {
		// This will be available at runtime
		return process.env.npm_package_version || "unknown";
	} catch {
		return "unknown";
	}
}

/**
 * Read the skill registry, creating empty one if not exists
 */
export async function readRegistry(): Promise<SkillRegistry> {
	try {
		if (!existsSync(REGISTRY_PATH)) {
			return { version: "1.0", installations: [] };
		}
		const content = await readFile(REGISTRY_PATH, "utf-8");
		const data = JSON.parse(content);
		return SkillRegistrySchema.parse(data);
	} catch {
		// Corrupted or invalid registry, return empty
		return { version: "1.0", installations: [] };
	}
}

/**
 * Write the skill registry
 */
export async function writeRegistry(registry: SkillRegistry): Promise<void> {
	const dir = dirname(REGISTRY_PATH);
	if (!existsSync(dir)) {
		await mkdir(dir, { recursive: true });
	}
	await writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2), "utf-8");
}

/**
 * Add an installation to the registry
 */
export async function addInstallation(
	skill: string,
	agent: AgentType,
	global: boolean,
	path: string,
	sourcePath: string,
): Promise<void> {
	const registry = await readRegistry();

	// Remove existing entry for same skill+agent+global combo (update case)
	registry.installations = registry.installations.filter(
		(i) => !(i.skill === skill && i.agent === agent && i.global === global),
	);

	// Add new entry
	registry.installations.push({
		skill,
		agent,
		global,
		path,
		installedAt: new Date().toISOString(),
		sourcePath,
		cliVersion: getCliVersion(),
	});

	await writeRegistry(registry);
}

/**
 * Remove an installation from the registry
 */
export async function removeInstallation(
	skill: string,
	agent: AgentType,
	global: boolean,
): Promise<SkillInstallation | null> {
	const registry = await readRegistry();

	const index = registry.installations.findIndex(
		(i) => i.skill === skill && i.agent === agent && i.global === global,
	);

	if (index === -1) {
		return null;
	}

	const [removed] = registry.installations.splice(index, 1);
	await writeRegistry(registry);
	return removed;
}

/**
 * Find installation by skill name and agent
 */
export function findInstallation(
	registry: SkillRegistry,
	skill: string,
	agent?: AgentType,
	global?: boolean,
): SkillInstallation[] {
	return registry.installations.filter((i) => {
		if (i.skill.toLowerCase() !== skill.toLowerCase()) return false;
		if (agent && i.agent !== agent) return false;
		if (global !== undefined && i.global !== global) return false;
		return true;
	});
}

/**
 * Get all installations for a specific agent
 */
export function getInstallationsForAgent(
	registry: SkillRegistry,
	agent: AgentType,
	global?: boolean,
): SkillInstallation[] {
	return registry.installations.filter((i) => {
		if (i.agent !== agent) return false;
		if (global !== undefined && i.global !== global) return false;
		return true;
	});
}

/**
 * Check if a skill is registered (installed via ck skill)
 */
export function isRegistered(
	registry: SkillRegistry,
	skill: string,
	agent: AgentType,
	global: boolean,
): boolean {
	return registry.installations.some(
		(i) =>
			i.skill.toLowerCase() === skill.toLowerCase() && i.agent === agent && i.global === global,
	);
}

/**
 * Sync registry with filesystem - remove orphaned entries
 */
export async function syncRegistry(): Promise<{ removed: SkillInstallation[] }> {
	const registry = await readRegistry();
	const removed: SkillInstallation[] = [];

	registry.installations = registry.installations.filter((i) => {
		if (!existsSync(i.path)) {
			removed.push(i);
			return false;
		}
		return true;
	});

	if (removed.length > 0) {
		await writeRegistry(registry);
	}

	return { removed };
}
