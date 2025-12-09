import { join } from "node:path";
import { generateEnvFile } from "@/domains/config/config-generator.js";
import { VALIDATION_PATTERNS, validateApiKey } from "@/domains/config/config-validator.js";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
import * as clack from "@clack/prompts";
import { pathExists, readFile } from "fs-extra";

export interface SetupWizardOptions {
	targetDir: string;
	isGlobal: boolean;
}

interface ConfigPrompt {
	key: string;
	label: string;
	hint: string;
	required: boolean;
	validate?: RegExp;
	mask?: boolean;
}

const ESSENTIAL_CONFIGS: ConfigPrompt[] = [
	{
		key: "GEMINI_API_KEY",
		label: "Google Gemini API Key",
		hint: "Required for ai-multimodal skill. Get from: https://aistudio.google.com/apikey",
		required: true,
		validate: VALIDATION_PATTERNS.GEMINI_API_KEY,
		mask: true,
	},
	{
		key: "DISCORD_WEBHOOK_URL",
		label: "Discord Webhook URL (optional)",
		hint: "For Discord notifications. Leave empty to skip.",
		required: false,
		validate: VALIDATION_PATTERNS.DISCORD_WEBHOOK_URL,
		mask: false,
	},
	{
		key: "TELEGRAM_BOT_TOKEN",
		label: "Telegram Bot Token (optional)",
		hint: "For Telegram notifications. Leave empty to skip.",
		required: false,
		validate: VALIDATION_PATTERNS.TELEGRAM_BOT_TOKEN,
		mask: true,
	},
];

/**
 * Parse an .env file and return key-value pairs
 * Handles: comments, quoted values (single/double), export prefix
 */
async function parseEnvFile(path: string): Promise<Record<string, string>> {
	try {
		const content = await readFile(path, "utf-8");
		const env: Record<string, string> = {};

		for (const line of content.split("\n")) {
			let trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) continue;

			// Strip 'export ' prefix if present
			if (trimmed.startsWith("export ")) {
				trimmed = trimmed.slice(7);
			}

			const [key, ...valueParts] = trimmed.split("=");
			if (key) {
				let value = valueParts.join("=").trim();
				// Strip surrounding quotes (single or double)
				if (
					(value.startsWith('"') && value.endsWith('"')) ||
					(value.startsWith("'") && value.endsWith("'"))
				) {
					value = value.slice(1, -1);
				}
				env[key.trim()] = value;
			}
		}

		return env;
	} catch (error) {
		logger.debug(`Failed to parse .env file at ${path}: ${error}`);
		return {};
	}
}

/**
 * Check if global config exists and has values
 */
async function checkGlobalConfig(): Promise<boolean> {
	const globalEnvPath = join(PathResolver.getGlobalKitDir(), ".env");
	if (!(await pathExists(globalEnvPath))) return false;
	const env = await parseEnvFile(globalEnvPath);
	return Object.keys(env).length > 0;
}

/**
 * Run the interactive setup wizard to configure essential values
 *
 * @returns true if setup completed, false if cancelled
 */
export async function runSetupWizard(options: SetupWizardOptions): Promise<boolean> {
	const { targetDir, isGlobal } = options;

	// Show mode-specific message
	if (isGlobal) {
		clack.log.info("Configuring global defaults (shared across all projects)");
	} else {
		clack.log.info("Configuring project-specific settings");
	}

	// Load existing global config for inheritance in local mode
	let globalEnv: Record<string, string> = {};
	const hasGlobalConfig = !isGlobal && (await checkGlobalConfig());

	if (!isGlobal) {
		const globalEnvPath = join(PathResolver.getGlobalKitDir(), ".env");
		if (await pathExists(globalEnvPath)) {
			globalEnv = await parseEnvFile(globalEnvPath);
		}
	}

	// Show inheritance info only if global config has relevant values
	if (hasGlobalConfig && Object.keys(globalEnv).length > 0) {
		clack.log.success("Global config detected - values will be inherited automatically");
	}

	// Collect values
	const values: Record<string, string> = {};

	for (const config of ESSENTIAL_CONFIGS) {
		const globalValue = globalEnv[config.key] || "";
		const hasGlobalValue = !isGlobal && !!globalValue;

		// For local mode with global value: show inheritance option first
		if (hasGlobalValue) {
			const maskedValue = config.mask ? `${globalValue.slice(0, 8)}...` : globalValue;
			const useGlobal = await clack.confirm({
				message: `${config.label}: Use global value? (${maskedValue})`,
				initialValue: true, // Default to YES - inherit global config
			});

			if (clack.isCancel(useGlobal)) {
				clack.log.warning("Setup cancelled");
				return false;
			}

			if (useGlobal) {
				values[config.key] = globalValue;
				clack.log.success(`${config.key}: inherited from global config`);
				continue; // Skip to next config
			}
			// User chose not to inherit, fall through to manual input
		}

		// Manual input (global mode OR user chose not to inherit)
		const result = await clack.text({
			message: config.label,
			placeholder: config.hint,
			validate: (value) => {
				// Skip validation for optional fields with empty input
				if (!value && !config.required) {
					return;
				}
				if (!value && config.required) {
					return "This field is required";
				}
				if (value && config.validate && !validateApiKey(value, config.validate)) {
					return "Invalid format. Please check and try again.";
				}
				return;
			},
		});

		if (clack.isCancel(result)) {
			clack.log.warning("Setup cancelled");
			return false;
		}

		// Type guard: after isCancel check, result is string
		if (typeof result === "string" && result) {
			values[config.key] = result;
		}
	}

	// Generate .env file
	await generateEnvFile(targetDir, values);
	clack.log.success(`Configuration saved to ${join(targetDir, ".env")}`);

	return true;
}
