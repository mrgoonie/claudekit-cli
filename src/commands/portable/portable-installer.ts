/**
 * Portable installer — installs agents/commands to target providers
 * Handles all write strategies: per-file, merge-single, yaml-merge, json-merge
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { buildMergedAgentsMd } from "./converters/fm-strip.js";
import { type ClineCustomMode, buildClineModesJson } from "./converters/fm-to-json.js";
import { buildYamlModesFile } from "./converters/fm-to-yaml.js";
import { convertItem } from "./converters/index.js";
import { addPortableInstallation } from "./portable-registry.js";
import { providers } from "./provider-registry.js";
import type { PortableInstallResult, PortableItem, PortableType, ProviderType } from "./types.js";

/**
 * Check if two paths resolve to the same location
 */
function isSamePath(path1: string, path2: string): boolean {
	try {
		return resolve(path1) === resolve(path2);
	} catch {
		return false;
	}
}

/**
 * Map Node.js error codes to user-friendly messages
 */
function getErrorMessage(error: unknown, targetPath: string): string {
	if (error instanceof Error && "code" in error) {
		const code = (error as NodeJS.ErrnoException).code;
		switch (code) {
			case "EACCES":
			case "EPERM":
				return `Permission denied: ${targetPath}`;
			case "ENOSPC":
				return "Disk full — no space left on device";
			case "EROFS":
				return `Read-only filesystem: ${targetPath}`;
			default:
				return error.message;
		}
	}
	return error instanceof Error ? error.message : "Unknown error";
}

/**
 * Ensure directory exists for a file path
 */
async function ensureDir(filePath: string): Promise<void> {
	const dir = dirname(filePath);
	if (!existsSync(dir)) {
		await mkdir(dir, { recursive: true });
	}
}

/**
 * Install a single portable item to a single provider (per-file strategy)
 */
async function installPerFile(
	item: PortableItem,
	provider: ProviderType,
	portableType: PortableType,
	options: { global: boolean },
): Promise<PortableInstallResult> {
	const config = providers[provider];
	const pathConfig =
		config[
			portableType === "agent" ? "agents" : portableType === "command" ? "commands" : "skills"
		];

	if (!pathConfig) {
		return {
			provider,
			providerDisplayName: config.displayName,
			success: false,
			path: "",
			error: `${config.displayName} does not support ${portableType}s`,
		};
	}

	const basePath = options.global ? pathConfig.globalPath : pathConfig.projectPath;
	if (!basePath) {
		return {
			provider,
			providerDisplayName: config.displayName,
			success: false,
			path: "",
			error: `${config.displayName} does not support ${options.global ? "global" : "project"}-level ${portableType}s`,
		};
	}

	// Convert to target format
	const result = convertItem(item, pathConfig.format, provider);
	const targetPath = join(basePath, result.filename);

	// Guard against path traversal
	const resolvedTarget = resolve(targetPath);
	const resolvedBase = resolve(basePath);
	if (!resolvedTarget.startsWith(resolvedBase + sep) && resolvedTarget !== resolvedBase) {
		return {
			provider,
			providerDisplayName: config.displayName,
			success: false,
			path: targetPath,
			error: "Unsafe path: target escapes base directory",
		};
	}

	// Skip if source and target are the same
	if (isSamePath(item.sourcePath, targetPath)) {
		return {
			provider,
			providerDisplayName: config.displayName,
			success: true,
			path: targetPath,
			skipped: true,
			skipReason: "Already exists at source location",
		};
	}

	try {
		await ensureDir(targetPath);
		const alreadyExists = existsSync(targetPath);
		await writeFile(targetPath, result.content, "utf-8");

		await addPortableInstallation(
			item.name,
			portableType,
			provider,
			options.global,
			targetPath,
			item.sourcePath,
		);

		return {
			provider,
			providerDisplayName: config.displayName,
			success: true,
			path: targetPath,
			overwritten: alreadyExists,
			warnings: result.warnings.length > 0 ? result.warnings : undefined,
		};
	} catch (error) {
		return {
			provider,
			providerDisplayName: config.displayName,
			success: false,
			path: targetPath,
			error: getErrorMessage(error, targetPath),
		};
	}
}

/**
 * Install multiple items using merge-single strategy (AGENTS.md)
 */
async function installMergeSingle(
	items: PortableItem[],
	provider: ProviderType,
	portableType: PortableType,
	options: { global: boolean },
): Promise<PortableInstallResult> {
	const config = providers[provider];
	const pathConfig =
		config[
			portableType === "agent" ? "agents" : portableType === "command" ? "commands" : "skills"
		];

	if (!pathConfig) {
		return {
			provider,
			providerDisplayName: config.displayName,
			success: false,
			path: "",
			error: `${config.displayName} does not support ${portableType}s`,
		};
	}

	const targetPath = options.global ? pathConfig.globalPath : pathConfig.projectPath;
	if (!targetPath) {
		return {
			provider,
			providerDisplayName: config.displayName,
			success: false,
			path: "",
			error: `${config.displayName} does not support ${options.global ? "global" : "project"}-level ${portableType}s`,
		};
	}

	try {
		// Convert all items
		const sections: string[] = [];
		const allWarnings: string[] = [];
		for (const item of items) {
			const result = convertItem(item, pathConfig.format, provider);
			sections.push(result.content);
			allWarnings.push(...result.warnings);
		}

		// Build merged file
		const content = buildMergedAgentsMd(sections, config.displayName);

		await ensureDir(targetPath);
		const alreadyExists = existsSync(targetPath);
		await writeFile(targetPath, content, "utf-8");

		// Register each item
		for (const item of items) {
			await addPortableInstallation(
				item.name,
				portableType,
				provider,
				options.global,
				targetPath,
				item.sourcePath,
			);
		}

		return {
			provider,
			providerDisplayName: config.displayName,
			success: true,
			path: targetPath,
			overwritten: alreadyExists,
			warnings: allWarnings.length > 0 ? allWarnings : undefined,
		};
	} catch (error) {
		return {
			provider,
			providerDisplayName: config.displayName,
			success: false,
			path: targetPath,
			error: getErrorMessage(error, targetPath),
		};
	}
}

/**
 * Install multiple items using yaml-merge strategy (Roo/Kilo .roomodes/.kilocodemodes)
 */
async function installYamlMerge(
	items: PortableItem[],
	provider: ProviderType,
	portableType: PortableType,
	options: { global: boolean },
): Promise<PortableInstallResult> {
	const config = providers[provider];
	const typeKey =
		portableType === "agent" ? "agents" : portableType === "command" ? "commands" : "skills";
	const pathConfig = config[typeKey];

	if (!pathConfig) {
		return {
			provider,
			providerDisplayName: config.displayName,
			success: false,
			path: "",
			error: `${config.displayName} does not support ${portableType}s`,
		};
	}

	const targetPath = options.global ? pathConfig.globalPath : pathConfig.projectPath;
	if (!targetPath) {
		return {
			provider,
			providerDisplayName: config.displayName,
			success: false,
			path: "",
			error: `${config.displayName} does not support ${options.global ? "global" : "project"}-level ${portableType}s`,
		};
	}

	try {
		const entries: string[] = [];
		for (const item of items) {
			const result = convertItem(item, pathConfig.format, provider);
			entries.push(result.content);
		}

		const content = buildYamlModesFile(entries);

		await ensureDir(targetPath);
		const alreadyExists = existsSync(targetPath);
		await writeFile(targetPath, content, "utf-8");

		for (const item of items) {
			await addPortableInstallation(
				item.name,
				portableType,
				provider,
				options.global,
				targetPath,
				item.sourcePath,
			);
		}

		return {
			provider,
			providerDisplayName: config.displayName,
			success: true,
			path: targetPath,
			overwritten: alreadyExists,
		};
	} catch (error) {
		return {
			provider,
			providerDisplayName: config.displayName,
			success: false,
			path: targetPath,
			error: getErrorMessage(error, targetPath),
		};
	}
}

/**
 * Install multiple items using json-merge strategy (Cline custom modes)
 */
async function installJsonMerge(
	items: PortableItem[],
	provider: ProviderType,
	portableType: PortableType,
	options: { global: boolean },
): Promise<PortableInstallResult> {
	const config = providers[provider];
	const typeKey =
		portableType === "agent" ? "agents" : portableType === "command" ? "commands" : "skills";
	const pathConfig = config[typeKey];

	if (!pathConfig) {
		return {
			provider,
			providerDisplayName: config.displayName,
			success: false,
			path: "",
			error: `${config.displayName} does not support ${portableType}s`,
		};
	}

	const basePath = options.global ? pathConfig.globalPath : pathConfig.projectPath;
	if (!basePath) {
		return {
			provider,
			providerDisplayName: config.displayName,
			success: false,
			path: "",
			error: `${config.displayName} does not support ${options.global ? "global" : "project"}-level ${portableType}s`,
		};
	}

	try {
		// Convert all items to Cline mode objects
		const modes: ClineCustomMode[] = [];
		for (const item of items) {
			const result = convertItem(item, pathConfig.format, provider);
			modes.push(JSON.parse(result.content));
		}

		// Write cline_custom_modes.json
		const modesPath = join(basePath, "cline_custom_modes.json");
		await ensureDir(modesPath);
		const alreadyExists = existsSync(modesPath);

		// Merge with existing modes if present
		if (alreadyExists) {
			try {
				const existing = JSON.parse(await readFile(modesPath, "utf-8"));
				if (existing.customModes && Array.isArray(existing.customModes)) {
					// Remove duplicates by slug, keep new versions
					const newSlugs = new Set(modes.map((m) => m.slug));
					const kept = existing.customModes.filter((m: ClineCustomMode) => !newSlugs.has(m.slug));
					modes.push(...kept);
				}
			} catch {
				// Ignore parse errors on existing file
			}
		}

		await writeFile(modesPath, buildClineModesJson(modes), "utf-8");

		// Also write plain MD rules to .clinerules/
		const rulesDir = join(dirname(basePath), ".clinerules");
		await mkdir(rulesDir, { recursive: true });
		for (const item of items) {
			const rulePath = join(rulesDir, `${item.name}.md`);
			await writeFile(
				rulePath,
				`# ${item.frontmatter.name || item.name}\n\n${item.body}\n`,
				"utf-8",
			);
		}

		for (const item of items) {
			await addPortableInstallation(
				item.name,
				portableType,
				provider,
				options.global,
				modesPath,
				item.sourcePath,
			);
		}

		return {
			provider,
			providerDisplayName: config.displayName,
			success: true,
			path: modesPath,
			overwritten: alreadyExists,
		};
	} catch (error) {
		return {
			provider,
			providerDisplayName: config.displayName,
			success: false,
			path: basePath,
			error: getErrorMessage(error, basePath),
		};
	}
}

/**
 * Install portable item(s) to a single provider
 */
export async function installPortableItem(
	items: PortableItem[],
	provider: ProviderType,
	portableType: PortableType,
	options: { global: boolean },
): Promise<PortableInstallResult> {
	const config = providers[provider];
	const typeKey =
		portableType === "agent" ? "agents" : portableType === "command" ? "commands" : "skills";
	const pathConfig = config[typeKey];

	if (!pathConfig) {
		return {
			provider,
			providerDisplayName: config.displayName,
			success: false,
			path: "",
			error: `${config.displayName} does not support ${portableType}s`,
		};
	}

	switch (pathConfig.writeStrategy) {
		case "merge-single":
			return installMergeSingle(items, provider, portableType, options);
		case "yaml-merge":
			return installYamlMerge(items, provider, portableType, options);
		case "json-merge":
			return installJsonMerge(items, provider, portableType, options);
		case "per-file": {
			// For per-file, install each item individually and aggregate results
			const results: PortableInstallResult[] = [];
			for (const item of items) {
				results.push(await installPerFile(item, provider, portableType, options));
			}
			// Return aggregated result
			const successes = results.filter((r) => r.success && !r.skipped);
			const failures = results.filter((r) => !r.success);
			const warnings = results.flatMap((r) => r.warnings || []);

			if (failures.length > 0 && successes.length === 0) {
				return {
					provider,
					providerDisplayName: config.displayName,
					success: false,
					path: failures[0].path,
					error: failures.map((f) => f.error).join("; "),
				};
			}

			return {
				provider,
				providerDisplayName: config.displayName,
				success: true,
				path: successes[0]?.path || results[0]?.path || "",
				overwritten: results.some((r) => r.overwritten),
				skipped: results.every((r) => r.skipped),
				skipReason: results.every((r) => r.skipped) ? "All items already at source" : undefined,
				warnings: warnings.length > 0 ? warnings : undefined,
			};
		}
	}
}

/**
 * Install portable items to multiple providers (sequential to prevent registry race conditions)
 */
export async function installPortableItems(
	items: PortableItem[],
	targetProviders: ProviderType[],
	portableType: PortableType,
	options: { global: boolean },
): Promise<PortableInstallResult[]> {
	const results: PortableInstallResult[] = [];
	for (const provider of targetProviders) {
		results.push(await installPortableItem(items, provider, portableType, options));
	}
	return results;
}
