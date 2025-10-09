import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { type Config, ConfigSchema } from "../types.js";
import { logger } from "./logger.js";

const CONFIG_DIR = join(homedir(), ".claudekit");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export class ConfigManager {
	private static config: Config | null = null;

	static async load(): Promise<Config> {
		if (ConfigManager.config) {
			return ConfigManager.config;
		}

		try {
			if (existsSync(CONFIG_FILE)) {
				const content = await readFile(CONFIG_FILE, "utf-8");
				const data = JSON.parse(content);
				ConfigManager.config = ConfigSchema.parse(data);
				logger.debug(`Config loaded from ${CONFIG_FILE}`);
				return ConfigManager.config;
			}
		} catch (error) {
			logger.warning(
				`Failed to load config: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}

		// Return default config
		ConfigManager.config = { github: {}, defaults: {} };
		return ConfigManager.config;
	}

	static async save(config: Config): Promise<void> {
		try {
			// Validate config
			const validConfig = ConfigSchema.parse(config);

			// Ensure config directory exists
			if (!existsSync(CONFIG_DIR)) {
				await mkdir(CONFIG_DIR, { recursive: true });
			}

			// Write config file
			await writeFile(CONFIG_FILE, JSON.stringify(validConfig, null, 2), "utf-8");
			ConfigManager.config = validConfig;
			logger.debug(`Config saved to ${CONFIG_FILE}`);
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

	static async getToken(): Promise<string | undefined> {
		const config = await ConfigManager.load();
		return config.github?.token;
	}

	static async setToken(token: string): Promise<void> {
		await ConfigManager.set("github.token", token);
	}
}
