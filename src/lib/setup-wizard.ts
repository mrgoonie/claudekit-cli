import { join } from "node:path";
import * as clack from "@clack/prompts";
import { pathExists, readFile } from "fs-extra";
import { PathResolver } from "../utils/path-resolver.js";
import { generateEnvFile } from "./config-generator.js";
import { VALIDATION_PATTERNS, validateApiKey } from "./config-validator.js";

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
 */
async function parseEnvFile(path: string): Promise<Record<string, string>> {
	const content = await readFile(path, "utf-8");
	const env: Record<string, string> = {};

	for (const line of content.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const [key, ...valueParts] = trimmed.split("=");
		if (key) {
			env[key.trim()] = valueParts.join("=").trim();
		}
	}

	return env;
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
	if (!isGlobal) {
		const globalEnvPath = join(PathResolver.getGlobalKitDir(), ".env");
		if (await pathExists(globalEnvPath)) {
			globalEnv = await parseEnvFile(globalEnvPath);
			if (Object.keys(globalEnv).length > 0) {
				clack.log.info("Global config found. Press Enter to inherit values.");
			}
		}
	}

	// Collect values
	const values: Record<string, string> = {};

	for (const config of ESSENTIAL_CONFIGS) {
		const defaultValue = globalEnv[config.key] || "";
		const maskedDefault =
			config.mask && defaultValue ? `${defaultValue.slice(0, 8)}...` : defaultValue;

		const result = await clack.text({
			message: config.label,
			placeholder: config.hint,
			initialValue: !isGlobal ? maskedDefault : "",
			validate: (value) => {
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

		// Use global value if user pressed Enter without typing (for local mode)
		// But only use inherited value if user didn't modify the masked default
		const userInput = result as string;
		let finalValue = userInput;

		// If in local mode and user entered the masked default, use the actual global value
		if (!isGlobal && userInput === maskedDefault && defaultValue) {
			finalValue = defaultValue;
		}
		// If no input and not required, check for global inheritance
		if (!userInput && !isGlobal && globalEnv[config.key]) {
			finalValue = globalEnv[config.key];
		}

		if (finalValue) {
			values[config.key] = finalValue;
		}
	}

	// Generate .env file
	await generateEnvFile(targetDir, values);
	clack.log.success(`Configuration saved to ${join(targetDir, ".env")}`);

	return true;
}
