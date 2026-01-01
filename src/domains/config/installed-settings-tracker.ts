/**
 * InstalledSettingsTracker
 *
 * Manages tracking of CK-installed settings in .ck.json to respect user deletions.
 * When user removes a hook/server, subsequent init won't re-add it.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { logger, normalizeCommand } from "@/shared";
import type { InstalledSettings } from "@/types";

const CK_JSON_FILE = ".ck.json";

interface CkJsonData {
	kits?: Record<string, { installedSettings?: InstalledSettings; [key: string]: unknown }>;
	[key: string]: unknown;
}

export class InstalledSettingsTracker {
	private projectDir: string;
	private isGlobal: boolean;
	private kitName: string;

	constructor(projectDir: string, isGlobal: boolean, kitName = "engineer") {
		this.projectDir = projectDir;
		this.isGlobal = isGlobal;
		this.kitName = kitName;
	}

	/**
	 * Get path to .ck.json based on scope
	 */
	private getCkJsonPath(): string {
		if (this.isGlobal) {
			// Global: ~/.claude/.ck.json
			return join(this.projectDir, CK_JSON_FILE);
		}
		// Local: ./.claude/.ck.json
		return join(this.projectDir, ".claude", CK_JSON_FILE);
	}

	/**
	 * Load installed settings from .ck.json
	 */
	async loadInstalledSettings(): Promise<InstalledSettings> {
		const ckJsonPath = this.getCkJsonPath();

		if (!existsSync(ckJsonPath)) {
			return { hooks: [], mcpServers: [] };
		}

		try {
			const content = await readFile(ckJsonPath, "utf-8");
			const data: CkJsonData = JSON.parse(content);

			// Multi-kit format: kits.{kitName}.installedSettings
			const installed = data.kits?.[this.kitName]?.installedSettings;
			if (installed) {
				return installed;
			}

			// No tracking yet
			return { hooks: [], mcpServers: [] };
		} catch (error) {
			logger.debug(
				`Failed to load installed settings: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
			return { hooks: [], mcpServers: [] };
		}
	}

	/**
	 * Save installed settings to .ck.json
	 */
	async saveInstalledSettings(settings: InstalledSettings): Promise<void> {
		const ckJsonPath = this.getCkJsonPath();

		try {
			let data: CkJsonData = {};

			// Load existing data
			if (existsSync(ckJsonPath)) {
				const content = await readFile(ckJsonPath, "utf-8");
				data = JSON.parse(content);
			}

			// Ensure kits object exists
			if (!data.kits) {
				data.kits = {};
			}

			// Ensure kit entry exists
			if (!data.kits[this.kitName]) {
				data.kits[this.kitName] = {};
			}

			// Save installed settings
			data.kits[this.kitName].installedSettings = settings;

			// Ensure parent directory exists
			await mkdir(dirname(ckJsonPath), { recursive: true });
			await writeFile(ckJsonPath, JSON.stringify(data, null, 2), "utf-8");
			logger.debug(`Saved installed settings to ${ckJsonPath}`);
		} catch (error) {
			logger.warning(
				`Failed to save installed settings: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Check if a hook command was ever installed by CK
	 * Normalizes commands for consistent comparison across path variable formats
	 */
	wasHookInstalled(command: string, installed: InstalledSettings): boolean {
		const normalizedCommand = normalizeCommand(command);
		return installed.hooks?.some((hook) => normalizeCommand(hook) === normalizedCommand) ?? false;
	}

	/**
	 * Check if an MCP server was ever installed by CK
	 */
	wasMcpServerInstalled(serverName: string, installed: InstalledSettings): boolean {
		return installed.mcpServers?.includes(serverName) ?? false;
	}

	/**
	 * Add a hook command to the tracking list
	 * Normalizes command before storing for consistent comparison
	 */
	trackHook(command: string, settings: InstalledSettings): void {
		if (!settings.hooks) {
			settings.hooks = [];
		}
		const normalizedCommand = normalizeCommand(command);
		const alreadyTracked = settings.hooks.some(
			(hook) => normalizeCommand(hook) === normalizedCommand,
		);
		if (!alreadyTracked) {
			settings.hooks.push(normalizedCommand);
		}
	}

	/**
	 * Add an MCP server to the tracking list
	 */
	trackMcpServer(serverName: string, settings: InstalledSettings): void {
		if (!settings.mcpServers) {
			settings.mcpServers = [];
		}
		if (!settings.mcpServers.includes(serverName)) {
			settings.mcpServers.push(serverName);
		}
	}

	/**
	 * Clear all tracking (used with --force-overwrite-settings)
	 */
	async clearTracking(): Promise<void> {
		await this.saveInstalledSettings({ hooks: [], mcpServers: [] });
		logger.debug("Cleared installed settings tracking");
	}
}
