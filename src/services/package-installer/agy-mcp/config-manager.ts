/**
 * Antigravity (agy) MCP configuration management
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { logger } from "@/shared/logger.js";
import type { AgyLinkResult } from "./linker-core.js";

/** The agy workspace MCP config file, ignored from VCS (it is a symlink/local artifact). */
const AGY_GITIGNORE_PATTERN = ".agents/mcp_config.json";

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
 * Add .agents/mcp_config.json to .gitignore if not already present.
 *
 * We ignore only the MCP config file (not the whole `.agents/` directory) because
 * agy keeps skills and other workspace assets under `.agents/` that users may want
 * to commit.
 */
export async function addAgyToGitignore(projectDir: string): Promise<void> {
	const gitignorePath = join(projectDir, ".gitignore");

	try {
		let content = "";

		if (existsSync(gitignorePath)) {
			content = await readFile(gitignorePath, "utf-8");

			// Check if the pattern is already in gitignore (exclude commented lines)
			const lines = content
				.split("\n")
				.map((line) => line.trim())
				.filter((line) => !line.startsWith("#")); // Exclude comments
			const agyPatterns = [
				".agents/mcp_config.json",
				"/.agents/mcp_config.json",
				".agents/mcp_config.json/",
			];

			if (lines.some((line) => agyPatterns.includes(line))) {
				logger.debug(".agents/mcp_config.json already in .gitignore");
				return;
			}
		}

		// Append the pattern to gitignore
		const newLine = content.endsWith("\n") || content === "" ? "" : "\n";
		const comment = "# Antigravity CLI MCP config (symlinked to your Claude MCP config)";
		await writeFile(
			gitignorePath,
			`${content}${newLine}${comment}\n${AGY_GITIGNORE_PATTERN}\n`,
			"utf-8",
		);

		logger.debug(`Added ${AGY_GITIGNORE_PATTERN} to .gitignore`);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		logger.warning(`Failed to update .gitignore: ${errorMessage}`);
	}
}

/**
 * Create new agy mcp_config.json file with mcpServers from MCP config.
 * Used as Windows fallback when symlink creation fails (no admin rights).
 */
export async function createNewSettingsWithMerge(
	agyConfigPath: string,
	mcpConfigPath: string,
): Promise<AgyLinkResult> {
	// Ensure parent directory exists
	const linkDir = dirname(agyConfigPath);
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

	// Create new config file with just mcpServers
	const newSettings = { mcpServers };

	try {
		await writeFile(agyConfigPath, JSON.stringify(newSettings, null, 2), "utf-8");
		logger.debug(`Created new agy mcp_config.json with mcpServers: ${agyConfigPath}`);
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
 * Merge mcpServers from MCP config into existing agy mcp_config.json.
 * Preserves any other keys the user added to the file.
 */
export async function mergeAgySettings(
	agyConfigPath: string,
	mcpConfigPath: string,
): Promise<AgyLinkResult> {
	// Read existing agy config
	const agyConfig = await readJsonFile(agyConfigPath);
	if (!agyConfig) {
		return {
			success: false,
			method: "merge",
			error: "Failed to read existing agy mcp_config.json",
		};
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

	// Merge: preserve existing agy keys, inject/replace mcpServers
	const mergedSettings = {
		...agyConfig,
		mcpServers,
	};

	try {
		await writeFile(agyConfigPath, JSON.stringify(mergedSettings, null, 2), "utf-8");
		logger.debug(`Merged mcpServers into: ${agyConfigPath}`);
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
