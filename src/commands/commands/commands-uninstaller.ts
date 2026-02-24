/**
 * Commands uninstaller — removes installed commands from providers
 */
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import {
	findPortableInstallations,
	readPortableRegistry,
	removePortableInstallation,
} from "../portable/portable-registry.js";
import type { PortableInstallation } from "../portable/portable-registry.js";
import { providers } from "../portable/provider-registry.js";
import type { ProviderType } from "../portable/types.js";

export interface CommandUninstallResult {
	item: string;
	provider: ProviderType;
	providerDisplayName: string;
	global: boolean;
	path: string;
	success: boolean;
	error?: string;
	wasOrphaned?: boolean;
}

/**
 * Uninstall a command from a specific provider
 */
export async function uninstallCommandFromProvider(
	commandName: string,
	provider: ProviderType,
	global: boolean,
): Promise<CommandUninstallResult> {
	const registry = await readPortableRegistry();
	const installations = findPortableInstallations(
		registry,
		commandName,
		"command",
		provider,
		global,
	);

	if (installations.length === 0) {
		return {
			item: commandName,
			provider,
			providerDisplayName: providers[provider].displayName,
			global,
			path: "",
			success: false,
			error: "Command not found in registry",
		};
	}

	const installation = installations[0];
	const fileExists = existsSync(installation.path);

	try {
		if (fileExists) {
			await rm(installation.path, { recursive: true, force: true });
		}
		await removePortableInstallation(commandName, "command", provider, global);

		return {
			item: commandName,
			provider,
			providerDisplayName: providers[provider].displayName,
			global,
			path: installation.path,
			success: true,
			wasOrphaned: !fileExists,
		};
	} catch (error) {
		return {
			item: commandName,
			provider,
			providerDisplayName: providers[provider].displayName,
			global,
			path: installation.path,
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Force uninstall a command when registry entry is missing
 */
export async function forceUninstallCommandFromProvider(
	commandName: string,
	provider: ProviderType,
	global: boolean,
): Promise<CommandUninstallResult> {
	const config = providers[provider];
	const pathConfig = config.commands;

	if (!pathConfig) {
		return {
			item: commandName,
			provider,
			providerDisplayName: config.displayName,
			global,
			path: "",
			success: false,
			error: "Provider does not support commands",
		};
	}

	const basePath = global ? pathConfig.globalPath : pathConfig.projectPath;
	if (!basePath) {
		return {
			item: commandName,
			provider,
			providerDisplayName: config.displayName,
			global,
			path: "",
			success: false,
			error: `${config.displayName} does not support ${global ? "global" : "project"}-level commands`,
		};
	}

	const primaryPath = join(basePath, `${commandName}${pathConfig.fileExtension}`);
	const legacyFlatName = commandName.replace(/[\\/]+/g, "-");
	const legacyPath = join(basePath, `${legacyFlatName}${pathConfig.fileExtension}`);
	const targetPath = existsSync(primaryPath) ? primaryPath : legacyPath;
	const fileExists = existsSync(targetPath);

	if (!fileExists) {
		return {
			item: commandName,
			provider,
			providerDisplayName: config.displayName,
			global,
			path: primaryPath,
			success: false,
			error: "Command file not found",
		};
	}

	try {
		await rm(targetPath, { recursive: true, force: true });
		await removePortableInstallation(commandName, "command", provider, global);
		return {
			item: commandName,
			provider,
			providerDisplayName: config.displayName,
			global,
			path: targetPath,
			success: true,
		};
	} catch (error) {
		return {
			item: commandName,
			provider,
			providerDisplayName: config.displayName,
			global,
			path: targetPath,
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Get installed commands from registry
 */
export async function getInstalledCommands(
	provider?: ProviderType,
	global?: boolean,
): Promise<PortableInstallation[]> {
	const registry = await readPortableRegistry();
	return registry.installations.filter((i) => {
		if (i.type !== "command") return false;
		if (provider && i.provider !== provider) return false;
		if (global !== undefined && i.global !== global) return false;
		return true;
	});
}
