/**
 * Agents uninstaller — removes installed agents from providers
 */
import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
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

/**
 * Remove an agent section from AGENTS.md (merge-single format)
 */
async function removeFromMergeSingle(
	agentName: string,
	filePath: string,
): Promise<{ success: boolean; error?: string }> {
	try {
		const content = await readFile(filePath, "utf-8");
		const sections = content.split(/\n---\n/);

		// Find and remove the section for this agent
		const agentHeader = `## Agent: ${agentName}`;
		const filteredSections = sections.filter((section) => !section.includes(agentHeader));

		if (filteredSections.length === sections.length) {
			return { success: false, error: "Agent section not found in file" };
		}

		// If no meaningful sections remain, delete the file
		if (filteredSections.length === 0 || filteredSections.every((s) => !s.trim())) {
			await rm(filePath, { force: true });
			return { success: true };
		}

		// Rewrite file with remaining sections
		const newContent = filteredSections.join("\n---\n");
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
		const slug = agentName
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "");

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
		const slug = agentName
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "");

		if (!data.customModes || !Array.isArray(data.customModes)) {
			return { success: false, error: "Invalid Cline modes file format" };
		}

		const filtered = data.customModes.filter((m: ClineCustomMode) => m.slug !== slug);

		if (filtered.length === data.customModes.length) {
			return { success: false, error: "Agent mode not found in JSON file" };
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
			// Check if other agents are installed at the same path
			const otherAgents = registry.installations.filter(
				(i) =>
					i.type === "agent" &&
					i.path === installation.path &&
					i.global === global &&
					!(i.item === agentName && i.provider === provider),
			);

			if (otherAgents.length > 0) {
				// Other agents exist — remove only this agent's section
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
			} else {
				// Last agent — delete the file
				await rm(installation.path, { recursive: true, force: true });
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
