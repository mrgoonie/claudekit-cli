import { BackupManager } from "@/domains/config/backup-manager.js";
import { ConfigManager } from "@/domains/config/config-manager.js";
import { ConfigSchemaWithDescriptions } from "@/domains/config/schema-descriptions.js";
import { PathResolver } from "@/shared/path-resolver.js";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import pc from "picocolors";

export async function setConfig(key: string, value: string, options: { global?: boolean }) {
	const isGlobal = options.global ?? false;

	// Parse value (boolean, number, or string)
	const parsedValue = parseValue(value);

	// Validate against schema before saving
	const validationResult = await validateConfigValue(key, parsedValue, isGlobal);
	if (!validationResult.valid) {
		console.error(pc.red(`Validation failed: ${validationResult.error}`));
		process.exitCode = 1;
		return;
	}

	if (isGlobal) {
		// Set in global config (~/.claudekit/config.json)
		ConfigManager.setGlobalFlag(true);
		const configFile = PathResolver.getConfigFile(true);

		// Ensure config dir exists
		const configDir = dirname(configFile);
		if (!existsSync(configDir)) {
			await mkdir(configDir, { recursive: true });
		}

		// Create backup
		const backupPath = await BackupManager.createBackup(configFile);
		if (backupPath) {
			console.log(pc.dim(`Backup created: ${backupPath}`));
		}

		await ConfigManager.set(key, parsedValue);
		console.log(pc.green(`Set ${key} = ${value} (global)`));
	} else {
		// Set in local config (.claude/.ck.json)
		const projectDir = process.cwd();
		const configDir = join(projectDir, ".claude");
		const configPath = join(configDir, ".ck.json");

		// Ensure .claude directory exists
		if (!existsSync(configDir)) {
			await mkdir(configDir, { recursive: true });
		}

		// Load existing or create new
		let config: Record<string, unknown> = {};
		if (existsSync(configPath)) {
			const content = await readFile(configPath, "utf-8");
			config = JSON.parse(content);

			// Create backup
			const backupPath = await BackupManager.createBackup(configPath);
			if (backupPath) {
				console.log(pc.dim(`Backup created: ${backupPath}`));
			}
		}

		// Set nested value
		setNestedValue(config, key, parsedValue);

		// Save
		await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
		console.log(pc.green(`Set ${key} = ${value} (local)`));
	}
}

function parseValue(value: string): unknown {
	if (value === "true") return true;
	if (value === "false") return false;
	if (!isNaN(Number(value))) return Number(value);
	return value;
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
	const keys = path.split(".");
	let current = obj;
	for (let i = 0; i < keys.length - 1; i++) {
		if (!(keys[i] in current)) current[keys[i]] = {};
		current = current[keys[i]] as Record<string, unknown>;
	}
	current[keys[keys.length - 1]] = value;
}

/**
 * Validate config value against schema
 */
async function validateConfigValue(
	key: string,
	value: unknown,
	isGlobal: boolean,
): Promise<{ valid: boolean; error?: string }> {
	try {
		// Load existing config
		const configFile = isGlobal
			? PathResolver.getConfigFile(true)
			: join(process.cwd(), ".claude", ".ck.json");

		let config: Record<string, unknown> = {};
		if (existsSync(configFile)) {
			const content = await readFile(configFile, "utf-8");
			config = JSON.parse(content);
		}

		// Apply the new value
		const testConfig = { ...config };
		setNestedValue(testConfig, key, value);

		// Validate against schema
		const result = ConfigSchemaWithDescriptions.safeParse(testConfig);
		if (!result.success) {
			const firstError = result.error.issues[0];
			return { valid: false, error: `${firstError.path.join(".")}: ${firstError.message}` };
		}

		return { valid: true };
	} catch (error) {
		return {
			valid: false,
			error: error instanceof Error ? error.message : "Unknown validation error",
		};
	}
}
