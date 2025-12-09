import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { chmod } from "node:fs/promises";
import { platform } from "node:os";
import { join } from "node:path";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
import {
	type Config,
	ConfigSchema,
	DEFAULT_FOLDERS,
	type FoldersConfig,
	FoldersConfigSchema,
} from "@/types";

// Project-level config file name
const PROJECT_CONFIG_FILE = ".ck.json";

export class ConfigManager {
	private static config: Config | null = null;
	private static globalFlag = false;

	/**
	 * Get the project config directory path based on global mode.
	 * - In global mode: projectDir itself (e.g., ~/.claude)
	 * - In local mode: projectDir/.claude (e.g., ./my-project/.claude)
	 *
	 * @param projectDir - The project directory. In global mode, this is ~/.claude. In local mode, this is the project root.
	 * @param global - If true, return projectDir directly. If false, return projectDir/.claude
	 */
	private static getProjectConfigDir(projectDir: string, global: boolean): string {
		return global ? projectDir : join(projectDir, ".claude");
	}

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
	 * Load project-level config from .claude/.ck.json (local) or .ck.json (global).
	 * Returns null if no project config exists.
	 *
	 * @param projectDir - The project directory. In global mode, this should be ~/.claude.
	 *                     In local mode, this is the project root directory.
	 * @param global - If true, load from projectDir/.ck.json (treats projectDir as ~/.claude).
	 *                 If false, load from projectDir/.claude/.ck.json (default).
	 * @returns The folder configuration or null if not found
	 */
	static async loadProjectConfig(
		projectDir: string,
		global = false,
	): Promise<FoldersConfig | null> {
		const configDir = ConfigManager.getProjectConfigDir(projectDir, global);
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
	 * Save project-level config to .claude/.ck.json (local) or .ck.json (global).
	 *
	 * @param projectDir - The project directory. In global mode, this should be ~/.claude.
	 *                     In local mode, this is the project root directory.
	 * @param folders - Folder configuration to save (docs and plans directory names)
	 * @param global - If true, save to projectDir/.ck.json (treats projectDir as ~/.claude).
	 *                 If false, save to projectDir/.claude/.ck.json (default).
	 */
	static async saveProjectConfig(
		projectDir: string,
		folders: FoldersConfig,
		global = false,
	): Promise<void> {
		const configDir = ConfigManager.getProjectConfigDir(projectDir, global);
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
	 * 2. Project config (.claude/.ck.json or ~/.claude/.ck.json in global mode)
	 * 3. Global config (~/.claudekit/config.json folders section)
	 * 4. Defaults (docs, plans)
	 * @param projectDir - The project directory
	 * @param cliOptions - CLI options for docs and plans directories
	 * @param global - If true, load project config from projectDir/.ck.json (for global mode)
	 */
	static async resolveFoldersConfig(
		projectDir: string,
		cliOptions?: { docsDir?: string; plansDir?: string },
		global = false,
	): Promise<Required<FoldersConfig>> {
		// Start with defaults
		const result: Required<FoldersConfig> = { ...DEFAULT_FOLDERS };

		// Layer 3: Global config from ~/.claudekit/config.json
		const globalConfig = await ConfigManager.load();
		if (globalConfig.folders?.docs) result.docs = globalConfig.folders.docs;
		if (globalConfig.folders?.plans) result.plans = globalConfig.folders.plans;

		// Layer 2: Project config (respects global flag for path resolution)
		const projectConfig = await ConfigManager.loadProjectConfig(projectDir, global);
		if (projectConfig?.docs) result.docs = projectConfig.docs;
		if (projectConfig?.plans) result.plans = projectConfig.plans;

		// Layer 1: CLI flags (highest priority)
		if (cliOptions?.docsDir) result.docs = cliOptions.docsDir;
		if (cliOptions?.plansDir) result.plans = cliOptions.plansDir;

		return result;
	}

	/**
	 * Check if project-level config exists.
	 *
	 * @param projectDir - The project directory. In global mode, this should be ~/.claude.
	 *                     In local mode, this is the project root directory.
	 * @param global - If true, check projectDir/.ck.json (treats projectDir as ~/.claude).
	 *                 If false, check projectDir/.claude/.ck.json (default).
	 * @returns true if the config file exists
	 */
	static projectConfigExists(projectDir: string, global = false): boolean {
		const configDir = ConfigManager.getProjectConfigDir(projectDir, global);
		return existsSync(join(configDir, PROJECT_CONFIG_FILE));
	}

	/**
	 * Migrate .ck.json from nested location to correct location in global mode.
	 * This fixes the bug where .ck.json was incorrectly created at ~/.claude/.claude/.ck.json
	 * instead of ~/.claude/.ck.json
	 *
	 * @param globalDir - The global kit directory (typically ~/.claude)
	 * @returns true if migration was performed, false otherwise
	 */
	static async migrateNestedConfig(globalDir: string): Promise<boolean> {
		const correctPath = join(globalDir, PROJECT_CONFIG_FILE);
		const incorrectPath = join(globalDir, ".claude", PROJECT_CONFIG_FILE);

		// If correct config already exists, don't migrate (preserve user's config)
		if (existsSync(correctPath)) {
			logger.debug("Config already exists at correct location, skipping migration");
			return false;
		}

		// If incorrect nested config exists, migrate it
		if (existsSync(incorrectPath)) {
			try {
				logger.info("Migrating .ck.json from nested location to correct location...");
				await rename(incorrectPath, correctPath);
				logger.success(`Migrated ${PROJECT_CONFIG_FILE} to ${correctPath}`);

				// Clean up empty .claude directory if it's now empty
				const nestedClaudeDir = join(globalDir, ".claude");
				try {
					await rm(nestedClaudeDir, { recursive: false });
					logger.debug("Removed empty nested .claude directory");
				} catch (rmError) {
					// Directory not empty or other error - this is expected if user has other files there
					logger.debug(
						`Could not remove nested .claude dir (may contain other files): ${rmError instanceof Error ? rmError.message : "Unknown"}`,
					);
				}

				return true;
			} catch (error) {
				logger.warning(
					`Failed to migrate config: ${error instanceof Error ? error.message : "Unknown error"}`,
				);
				return false;
			}
		}

		return false;
	}
}
