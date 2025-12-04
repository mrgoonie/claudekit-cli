import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chmod } from "node:fs/promises";
import { platform } from "node:os";
import { join } from "node:path";
import {
	type Config,
	ConfigSchema,
	DEFAULT_FOLDERS,
	type FoldersConfig,
	FoldersConfigSchema,
} from "../types.js";
import { logger } from "./logger.js";
import { PathResolver } from "./path-resolver.js";

// Project-level config file name
const PROJECT_CONFIG_FILE = ".ck.json";

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

	/**
	 * Load project-level config from .claude/.ck.json (local) or .ck.json (global)
	 * Returns null if no project config exists
	 * @param projectDir - The project directory
	 * @param global - If true, load from projectDir/.ck.json (for global mode where projectDir is ~/.claude)
	 */
	static async loadProjectConfig(
		projectDir: string,
		global = false,
	): Promise<FoldersConfig | null> {
		const configDir = global ? projectDir : join(projectDir, ".claude");
		const configPath = join(configDir, PROJECT_CONFIG_FILE);
		try {
			if (existsSync(configPath)) {
				const content = await readFile(configPath, "utf-8");
				const data = JSON.parse(content);
				// Project config uses "paths" key for folder configuration
				const folders = FoldersConfigSchema.parse(data.paths || data);
				logger.debug(`Project config loaded from ${configPath}`);
				return folders;
			}
		} catch (error) {
			logger.warning(
				`Failed to load project config from ${configPath}: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
		return null;
	}

	/**
	 * Save project-level config to .claude/.ck.json (local) or .ck.json (global)
	 * @param projectDir - The project directory
	 * @param folders - Folder configuration to save
	 * @param global - If true, save directly to projectDir/.ck.json (for global mode where projectDir is ~/.claude)
	 */
	static async saveProjectConfig(
		projectDir: string,
		folders: FoldersConfig,
		global = false,
	): Promise<void> {
		// In global mode, projectDir is already ~/.claude, so save directly there
		// In local mode, save to projectDir/.claude/.ck.json
		const configDir = global ? projectDir : join(projectDir, ".claude");
		const configPath = join(configDir, PROJECT_CONFIG_FILE);
		try {
			// Ensure config directory exists
			if (!existsSync(configDir)) {
				await mkdir(configDir, { recursive: true });
			}
			const validFolders = FoldersConfigSchema.parse(folders);
			await writeFile(configPath, JSON.stringify({ paths: validFolders }, null, 2), "utf-8");
			logger.debug(`Project config saved to ${configPath}`);
		} catch (error) {
			throw new Error(
				`Failed to save project config: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Resolve folder configuration from multiple sources (priority order):
	 * 1. CLI flags (--docs-dir, --plans-dir)
	 * 2. Project config (.claude/.ck.json)
	 * 3. Global config (~/.claude/.ck.json)
	 * 4. Defaults (docs, plans)
	 */
	static async resolveFoldersConfig(
		projectDir: string,
		cliOptions?: { docsDir?: string; plansDir?: string },
	): Promise<Required<FoldersConfig>> {
		// Start with defaults
		const result: Required<FoldersConfig> = { ...DEFAULT_FOLDERS };

		// Layer 3: Global config
		const globalConfig = await ConfigManager.load();
		if (globalConfig.folders?.docs) result.docs = globalConfig.folders.docs;
		if (globalConfig.folders?.plans) result.plans = globalConfig.folders.plans;

		// Layer 2: Project config
		const projectConfig = await ConfigManager.loadProjectConfig(projectDir);
		if (projectConfig?.docs) result.docs = projectConfig.docs;
		if (projectConfig?.plans) result.plans = projectConfig.plans;

		// Layer 1: CLI flags (highest priority)
		if (cliOptions?.docsDir) result.docs = cliOptions.docsDir;
		if (cliOptions?.plansDir) result.plans = cliOptions.plansDir;

		return result;
	}

	/**
	 * Check if project-level config exists
	 * @param projectDir - The project directory
	 * @param global - If true, check projectDir/.ck.json (for global mode where projectDir is ~/.claude)
	 */
	static projectConfigExists(projectDir: string, global = false): boolean {
		const configDir = global ? projectDir : join(projectDir, ".claude");
		return existsSync(join(configDir, PROJECT_CONFIG_FILE));
	}
}
