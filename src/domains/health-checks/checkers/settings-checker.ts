import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
import type { CheckResult } from "../types.js";

/**
 * Check if settings.json has valid JSON structure
 */
export async function checkSettingsValid(projectDir: string): Promise<CheckResult> {
	const globalSettings = join(PathResolver.getGlobalKitDir(), "settings.json");
	const projectSettings = join(projectDir, ".claude", "settings.json");

	// Check global first, then project
	const settingsPath = existsSync(globalSettings)
		? globalSettings
		: existsSync(projectSettings)
			? projectSettings
			: null;

	if (!settingsPath) {
		return {
			id: "ck-settings-valid",
			name: "Settings.json",
			group: "claudekit",
			priority: "extended",
			status: "info",
			message: "No settings.json found",
			autoFixable: false,
		};
	}

	try {
		const content = await readFile(settingsPath, "utf-8");
		JSON.parse(content); // Validate JSON

		return {
			id: "ck-settings-valid",
			name: "Settings.json",
			group: "claudekit",
			priority: "extended",
			status: "pass",
			message: "Valid JSON",
			details: settingsPath,
			autoFixable: false,
		};
	} catch (error) {
		// Distinguish between different error types for better debugging
		let message = "Invalid JSON";
		let suggestion = "Fix JSON syntax in settings.json";
		let details = settingsPath;

		if (error instanceof SyntaxError) {
			message = "JSON syntax error";
			details = `${settingsPath}: ${error.message}`;
			logger.verbose("Settings.json syntax error", {
				path: settingsPath,
				error: error.message,
			});
		} else if (error instanceof Error) {
			if (error.message.includes("EACCES") || error.message.includes("EPERM")) {
				message = "Permission denied";
				suggestion = "Check file permissions on settings.json";
			} else if (error.message.includes("ENOENT")) {
				message = "File not found";
				suggestion = "Ensure settings.json exists at the expected location";
			} else {
				message = `Read error: ${error.message}`;
				suggestion = "Check file system and permissions";
			}
			logger.verbose("Settings.json read error", {
				path: settingsPath,
				error: error.message,
				code: (error as any).code,
			});
		}

		return {
			id: "ck-settings-valid",
			name: "Settings.json",
			group: "claudekit",
			priority: "extended",
			status: "fail",
			message,
			details,
			suggestion,
			autoFixable: false,
		};
	}
}
