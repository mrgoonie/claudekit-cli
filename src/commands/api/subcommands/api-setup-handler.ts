/**
 * Handler for `ck api setup` — interactive API key configuration
 */

import { homedir } from "node:os";
import { join } from "node:path";
import {
	isValidKeyFormat,
	readExistingApiKey,
	saveApiKey,
	validateApiKey,
} from "@/domains/api-key/index.js";
import { logger } from "@/shared/logger.js";
import * as p from "@clack/prompts";
import type { ApiSetupOptions } from "../types.js";

const DASHBOARD_URL = "https://claudekit.cc/api-keys";
const MAX_ATTEMPTS = 3;

export async function handleApiSetup(options: ApiSetupOptions): Promise<void> {
	const claudeDir = join(homedir(), ".claude");

	// Check existing key
	const existing = readExistingApiKey(claudeDir);
	if (existing && !options.force) {
		const masked = `${existing.slice(0, 15)}...`;
		logger.info(`Existing API key found: ${masked}`);
		logger.info("Use --force to replace it.");
		return;
	}

	// Non-interactive: --key flag
	if (options.key) {
		if (!isValidKeyFormat(options.key)) {
			logger.error("Invalid key format. Expected: ck_live_ followed by 32 characters.");
			process.exitCode = 1;
			return;
		}
		const result = await validateApiKey(options.key);
		if (!result.valid) {
			logger.error(result.error ?? "Invalid API key");
			process.exitCode = 1;
			return;
		}
		saveApiKey(claudeDir, options.key);
		logger.success("API key saved to ~/.claude/.env");
		return;
	}

	// Interactive flow
	p.intro("ClaudeKit API Key Setup");
	p.note(`Get your API key at: ${DASHBOARD_URL}`, "API Keys");

	let apiKey: string | null = null;
	let attempts = 0;

	while (!apiKey && attempts < MAX_ATTEMPTS) {
		attempts++;

		const input = await p.text({
			message: "Enter your ClaudeKit API key:",
			placeholder: "ck_live_...",
			validate(value) {
				if (!value?.trim()) return "API key is required";
				if (!isValidKeyFormat(value.trim()))
					return "Invalid format. Key should start with ck_live_ followed by 32 characters";
				return undefined;
			},
		});

		if (p.isCancel(input)) {
			p.cancel("Setup cancelled");
			return;
		}

		const trimmed = (input as string).trim();
		logger.info("Validating API key...");
		const result = await validateApiKey(trimmed);

		if (result.valid) {
			apiKey = trimmed;
			logger.success("API key validated successfully");
		} else {
			logger.error(result.error ?? "Invalid API key");
			if (attempts < MAX_ATTEMPTS) {
				const retry = await p.confirm({ message: "Try again?" });
				if (p.isCancel(retry) || !retry) {
					p.cancel("Setup cancelled");
					return;
				}
			}
		}
	}

	if (!apiKey) {
		logger.warning("Maximum attempts reached. Setup cancelled.");
		process.exitCode = 1;
		return;
	}

	saveApiKey(claudeDir, apiKey);
	p.outro("API key saved to ~/.claude/.env");
}
