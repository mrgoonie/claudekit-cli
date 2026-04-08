/**
 * Environment keys checker for ck doctor
 * Checks if required environment keys are present in .env files
 */

import { join } from "node:path";
import { checkRequiredKeysExist } from "@/domains/installation/setup-wizard.js";
import type { ClaudeKitSetup } from "@/types";
import type { CheckResult } from "../types.js";

const PROVIDER_REQUIREMENT_MESSAGE = "One supported image-generation provider key configured";
const PROVIDER_SETUP_SUGGESTION = "Run: ck init (configure Gemini, OpenRouter, or MiniMax)";

/**
 * Check required environment keys in .env files
 * Returns warnings for missing required keys
 */
export async function checkEnvKeys(setup: ClaudeKitSetup): Promise<CheckResult[]> {
	const results: CheckResult[] = [];

	// Check global .env
	if (setup.global.path) {
		const globalEnvPath = join(setup.global.path, ".env");
		const globalCheck = await checkRequiredKeysExist(globalEnvPath);

		if (!globalCheck.allPresent) {
			const missingKeys = globalCheck.missing.map((m) => m.label).join(", ");
			results.push({
				id: "ck-global-env-keys",
				name: "Global Environment Keys",
				group: "claudekit",
				priority: "standard",
				status: "warn",
				message: globalCheck.envExists ? `Missing: ${missingKeys}` : ".env file not found",
				details: globalEnvPath,
				suggestion: "Run: ck init --global (configure Gemini, OpenRouter, or MiniMax)",
				autoFixable: false,
			});
		} else {
			results.push({
				id: "ck-global-env-keys",
				name: "Global Environment Keys",
				group: "claudekit",
				priority: "standard",
				status: "pass",
				message: PROVIDER_REQUIREMENT_MESSAGE,
				details: globalEnvPath,
				autoFixable: false,
			});
		}
	}

	// Check project .env - only if it's a real ClaudeKit project (has metadata)
	if (setup.project.metadata) {
		const projectEnvPath = join(setup.project.path, ".env");
		const projectCheck = await checkRequiredKeysExist(projectEnvPath);

		if (!projectCheck.allPresent) {
			const missingKeys = projectCheck.missing.map((m) => m.label).join(", ");
			results.push({
				id: "ck-project-env-keys",
				name: "Project Environment Keys",
				group: "claudekit",
				priority: "standard",
				status: "warn",
				message: projectCheck.envExists ? `Missing: ${missingKeys}` : ".env file not found",
				details: projectEnvPath,
				suggestion: PROVIDER_SETUP_SUGGESTION,
				autoFixable: false,
			});
		} else {
			results.push({
				id: "ck-project-env-keys",
				name: "Project Environment Keys",
				group: "claudekit",
				priority: "standard",
				status: "pass",
				message: PROVIDER_REQUIREMENT_MESSAGE,
				details: projectEnvPath,
				autoFixable: false,
			});
		}
	}

	return results;
}
