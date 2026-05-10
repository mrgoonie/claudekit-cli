/**
 * Commands uninstaller — removes installed commands from providers
 */
import { existsSync } from "node:fs";
import { lstat, rm } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import {
	CODEX_COMMAND_SKILL_FILENAME,
	getCodexCommandSkillFilename,
} from "../portable/converters/codex-command-skill-path.js";
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

function isPathWithinBase(targetPath: string, basePath: string): boolean {
	const resolvedTarget = resolve(targetPath);
	const resolvedBase = resolve(basePath);
	return resolvedTarget === resolvedBase || resolvedTarget.startsWith(`${resolvedBase}${sep}`);
}

function isWindowsAbsolutePath(path: string): boolean {
	return /^[a-zA-Z]:[\\/]/.test(path) || /^\\\\/.test(path);
}

function isErrnoCode(error: unknown, code: string): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as NodeJS.ErrnoException).code === code
	);
}

function getSafeCommandNameSegments(commandName: string): string[] | null {
	if (
		commandName.startsWith("/") ||
		commandName.startsWith("\\") ||
		isWindowsAbsolutePath(commandName)
	) {
		return null;
	}

	const segments = commandName.replace(/\\/g, "/").replace(/\.md$/i, "").split("/").filter(Boolean);
	if (segments.length === 0) {
		return null;
	}

	for (const segment of segments) {
		if (segment === "." || segment === ".." || segment.includes("\0")) {
			return null;
		}
		let decoded: string;
		try {
			decoded = decodeURIComponent(segment);
		} catch {
			decoded = segment;
		}
		const normalized = decoded.normalize("NFC");
		if (
			normalized === "." ||
			normalized.includes("..") ||
			normalized.includes("/") ||
			normalized.includes("\\") ||
			normalized.includes("\0")
		) {
			return null;
		}
	}

	return segments;
}

function isCodexCommandSkillPath(targetPath: string, basePath: string): boolean {
	const targetDir = dirname(targetPath);
	const resolvedTargetDir = resolve(targetDir);
	const resolvedBase = resolve(basePath);
	return (
		basename(targetPath) === CODEX_COMMAND_SKILL_FILENAME &&
		basename(targetDir).startsWith("source-command-") &&
		resolvedTargetDir !== resolvedBase &&
		isPathWithinBase(targetDir, basePath)
	);
}

function getCodexLegacyPromptBasePath(basePath: string | null | undefined): string | null {
	if (!basePath) {
		return null;
	}
	const parent = dirname(basePath);
	if (basename(basePath) !== "skills" || basename(parent) !== ".agents") {
		return null;
	}
	return join(dirname(parent), ".codex", "prompts");
}

function getCodexScopeRootFromBasePath(basePath: string): string {
	const parent = dirname(basePath);
	if (
		(basename(basePath) === "skills" && basename(parent) === ".agents") ||
		(basename(basePath) === "prompts" && basename(parent) === ".codex")
	) {
		return dirname(parent);
	}
	return basePath;
}

function getSafeCommandTargetBasePath(
	targetPath: string,
	provider: ProviderType,
	basePath: string | null | undefined,
): string | null {
	if (!basePath) {
		return null;
	}
	if (isPathWithinBase(targetPath, basePath)) {
		return basePath;
	}
	if (provider === "codex") {
		const legacyPromptBasePath = getCodexLegacyPromptBasePath(basePath);
		if (legacyPromptBasePath && isPathWithinBase(targetPath, legacyPromptBasePath)) {
			return legacyPromptBasePath;
		}
	}
	return basePath;
}

function validateCommandTargetPath(
	targetPath: string,
	basePath: string | null | undefined,
): string | null {
	if (!basePath) {
		return "Provider command base path is unavailable";
	}
	const resolvedTarget = resolve(targetPath);
	const resolvedBase = resolve(basePath);
	if (resolvedTarget === resolvedBase) {
		return "Unsafe path: refusing to remove provider command base directory";
	}
	if (!isPathWithinBase(targetPath, basePath)) {
		return "Unsafe path: command target escapes provider command directory";
	}
	return null;
}

async function validateNoSymlinkComponents(
	targetPath: string,
	boundaryPath: string,
): Promise<string | null> {
	const resolvedTarget = resolve(targetPath);
	const resolvedBoundary = resolve(boundaryPath);

	if (!isPathWithinBase(resolvedTarget, resolvedBoundary)) {
		return `Unsafe path: target escapes ${resolvedBoundary}`;
	}

	const segments = relative(resolvedBoundary, resolvedTarget)
		.split(/[\\/]+/)
		.filter(Boolean);
	let cursor = resolvedBoundary;
	for (const segment of segments) {
		cursor = join(cursor, segment);
		try {
			const stats = await lstat(cursor);
			if (stats.isSymbolicLink()) {
				return `Unsafe path: target path contains symlink (${cursor})`;
			}
		} catch (error) {
			if (isErrnoCode(error, "ENOENT")) {
				break;
			}
			throw error;
		}
	}

	return null;
}

async function removeCommandTarget(
	targetPath: string,
	provider: ProviderType,
	basePath: string | null | undefined,
): Promise<void> {
	const safeBasePath = getSafeCommandTargetBasePath(targetPath, provider, basePath);
	const targetError = validateCommandTargetPath(targetPath, safeBasePath);
	if (targetError) {
		throw new Error(targetError);
	}
	const symlinkBoundary =
		provider === "codex" && safeBasePath
			? getCodexScopeRootFromBasePath(safeBasePath)
			: safeBasePath;
	if (symlinkBoundary) {
		const symlinkError = await validateNoSymlinkComponents(targetPath, symlinkBoundary);
		if (symlinkError) {
			throw new Error(symlinkError);
		}
	}

	if (provider === "codex" && safeBasePath && isCodexCommandSkillPath(targetPath, safeBasePath)) {
		await rm(dirname(targetPath), { recursive: true, force: true });
		return;
	}

	await rm(targetPath, { recursive: true, force: true });
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
	const pathConfig = providers[provider].commands;
	const basePath = pathConfig ? (global ? pathConfig.globalPath : pathConfig.projectPath) : null;

	try {
		if (fileExists) {
			await removeCommandTarget(installation.path, provider, basePath);
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
	const commandSegments = getSafeCommandNameSegments(commandName);
	if (!commandSegments) {
		return {
			item: commandName,
			provider,
			providerDisplayName: config.displayName,
			global,
			path: basePath ?? "",
			success: false,
			error: "Invalid command name",
		};
	}
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

	const candidatePaths: string[] = [];
	if (provider === "codex") {
		candidatePaths.push(join(basePath, getCodexCommandSkillFilename(commandSegments)));
		const legacyPromptBasePath = getCodexLegacyPromptBasePath(basePath);
		if (legacyPromptBasePath) {
			candidatePaths.push(join(legacyPromptBasePath, `${commandSegments.join("/")}.md`));
			candidatePaths.push(join(legacyPromptBasePath, `${commandSegments.join("-")}.md`));
		}
	}

	const normalizedCommandPath = commandSegments.join("/");
	const primaryPath = join(basePath, `${normalizedCommandPath}${pathConfig.fileExtension}`);
	candidatePaths.push(primaryPath);
	const legacyFlatName = commandSegments.join("-");
	const legacyPath = join(basePath, `${legacyFlatName}${pathConfig.fileExtension}`);
	if (legacyPath !== primaryPath) {
		candidatePaths.push(legacyPath);
	}
	const targetPath = candidatePaths.find((path) => existsSync(path)) ?? candidatePaths[0];
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
		await removeCommandTarget(targetPath, provider, basePath);
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
