import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chmod } from "node:fs/promises";
import { platform } from "node:os";
import { type Config, ConfigSchema } from "../types.js";
import { logger } from "./logger.js";
import { PathResolver } from "./path-resolver.js";

export class ConfigManager {
	private static config: Config | null = null;
	private static globalFlag = false;

	/**
	 * Set the global flag for config path resolution
	 * Must be called before load() or save()
	 */
	static setGlobalFlag(global: boolean): void {
		ConfigManager.globalFlag = global;
		// Reset cached config when flag changes
		ConfigManager.config = null;
	}

	/**
	 * Get current global flag value
	 */
	static getGlobalFlag(): boolean {
		return ConfigManager.globalFlag;
	}

	static async load(): Promise<Config> {
		if (ConfigManager.config) {
			return ConfigManager.config;
		}

		const configFile = PathResolver.getConfigFile(ConfigManager.globalFlag);

		try {
			if (existsSync(configFile)) {
				const content = await readFile(configFile, "utf-8");
				const data = JSON.parse(content);
				ConfigManager.config = ConfigSchema.parse(data);
				logger.debug(`Config loaded from ${configFile}`);
				return ConfigManager.config;
			}
		} catch (error) {
			logger.warning(
				`Failed to load config: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}

		// Return default config
		ConfigManager.config = { defaults: {} };
		return ConfigManager.config;
	}

	static async save(config: Config): Promise<void> {
		try {
			// Validate config
			const validConfig = ConfigSchema.parse(config);

			const configDir = PathResolver.getConfigDir(ConfigManager.globalFlag);
			const configFile = PathResolver.getConfigFile(ConfigManager.globalFlag);

			// Ensure config directory exists with secure permissions
			if (!existsSync(configDir)) {
				await mkdir(configDir, { recursive: true });

				// Set directory permissions on Unix-like systems
				if (platform() !== "win32") {
					await chmod(configDir, 0o700);
				}
			}

			// Write config file
			await writeFile(configFile, JSON.stringify(validConfig, null, 2), "utf-8");

			// Set file permissions on Unix-like systems
			if (platform() !== "win32") {
				await chmod(configFile, 0o600);
			}

			ConfigManager.config = validConfig;
			logger.debug(`Config saved to ${configFile}`);
		} catch (error) {
			throw new Error(
				`Failed to save config: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	static async get(): Promise<Config> {
		return ConfigManager.load();
	}

	static async set(key: string, value: unknown): Promise<void> {
		const config = await ConfigManager.load();
		const keys = key.split(".");
		let current: any = config;

		for (let i = 0; i < keys.length - 1; i++) {
			if (!(keys[i] in current)) {
				current[keys[i]] = {};
			}
			current = current[keys[i]];
		}

		current[keys[keys.length - 1]] = value;
		await ConfigManager.save(config);
	}
}
