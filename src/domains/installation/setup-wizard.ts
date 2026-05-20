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

/**
 * Required environment keys that must be present for ClaudeKit to function
 * Easy to extend with additional keys in the future
 */
export interface RequiredEnvKey {
	key: string;
	label: string;
	alternativeKeys?: string[];
}

export type ImageGenProvider = "auto" | "google" | "openrouter" | "minimax";

export const IMAGE_PROVIDER_ENV_KEYS = [
	"GEMINI_API_KEY",
	"OPENROUTER_API_KEY",
	"MINIMAX_API_KEY",
] as const;

type ImageProviderEnvKey = (typeof IMAGE_PROVIDER_ENV_KEYS)[number];

const IMAGE_PROVIDER_KEY_MAP = {
	GEMINI_API_KEY: "google",
	OPENROUTER_API_KEY: "openrouter",
	MINIMAX_API_KEY: "minimax",
} as const satisfies Record<ImageProviderEnvKey, Exclude<ImageGenProvider, "auto">>;

const IMAGE_PROVIDER_VALIDATION_PATTERNS = {
	GEMINI_API_KEY: VALIDATION_PATTERNS.GEMINI_API_KEY,
	OPENROUTER_API_KEY: VALIDATION_PATTERNS.OPENROUTER_API_KEY,
	MINIMAX_API_KEY: VALIDATION_PATTERNS.MINIMAX_API_KEY,
} as const satisfies Record<ImageProviderEnvKey, RegExp>;

const IMAGE_PROVIDER_META: Record<ImageGenProvider, { label: string; hint: string }> = {
	auto: {
		label: "Auto-detect provider",
		hint: "Prefer Gemini when configured; otherwise fall back through your remaining provider path",
	},
	google: {
		label: "Google Gemini",
		hint: "Best fit when you want Gemini analysis plus Google image generation",
	},
	openrouter: {
		label: "OpenRouter",
		hint: "Use routed image models through OpenRouter",
	},
	minimax: {
		label: "MiniMax",
		hint: "Use MiniMax as the default image/media provider path",
	},
};

export const REQUIRED_ENV_KEYS: RequiredEnvKey[] = [
	{
		key: "IMAGE_PROVIDER_API_KEY",
		label: "Image generation provider API key",
		alternativeKeys: [...IMAGE_PROVIDER_ENV_KEYS],
	},
];

export interface RequiredKeysCheckResult {
	allPresent: boolean;
	missing: RequiredEnvKey[];
	envExists: boolean;
	configuredProviders: Exclude<ImageGenProvider, "auto">[];
}

function isImageProviderEnvKey(key: string): key is ImageProviderEnvKey {
	return (IMAGE_PROVIDER_ENV_KEYS as readonly string[]).includes(key);
}

function hasValidImageProviderValue(key: ImageProviderEnvKey, value?: string): boolean {
	if (!value || value.trim() === "") {
		return false;
	}

	return validateApiKey(value.trim(), IMAGE_PROVIDER_VALIDATION_PATTERNS[key]);
}

/**
 * Check if required environment keys exist in .env file
 * Returns which keys are missing (if any)
 */
export async function checkRequiredKeysExist(envPath: string): Promise<RequiredKeysCheckResult> {
	const envExists = await pathExists(envPath);

	if (!envExists) {
		return {
			allPresent: false,
			missing: REQUIRED_ENV_KEYS,
			envExists: false,
			configuredProviders: [],
		};
	}

	const env = await parseEnvFile(envPath);
	const configuredProviders = getConfiguredImageProviders(env);
	const missing: RequiredEnvKey[] = [];

	for (const required of REQUIRED_ENV_KEYS) {
		const candidateKeys = required.alternativeKeys ?? [required.key];
		const hasConfiguredValue = candidateKeys.some((candidateKey) => {
			if (isImageProviderEnvKey(candidateKey)) {
				return hasValidImageProviderValue(candidateKey, env[candidateKey]);
			}

			const value = env[candidateKey];
			return !!value && value.trim() !== "";
		});
		if (!hasConfiguredValue) {
			missing.push(required);
		}
	}

	return {
		allPresent: missing.length === 0,
		missing,
		envExists: true,
		configuredProviders,
	};
}

export function getConfiguredImageProviders(
	env: Record<string, string>,
): Exclude<ImageGenProvider, "auto">[] {
	return IMAGE_PROVIDER_ENV_KEYS.filter((key) => hasValidImageProviderValue(key, env[key])).map(
		(key) => IMAGE_PROVIDER_KEY_MAP[key],
	);
}

export function getDefaultImageProviderSelection(
	configuredProviders: readonly Exclude<ImageGenProvider, "auto">[],
	existingPreference?: string,
): ImageGenProvider {
	if (
		existingPreference &&
		validateApiKey(existingPreference, VALIDATION_PATTERNS.IMAGE_GEN_PROVIDER)
	) {
		if (existingPreference === "auto" && configuredProviders.includes("google")) {
			return "auto";
		}
		if (configuredProviders.includes(existingPreference as Exclude<ImageGenProvider, "auto">)) {
			return existingPreference as Exclude<ImageGenProvider, "auto">;
		}
	}

	if (configuredProviders.includes("google")) {
		return "auto";
	}

	return configuredProviders[0] ?? "auto";
}

interface ConfigPrompt {
	key: string;
	label: string;
	hint: string;
	validate?: RegExp;
	mask?: boolean;
}

const ESSENTIAL_CONFIGS: ConfigPrompt[] = [
	{
		key: "GEMINI_API_KEY",
		label: "Google Gemini API Key",
		hint: "Optional. Recommended for full ai-multimodal analysis and Google image generation.",
		validate: VALIDATION_PATTERNS.GEMINI_API_KEY,
		mask: true,
	},
	{
		key: "OPENROUTER_API_KEY",
		label: "OpenRouter API Key",
		hint: "Optional. Alternative image-generation provider. Get from: https://openrouter.ai/settings/keys",
		validate: VALIDATION_PATTERNS.OPENROUTER_API_KEY,
		mask: true,
	},
	{
		key: "MINIMAX_API_KEY",
		label: "MiniMax API Key",
		hint: "Optional. Alternative image/video/speech/music provider.",
		validate: VALIDATION_PATTERNS.MINIMAX_API_KEY,
		mask: true,
	},
	{
		key: "DISCORD_WEBHOOK_URL",
		label: "Discord Webhook URL (optional)",
		hint: "For Discord notifications. Leave empty to skip.",
		validate: VALIDATION_PATTERNS.DISCORD_WEBHOOK_URL,
		mask: false,
	},
	{
		key: "TELEGRAM_BOT_TOKEN",
		label: "Telegram Bot Token (optional)",
		hint: "For Telegram notifications. Leave empty to skip.",
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
				// Trim final value to handle whitespace-only values like `KEY=" "`
				env[key.trim()] = value.trim();
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

	clack.log.info(
		"Configure at least one image-generation provider. Leave unused provider fields blank.",
	);

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
			validate: (value: string) => {
				if (!value) {
					return;
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

	const configuredProviders = getConfiguredImageProviders(values);
	if (configuredProviders.length === 0) {
		clack.log.error(
			"At least one image-generation provider key is required: GEMINI_API_KEY, OPENROUTER_API_KEY, or MINIMAX_API_KEY.",
		);
		return false;
	}

	// Prompt for additional Gemini API keys if primary key was set
	if (values.GEMINI_API_KEY) {
		const additionalKeys = await promptForAdditionalGeminiKeys(values.GEMINI_API_KEY);
		// Add additional keys with indexed names
		for (let i = 0; i < additionalKeys.length; i++) {
			values[`GEMINI_API_KEY_${i + 2}`] = additionalKeys[i];
		}

		// Show summary
		const totalKeys = 1 + additionalKeys.length;
		if (totalKeys > 1) {
			clack.log.success(`✓ Configured ${totalKeys} Gemini API keys for rotation`);
		}
	}

	if (configuredProviders.length === 1) {
		const [onlyProvider] = configuredProviders;
		if (onlyProvider !== "google") {
			values.IMAGE_GEN_PROVIDER = onlyProvider;
			clack.log.info(
				`Set IMAGE_GEN_PROVIDER=${onlyProvider} to match your configured provider path`,
			);
		} else {
			clack.log.info("Using auto mode for Gemini (default; no IMAGE_GEN_PROVIDER needed)");
		}
	} else {
		const selectedProvider = await clack.select<
			{ value: ImageGenProvider; label: string; hint: string }[],
			ImageGenProvider
		>({
			message: "Which image-generation provider should ClaudeKit prefer by default?",
			options: [
				{
					value: "auto",
					label: IMAGE_PROVIDER_META.auto.label,
					hint: IMAGE_PROVIDER_META.auto.hint,
				},
				...configuredProviders.map((provider) => ({
					value: provider,
					label: IMAGE_PROVIDER_META[provider].label,
					hint: IMAGE_PROVIDER_META[provider].hint,
				})),
			],
			initialValue: getDefaultImageProviderSelection(
				configuredProviders,
				globalEnv.IMAGE_GEN_PROVIDER,
			),
		});

		if (clack.isCancel(selectedProvider)) {
			clack.log.warning("Setup cancelled");
			return false;
		}

		values.IMAGE_GEN_PROVIDER = selectedProvider;
		clack.log.info(`Set IMAGE_GEN_PROVIDER=${selectedProvider}`);
	}

	// Generate .env file
	await generateEnvFile(targetDir, values);
	clack.log.success(`Configuration saved to ${join(targetDir, ".env")}`);

	return true;
}

/**
 * Prompt user to add additional Gemini API keys for rotation
 * Returns array of additional keys (empty if user declines or cancels)
 */
async function promptForAdditionalGeminiKeys(primaryKey: string): Promise<string[]> {
	const additionalKeys: string[] = [];
	const allKeys = new Set<string>([primaryKey]); // Track all keys for duplicate detection

	// Ask if user wants to add more keys
	const wantMore = await clack.confirm({
		message: "Add additional API keys for rotation? (recommended for high usage)",
		initialValue: false,
	});

	if (clack.isCancel(wantMore) || !wantMore) {
		return additionalKeys;
	}

	// Loop to collect additional keys
	let keyNumber = 2;
	const maxKeys = 10; // Reasonable limit

	while (keyNumber <= maxKeys) {
		const result = await clack.text({
			message: `Gemini API Key #${keyNumber} (press Enter to finish)`,
			placeholder: "AIza... or leave empty to finish",
			validate: (value: string) => {
				// Empty = done adding keys
				if (!value) return;
				// Trim whitespace (handles copy-paste issues)
				const trimmed = value.trim();
				if (!trimmed) return;
				// Validate format
				if (!validateApiKey(trimmed, VALIDATION_PATTERNS.GEMINI_API_KEY)) {
					return "Invalid format. Gemini keys start with 'AIza' and are 39 characters.";
				}
				// Check for duplicates
				if (allKeys.has(trimmed)) {
					return "This key was already added. Please enter a different key.";
				}
				return;
			},
		});

		if (clack.isCancel(result)) {
			// User cancelled, return what we have so far
			break;
		}

		// Empty string means done
		if (!result || result.trim() === "") {
			break;
		}

		const trimmedKey = result.trim();
		additionalKeys.push(trimmedKey);
		allKeys.add(trimmedKey);
		keyNumber++;
	}

	return additionalKeys;
}

/**
 * Options for prompting user to set up required environment keys
 */
export interface PromptSetupWizardOptions {
	envPath: string;
	claudeDir: string;
	isGlobal: boolean;
	isNonInteractive: boolean;
	prompts: {
		confirm: (message: string) => Promise<boolean>;
		note: (message: string, title?: string) => void;
	};
}

/**
 * Shared helper to prompt user for setup wizard if required keys are missing
 * Used by both `ck init` and `ck new` commands to reduce duplication
 */
export async function promptSetupWizardIfNeeded(options: PromptSetupWizardOptions): Promise<void> {
	const { envPath, claudeDir, isGlobal, isNonInteractive, prompts } = options;

	if (isNonInteractive) {
		return;
	}

	const { allPresent, missing, envExists } = await checkRequiredKeysExist(envPath);

	if (allPresent) {
		return;
	}

	// Different prompt message based on whether .env exists
	const missingKeys = missing.map((m) => m.label).join(", ");
	const promptMessage = envExists
		? `Missing required: ${missingKeys}. Set up now?`
		: "Set up API keys now? (Choose Gemini, OpenRouter, or MiniMax for ai-multimodal image generation, then optionally set a preferred provider; webhooks optional)";

	const shouldSetup = await prompts.confirm(promptMessage);
	if (shouldSetup) {
		await runSetupWizard({
			targetDir: claudeDir,
			isGlobal,
		});
	} else {
		prompts.note(
			`Create ${envPath} manually or run 'ck init' again.\nRequired: one of GEMINI_API_KEY, OPENROUTER_API_KEY, MINIMAX_API_KEY\nOptional: IMAGE_GEN_PROVIDER, DISCORD_WEBHOOK_URL, TELEGRAM_BOT_TOKEN`,
			"Configuration skipped",
		);
	}
}
