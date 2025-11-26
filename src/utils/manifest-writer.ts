import { join } from "node:path";
import { pathExists, readFile, writeFile } from "fs-extra";
import type { Metadata } from "../types.js";
import { MetadataSchema, USER_CONFIG_PATTERNS } from "../types.js";
import { logger } from "./logger.js";

/**
 * ManifestWriter handles reading and writing installation manifests to metadata.json
 * This tracks exactly what files ClaudeKit installed for accurate uninstall
 */
export class ManifestWriter {
	private installedFiles: Set<string> = new Set();
	private userConfigFiles: Set<string> = new Set();

	/**
	 * Add a file or directory to the installed files manifest
	 * @param relativePath - Path relative to .claude directory
	 */
	addInstalledFile(relativePath: string): void {
		// Normalize path separators
		const normalized = relativePath.replace(/\\/g, "/");
		this.installedFiles.add(normalized);
	}

	/**
	 * Add multiple files/directories to the manifest
	 */
	addInstalledFiles(relativePaths: string[]): void {
		for (const path of relativePaths) {
			this.addInstalledFile(path);
		}
	}

	/**
	 * Mark a file as user config (should be preserved during uninstall)
	 */
	addUserConfigFile(relativePath: string): void {
		const normalized = relativePath.replace(/\\/g, "/");
		this.userConfigFiles.add(normalized);
	}

	/**
	 * Get list of installed files
	 */
	getInstalledFiles(): string[] {
		return Array.from(this.installedFiles).sort();
	}

	/**
	 * Get list of user config files
	 */
	getUserConfigFiles(): string[] {
		return Array.from(this.userConfigFiles).sort();
	}

	/**
	 * Write or update metadata.json with installation manifest
	 * @param claudeDir - Path to .claude directory
	 * @param kitName - Name of the kit being installed
	 * @param version - Version being installed
	 * @param scope - Installation scope (local or global)
	 */
	async writeManifest(
		claudeDir: string,
		kitName: string,
		version: string,
		scope: "local" | "global",
	): Promise<void> {
		const metadataPath = join(claudeDir, "metadata.json");

		// Read existing metadata if present
		let existingMetadata: Partial<Metadata> = {};
		if (await pathExists(metadataPath)) {
			try {
				const content = await readFile(metadataPath, "utf-8");
				existingMetadata = JSON.parse(content);
			} catch (error) {
				logger.debug(`Could not read existing metadata: ${error}`);
			}
		}

		// Build new metadata with manifest
		const metadata: Metadata = {
			...existingMetadata,
			name: kitName,
			version,
			installedAt: new Date().toISOString(),
			scope,
			installedFiles: this.getInstalledFiles(),
			userConfigFiles: [...USER_CONFIG_PATTERNS, ...this.getUserConfigFiles()],
		};

		// Validate schema
		const validated = MetadataSchema.parse(metadata);

		// Write to file
		await writeFile(metadataPath, JSON.stringify(validated, null, 2), "utf-8");
		logger.debug(`Wrote manifest with ${this.installedFiles.size} installed files`);
	}

	/**
	 * Read manifest from existing metadata.json
	 * @param claudeDir - Path to .claude directory
	 * @returns Metadata with manifest or null if not found
	 */
	static async readManifest(claudeDir: string): Promise<Metadata | null> {
		const metadataPath = join(claudeDir, "metadata.json");

		if (!(await pathExists(metadataPath))) {
			return null;
		}

		try {
			const content = await readFile(metadataPath, "utf-8");
			const parsed = JSON.parse(content);
			return MetadataSchema.parse(parsed);
		} catch (error) {
			logger.debug(`Failed to read manifest: ${error}`);
			return null;
		}
	}

	/**
	 * Get files to remove during uninstall based on manifest
	 * Falls back to legacy hardcoded list if no manifest exists
	 * @param claudeDir - Path to .claude directory
	 * @returns Object with files to remove and files to preserve
	 */
	static async getUninstallManifest(claudeDir: string): Promise<{
		filesToRemove: string[];
		filesToPreserve: string[];
		hasManifest: boolean;
	}> {
		const metadata = await ManifestWriter.readManifest(claudeDir);

		if (metadata?.installedFiles && metadata.installedFiles.length > 0) {
			// Use manifest for accurate uninstall
			return {
				filesToRemove: metadata.installedFiles,
				filesToPreserve: metadata.userConfigFiles || USER_CONFIG_PATTERNS,
				hasManifest: true,
			};
		}

		// Fallback to legacy hardcoded directories for backward compatibility
		const legacyDirs = ["commands", "agents", "skills", "workflows", "hooks", "scripts"];
		const legacyFiles = ["metadata.json"];

		return {
			filesToRemove: [...legacyDirs, ...legacyFiles],
			filesToPreserve: USER_CONFIG_PATTERNS,
			hasManifest: false,
		};
	}
}
