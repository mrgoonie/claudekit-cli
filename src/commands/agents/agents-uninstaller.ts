/**
 * Agents uninstaller — removes installed agents from providers
 */
import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ClineCustomMode } from "../portable/converters/fm-to-json.js";
import { buildClineModesJson } from "../portable/converters/fm-to-json.js";
import {
	findPortableInstallations,
	readPortableRegistry,
	removePortableInstallation,
} from "../portable/portable-registry.js";
import type { PortableInstallation } from "../portable/portable-registry.js";
import { providers } from "../portable/provider-registry.js";
import type { ProviderType } from "../portable/types.js";

export interface AgentUninstallResult {
	item: string;
	provider: ProviderType;
	providerDisplayName: string;
	global: boolean;
	path: string;
	success: boolean;
	error?: string;
	wasOrphaned?: boolean;
}

function toSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

/**
 * Remove an agent section from AGENTS.md (merge-single format)
 */
async function removeFromMergeSingle(
	agentName: string,
	filePath: string,
): Promise<{ success: boolean; error?: string }> {
	try {
		const content = await readFile(filePath, "utf-8");
		const targetSlug = toSlug(agentName);
		const headingRegex = /^## Agent:\s*(.+?)$/m;
		const firstHeading = content.match(headingRegex);
		if (!firstHeading || firstHeading.index === undefined) {
			return { success: false, error: "Agent section not found in file" };
		}

		const preamble = content.slice(0, firstHeading.index).trimEnd();
		const managedContent = content.slice(firstHeading.index);
		const parts = managedContent.split(/\n---\n+/);

		let removed = false;
		const remainingSections: string[] = [];
		for (const part of parts) {
			const trimmed = part.trim();
			if (!trimmed) continue;
			const match = trimmed.match(headingRegex);
			if (!match) continue;
			const sectionSlug = toSlug(match[1].trim());
			if (sectionSlug === targetSlug) {
				removed = true;
				continue;
			}
			remainingSections.push(trimmed);
		}

		if (!removed) {
			return { success: false, error: "Agent section not found in file" };
		}

		if (remainingSections.length === 0) {
			// Preserve non-agent preamble (e.g., config/rules) and drop generated agents header.
			const cleanedPreamble = preamble
				.replace(
					/^# Agents\n\n> Ported from Claude Code agents via ClaudeKit CLI \(ck agents\)\n> Target: .*\n+/s,
					"",
				)
				.trim();
			await writeFile(filePath, cleanedPreamble ? `${cleanedPreamble}\n` : "", "utf-8");
			return { success: true };
		}

		const trimmedPreamble = preamble.trim();
		const newContent = trimmedPreamble
			? `${trimmedPreamble}\n\n---\n\n${remainingSections.join("\n---\n\n")}\n`
			: `${remainingSections.join("\n---\n\n")}\n`;
		await writeFile(filePath, newContent, "utf-8");
		return { success: true };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Remove an agent from YAML modes file (yaml-merge format)
 */
async function removeFromYamlMerge(
	agentName: string,
	filePath: string,
): Promise<{ success: boolean; error?: string }> {
	try {
		const content = await readFile(filePath, "utf-8");
		const slug = toSlug(agentName);

		// Parse YAML by splitting on mode entries
		const lines = content.split("\n");
		const modeIndices: number[] = [];

		// Find start of each mode (lines starting with "  - slug:")
		for (let i = 0; i < lines.length; i++) {
			if (lines[i].trim().startsWith("- slug:")) {
				modeIndices.push(i);
			}
		}

		// Find the mode to remove
		let removeStart = -1;
		let removeEnd = -1;
		for (let i = 0; i < modeIndices.length; i++) {
			const start = modeIndices[i];
			const slugLine = lines[start];
			if (slugLine.includes(`"${slug}"`)) {
				removeStart = start;
				removeEnd = i + 1 < modeIndices.length ? modeIndices[i + 1] : lines.length;
				break;
			}
		}

		if (removeStart === -1) {
			return { success: false, error: "Agent mode not found in YAML file" };
		}

		// Remove the mode
		const newLines = [...lines.slice(0, removeStart), ...lines.slice(removeEnd)];

		// If only header left, delete file
		if (
			newLines.length <= 1 ||
			newLines.every((l) => l.trim() === "" || l.trim() === "customModes:")
		) {
			await rm(filePath, { force: true });
			return { success: true };
		}

		await writeFile(filePath, newLines.join("\n"), "utf-8");
		return { success: true };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Remove an agent from Cline custom modes JSON (json-merge format)
 */
async function removeFromJsonMerge(
	agentName: string,
	filePath: string,
): Promise<{ success: boolean; error?: string }> {
	try {
		const content = await readFile(filePath, "utf-8");
		const data = JSON.parse(content);
		const slug = toSlug(agentName);

		if (!data.customModes || !Array.isArray(data.customModes)) {
			return { success: false, error: "Invalid Cline modes file format" };
		}

		const filtered = data.customModes.filter((m: ClineCustomMode) => m.slug !== slug);

		if (filtered.length === data.customModes.length) {
			return { success: false, error: "Agent mode not found in JSON file" };
		}

		// Agent install also writes .clinerules/<agent>.md alongside custom modes.
		const rulesDir = dirname(filePath);
		const ruleNames = new Set([`${agentName}.md`, `${slug}.md`]);
		for (const ruleName of ruleNames) {
			await rm(join(rulesDir, ruleName), { force: true });
		}

		// If no modes left, delete file
		if (filtered.length === 0) {
			await rm(filePath, { force: true });
			return { success: true };
		}

		await writeFile(filePath, buildClineModesJson(filtered), "utf-8");
		return { success: true };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Uninstall an agent from a specific provider
 */
export async function uninstallAgentFromProvider(
	agentName: string,
	provider: ProviderType,
	global: boolean,
): Promise<AgentUninstallResult> {
	const registry = await readPortableRegistry();
	const installations = findPortableInstallations(registry, agentName, "agent", provider, global);

	if (installations.length === 0) {
		return {
			item: agentName,
			provider,
			providerDisplayName: provider,
			global,
			path: "",
			success: false,
			error: "Agent not found in registry",
		};
	}

	const installation = installations[0];
	const fileExists = existsSync(installation.path);

	try {
		// Check if this is a merge provider (shared file)
		const config = providers[provider];
		const pathConfig = config.agents;

		if (!pathConfig) {
			return {
				item: agentName,
				provider,
				providerDisplayName: provider,
				global,
				path: installation.path,
				success: false,
				error: "Provider does not support agents",
			};
		}

		const writeStrategy = pathConfig.writeStrategy;
		const isMergeProvider =
			writeStrategy === "merge-single" ||
			writeStrategy === "yaml-merge" ||
			writeStrategy === "json-merge";

		if (isMergeProvider && fileExists) {
			// Always remove only this agent's section/mode from shared files.
			// Shared files may also contain config/rules content and must not be deleted here.
			let removeResult: { success: boolean; error?: string };

			if (writeStrategy === "merge-single") {
				removeResult = await removeFromMergeSingle(agentName, installation.path);
			} else if (writeStrategy === "yaml-merge") {
				removeResult = await removeFromYamlMerge(agentName, installation.path);
			} else {
				// json-merge
				removeResult = await removeFromJsonMerge(agentName, installation.path);
			}

			if (!removeResult.success) {
				return {
					item: agentName,
					provider,
					providerDisplayName: provider,
					global,
					path: installation.path,
					success: false,
					error: removeResult.error || "Failed to remove agent section",
				};
			}
		} else if (fileExists) {
			// Per-file provider — safe to delete
			await rm(installation.path, { recursive: true, force: true });
		}

		await removePortableInstallation(agentName, "agent", provider, global);

		return {
			item: agentName,
			provider,
			providerDisplayName: provider,
			global,
			path: installation.path,
			success: true,
			wasOrphaned: !fileExists,
		};
	} catch (error) {
		return {
			item: agentName,
			provider,
			providerDisplayName: provider,
			global,
			path: installation.path,
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Force uninstall an agent when registry entry is missing
 */
export async function forceUninstallAgentFromProvider(
	agentName: string,
	provider: ProviderType,
	global: boolean,
): Promise<AgentUninstallResult> {
	const config = providers[provider];
	const pathConfig = config.agents;

	if (!pathConfig) {
		return {
			item: agentName,
			provider,
			providerDisplayName: config.displayName,
			global,
			path: "",
			success: false,
			error: "Provider does not support agents",
		};
	}

	const basePath = global ? pathConfig.globalPath : pathConfig.projectPath;
	if (!basePath) {
		return {
			item: agentName,
			provider,
			providerDisplayName: config.displayName,
			global,
			path: "",
			success: false,
			error: `${config.displayName} does not support ${global ? "global" : "project"}-level agents`,
		};
	}

	const writeStrategy = pathConfig.writeStrategy;
	const targetPath =
		writeStrategy === "json-merge"
			? join(basePath, "cline_custom_modes.json")
			: writeStrategy === "merge-single" ||
					writeStrategy === "yaml-merge" ||
					writeStrategy === "single-file"
				? basePath
				: join(basePath, `${agentName}${pathConfig.fileExtension}`);
	const fileExists = existsSync(targetPath);

	try {
		if (!fileExists) {
			return {
				item: agentName,
				provider,
				providerDisplayName: config.displayName,
				global,
				path: targetPath,
				success: false,
				error: "Agent file not found",
			};
		}

		if (writeStrategy === "merge-single") {
			const result = await removeFromMergeSingle(agentName, targetPath);
			if (!result.success) {
				return {
					item: agentName,
					provider,
					providerDisplayName: config.displayName,
					global,
					path: targetPath,
					success: false,
					error: result.error || "Failed to remove agent section",
				};
			}
		} else if (writeStrategy === "yaml-merge") {
			const result = await removeFromYamlMerge(agentName, targetPath);
			if (!result.success) {
				return {
					item: agentName,
					provider,
					providerDisplayName: config.displayName,
					global,
					path: targetPath,
					success: false,
					error: result.error || "Failed to remove agent mode",
				};
			}
		} else if (writeStrategy === "json-merge") {
			const result = await removeFromJsonMerge(agentName, targetPath);
			if (!result.success) {
				return {
					item: agentName,
					provider,
					providerDisplayName: config.displayName,
					global,
					path: targetPath,
					success: false,
					error: result.error || "Failed to remove agent mode",
				};
			}
		} else {
			await rm(targetPath, { recursive: true, force: true });
		}

		// Best-effort cleanup if registry entry exists.
		await removePortableInstallation(agentName, "agent", provider, global);

		return {
			item: agentName,
			provider,
			providerDisplayName: config.displayName,
			global,
			path: targetPath,
			success: true,
		};
	} catch (error) {
		return {
			item: agentName,
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
 * Get installed agents from registry
 */
export async function getInstalledAgents(
	provider?: ProviderType,
	global?: boolean,
): Promise<PortableInstallation[]> {
	const registry = await readPortableRegistry();
	return registry.installations.filter((i) => {
		if (i.type !== "agent") return false;
		if (provider && i.provider !== provider) return false;
		if (global !== undefined && i.global !== global) return false;
		return true;
	});
}
