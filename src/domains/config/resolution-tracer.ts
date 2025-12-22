import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PathResolver } from "@/shared/path-resolver.js";
import type { Config } from "@/types";

export type ConfigSource = "DEFAULT" | "GLOBAL" | "LOCAL" | "CLI";

export interface TracedValue<T = unknown> {
	value: T;
	source: ConfigSource;
	path: string;
}

export interface ResolutionResult {
	merged: Record<string, unknown>;
	traced: Record<string, TracedValue>;
	sources: {
		default: Record<string, unknown>;
		global: Record<string, unknown> | null;
		local: Record<string, unknown> | null;
	};
}

/**
 * Resolution Tracer - tracks which config layer provides each value
 * Resolution order: CLI > LOCAL > GLOBAL > DEFAULT
 */
export class ResolutionTracer {
	/**
	 * Trace config resolution from all layers
	 * @param projectDir - Project directory for local config
	 * @param global - If true, use global mode paths
	 */
	static async trace(projectDir?: string, global = false): Promise<ResolutionResult> {
		// Load each layer
		const defaultConfig = ResolutionTracer.getDefaults();
		const globalConfig = await ResolutionTracer.loadGlobalConfig(global);
		const localConfig = projectDir
			? await ResolutionTracer.loadLocalConfig(projectDir, global)
			: null;

		// Merge with tracing (DEFAULT < GLOBAL < LOCAL)
		const traced: Record<string, TracedValue> = {};
		const merged: Record<string, unknown> = {};

		// Layer 1: Defaults (lowest priority)
		for (const [key, value] of Object.entries(defaultConfig)) {
			traced[key] = { value, source: "DEFAULT", path: key };
			merged[key] = value;
		}

		// Layer 2: Global config (overrides defaults)
		if (globalConfig) {
			ResolutionTracer.mergeWithTrace(globalConfig, "GLOBAL", traced, merged);
		}

		// Layer 3: Local config (highest priority, overrides global)
		if (localConfig) {
			ResolutionTracer.mergeWithTrace(localConfig, "LOCAL", traced, merged);
		}

		return {
			merged,
			traced,
			sources: {
				default: defaultConfig,
				global: globalConfig,
				local: localConfig,
			},
		};
	}

	/**
	 * Get default config values
	 */
	private static getDefaults(): Record<string, unknown> {
		return {
			"defaults.kit": "engineer",
			"defaults.dir": ".",
			"folders.docs": "docs",
			"folders.plans": "plans",
		};
	}

	/**
	 * Load global config file
	 */
	private static async loadGlobalConfig(global: boolean): Promise<Record<string, unknown> | null> {
		const configFile = PathResolver.getConfigFile(global);
		if (!existsSync(configFile)) return null;

		try {
			const content = await readFile(configFile, "utf-8");
			const config = JSON.parse(content) as Config;
			return ResolutionTracer.flattenObject(config);
		} catch {
			return null;
		}
	}

	/**
	 * Load local config file
	 */
	private static async loadLocalConfig(
		projectDir: string,
		global: boolean,
	): Promise<Record<string, unknown> | null> {
		// Local config is always in .claude/.ck.json regardless of global flag
		const configDir = global ? projectDir : join(projectDir, ".claude");
		const configPath = join(configDir, ".ck.json");

		if (!existsSync(configPath)) return null;

		try {
			const content = await readFile(configPath, "utf-8");
			const config = JSON.parse(content) as Config;
			return ResolutionTracer.flattenObject(config);
		} catch {
			return null;
		}
	}

	/**
	 * Flatten nested object to dot-notation paths
	 * Example: { defaults: { kit: "engineer" } } => { "defaults.kit": "engineer" }
	 */
	private static flattenObject(
		obj: Record<string, unknown>,
		prefix = "",
	): Record<string, unknown> {
		const result: Record<string, unknown> = {};

		for (const [key, value] of Object.entries(obj)) {
			const path = prefix ? `${prefix}.${key}` : key;

			if (value && typeof value === "object" && !Array.isArray(value)) {
				// Recursively flatten nested objects
				Object.assign(result, ResolutionTracer.flattenObject(value as Record<string, unknown>, path));
			} else {
				result[path] = value;
			}
		}

		return result;
	}

	/**
	 * Merge config layer into traced result
	 */
	private static mergeWithTrace(
		config: Record<string, unknown>,
		source: ConfigSource,
		traced: Record<string, TracedValue>,
		merged: Record<string, unknown>,
	): void {
		for (const [key, value] of Object.entries(config)) {
			traced[key] = { value, source, path: key };
			merged[key] = value;
		}
	}
}
