/**
 * Gemini MCP configuration management
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { logger } from "@/shared/logger.js";
import type { GeminiLinkResult } from "./linker-core.js";

/**
 * Read and parse JSON file safely
 * Returns null on failure with debug logging for troubleshooting
 */
export async function readJsonFile(filePath: string): Promise<Record<string, unknown> | null> {
	try {
		const content = await readFile(filePath, "utf-8");
		return JSON.parse(content);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		logger.debug(`Failed to read/parse JSON file ${filePath}: ${errorMessage}`);
		return null;
	}
}

/**
 * Add .gemini/ to .gitignore if not already present
 */
export async function addGeminiToGitignore(projectDir: string): Promise<void> {
	const gitignorePath = join(projectDir, ".gitignore");
	const geminiPattern = ".gemini/";

	try {
		let content = "";

		if (existsSync(gitignorePath)) {
			content = await readFile(gitignorePath, "utf-8");

			// Check if .gemini/ is already in gitignore (exclude commented lines)
			const lines = content
				.split("\n")
				.map((line) => line.trim())
				.filter((line) => !line.startsWith("#")); // Exclude comments
			const geminiPatterns = [".gemini/", ".gemini", "/.gemini/", "/.gemini"];

			if (lines.some((line) => geminiPatterns.includes(line))) {
				logger.debug(".gemini/ already in .gitignore");
				return;
			}
		}

		// Append .gemini/ to gitignore
		const newLine = content.endsWith("\n") || content === "" ? "" : "\n";
		const comment = "# Gemini CLI settings (contains user-specific config)";
		await writeFile(gitignorePath, `${content}${newLine}${comment}\n${geminiPattern}\n`, "utf-8");

		logger.debug(`Added ${geminiPattern} to .gitignore`);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		logger.warning(`Failed to update .gitignore: ${errorMessage}`);
	}
}

/**
 * Create new Gemini settings file with mcpServers from MCP config
 * Used as Windows fallback when symlink creation fails (no admin rights)
 */
export async function createNewSettingsWithMerge(
	geminiSettingsPath: string,
	mcpConfigPath: string,
): Promise<GeminiLinkResult> {
	// Ensure parent directory exists
	const linkDir = dirname(geminiSettingsPath);
	if (!existsSync(linkDir)) {
		await mkdir(linkDir, { recursive: true });
		logger.debug(`Created directory: ${linkDir}`);
	}

	// Read MCP config
	const mcpConfig = await readJsonFile(mcpConfigPath);
	if (!mcpConfig) {
		return { success: false, method: "merge", error: "Failed to read MCP config" };
	}

	// Extract mcpServers from MCP config (must be object, not array)
	const mcpServers = mcpConfig.mcpServers;
	if (!mcpServers || typeof mcpServers !== "object" || Array.isArray(mcpServers)) {
		return { success: false, method: "merge", error: "MCP config has no valid mcpServers object" };
	}

	// Create new settings file with just mcpServers
	const newSettings = { mcpServers };

	try {
		await writeFile(geminiSettingsPath, JSON.stringify(newSettings, null, 2), "utf-8");
		logger.debug(`Created new Gemini settings with mcpServers: ${geminiSettingsPath}`);
		return { success: true, method: "merge", targetPath: mcpConfigPath };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		return {
			success: false,
			method: "merge",
			error: `Failed to write settings: ${errorMessage}`,
		};
	}
}

/**
 * Merge mcpServers from MCP config into existing Gemini settings
 * Preserves all other Gemini settings (theme, preferredEditor, etc.)
 */
export async function mergeGeminiSettings(
	geminiSettingsPath: string,
	mcpConfigPath: string,
): Promise<GeminiLinkResult> {
	// Read existing Gemini settings
	const geminiSettings = await readJsonFile(geminiSettingsPath);
	if (!geminiSettings) {
		return { success: false, method: "merge", error: "Failed to read existing Gemini settings" };
	}

	// Read MCP config
	const mcpConfig = await readJsonFile(mcpConfigPath);
	if (!mcpConfig) {
		return { success: false, method: "merge", error: "Failed to read MCP config" };
	}

	// Extract mcpServers from MCP config (must be object, not array)
	const mcpServers = mcpConfig.mcpServers;
	if (!mcpServers || typeof mcpServers !== "object" || Array.isArray(mcpServers)) {
		return { success: false, method: "merge", error: "MCP config has no valid mcpServers object" };
	}

	// Merge: preserve existing Gemini settings, inject/replace mcpServers
	const mergedSettings = {
		...geminiSettings,
		mcpServers,
	};

	try {
		await writeFile(geminiSettingsPath, JSON.stringify(mergedSettings, null, 2), "utf-8");
		logger.debug(`Merged mcpServers into: ${geminiSettingsPath}`);
		return { success: true, method: "merge", targetPath: mcpConfigPath };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		return {
			success: false,
			method: "merge",
			error: `Failed to write merged settings: ${errorMessage}`,
		};
	}
}
