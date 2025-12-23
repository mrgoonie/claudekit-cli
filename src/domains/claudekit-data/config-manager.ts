/**
 * ClaudeKit config manager
 * Handles ~/.claudekit/config.json operations
 * Note: This is distinct from the existing ConfigManager which handles
 * project-level config and global config in different paths
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
import { type ClaudeKitConfig, ClaudeKitConfigSchema, DEFAULT_CLAUDEKIT_CONFIG } from "@/types";

export class ClaudeKitConfigManager {
	private static config: ClaudeKitConfig | null = null;

	/**
	 * Load ClaudeKit config from disk
	 */
	static async load(): Promise<ClaudeKitConfig> {
		if (ClaudeKitConfigManager.config) {
			return ClaudeKitConfigManager.config;
		}

		const configPath = PathResolver.getClaudeKitConfigPath();

		try {
			if (existsSync(configPath)) {
				const content = await readFile(configPath, "utf-8");
				const data = JSON.parse(content);
				ClaudeKitConfigManager.config = ClaudeKitConfigSchema.parse(data);
				logger.debug(`ClaudeKit config loaded from ${configPath}`);
				return ClaudeKitConfigManager.config;
			}
		} catch (error) {
			logger.warning(
				`Failed to load ClaudeKit config: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}

		// Return default config
		ClaudeKitConfigManager.config = { ...DEFAULT_CLAUDEKIT_CONFIG };
		return ClaudeKitConfigManager.config;
	}

	/**
	 * Save ClaudeKit config to disk
	 */
	static async save(config: ClaudeKitConfig): Promise<void> {
		try {
			const validConfig = ClaudeKitConfigSchema.parse(config);
			const configPath = PathResolver.getClaudeKitConfigPath();
			const dir = dirname(configPath);

			if (!existsSync(dir)) {
				await mkdir(dir, { recursive: true });
			}

			await writeFile(configPath, JSON.stringify(validConfig, null, 2), "utf-8");
			ClaudeKitConfigManager.config = validConfig;
			logger.debug(`ClaudeKit config saved to ${configPath}`);
		} catch (error) {
			throw new Error(
				`Failed to save ClaudeKit config: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Get a config value by key path
	 */
	static async get<T = unknown>(keyPath: string): Promise<T | undefined> {
		const config = await ClaudeKitConfigManager.load();
		const keys = keyPath.split(".");
		let current: unknown = config;

		for (const key of keys) {
			if (current === null || current === undefined) return undefined;
			if (typeof current !== "object") return undefined;
			current = (current as Record<string, unknown>)[key];
		}

		return current as T;
	}

	/**
	 * Set a config value by key path
	 */
	static async set(keyPath: string, value: unknown): Promise<void> {
		const config = await ClaudeKitConfigManager.load();
		const keys = keyPath.split(".");
		let current: Record<string, unknown> = config as Record<string, unknown>;

		for (let i = 0; i < keys.length - 1; i++) {
			const key = keys[i];
			if (!(key in current) || typeof current[key] !== "object") {
				current[key] = {};
			}
			current = current[key] as Record<string, unknown>;
		}

		current[keys[keys.length - 1]] = value;
		await ClaudeKitConfigManager.save(config);
	}

	/**
	 * Clear cached config (for testing)
	 */
	static clearCache(): void {
		ClaudeKitConfigManager.config = null;
	}
}
