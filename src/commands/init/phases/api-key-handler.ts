/**
 * API key setup phase
 * Prompts for ClaudeKit API key during init flow
 */

import {
	isValidKeyFormat,
	readExistingApiKey,
	saveApiKey,
	validateApiKey,
} from "@/domains/api-key/index.js";
import { logger } from "@/shared/logger.js";
import type { InitContext } from "../types.js";

const MAX_ATTEMPTS = 3;
const DASHBOARD_URL = "https://claudekit.cc/api-keys";

/**
 * Handle ClaudeKit API key setup
 */
export async function handleApiKeySetup(ctx: InitContext): Promise<InitContext> {
	if (ctx.cancelled || !ctx.claudeDir) {
		return ctx;
	}

	// Check for existing key
	const existingKey = readExistingApiKey(ctx.claudeDir);

	if (existingKey) {
		const maskedKey = `${existingKey.slice(0, 15)}...`;
		logger.info(`Existing ClaudeKit API key found: ${maskedKey}`);

		if (ctx.isNonInteractive) {
			logger.info("Using existing API key (non-interactive mode)");
			return { ...ctx, apiKeyConfigured: true };
		}

		const keepExisting = await ctx.prompts.confirm("Keep existing ClaudeKit API key?");

		if (keepExisting) {
			return { ...ctx, apiKeyConfigured: true };
		}
	}

	// Show setup info
	ctx.prompts.note(
		`API keys enable access to ClaudeKit services (VidCap, ReviewWeb, etc.)\nGet your API key at: ${DASHBOARD_URL}`,
		"ClaudeKit API Key Setup",
	);

	// Skip in non-interactive mode
	if (ctx.isNonInteractive) {
		logger.info("Skipping API key setup (non-interactive mode)");
		return { ...ctx, apiKeyConfigured: false };
	}

	// Prompt to set up
	const setupApiKey = await ctx.prompts.confirm("Would you like to set up a ClaudeKit API key?");

	if (!setupApiKey) {
		logger.info("Skipping API key setup. You can add it later in .claude/.env");
		return { ...ctx, apiKeyConfigured: false };
	}

	// Prompt for API key with validation
	let apiKey: string | null = null;
	let attempts = 0;

	while (!apiKey && attempts < MAX_ATTEMPTS) {
		attempts++;

		const inputKey = await ctx.prompts.text("Enter your ClaudeKit API key:", "ck_live_...");

		if (!inputKey?.trim()) {
			logger.warning("API key is required (or skip setup)");
			continue;
		}

		const trimmedKey = inputKey.trim();

		// Validate format first
		if (!isValidKeyFormat(trimmedKey)) {
			logger.error("Invalid format. Key should start with ck_live_ followed by 32 characters");
			continue;
		}

		// Validate against API
		logger.info("Validating API key...");
		const result = await validateApiKey(trimmedKey);

		if (result.valid) {
			apiKey = trimmedKey;
			logger.success("API key validated successfully");
		} else {
			logger.error(result.error || "Invalid API key");

			if (attempts < MAX_ATTEMPTS) {
				const retry = await ctx.prompts.confirm("Would you like to try again?");

				if (!retry) {
					logger.info("Skipping API key setup");
					return { ...ctx, apiKeyConfigured: false };
				}
			}
		}
	}

	if (!apiKey) {
		logger.warning("Maximum attempts reached. Skipping API key setup.");
		return { ...ctx, apiKeyConfigured: false };
	}

	// Save to .env
	saveApiKey(ctx.claudeDir, apiKey);
	logger.success("API key saved to .claude/.env");

	return { ...ctx, apiKeyConfigured: true };
}
