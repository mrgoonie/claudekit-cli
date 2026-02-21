/**
 * Codex TOML installer — writes per-agent .toml files and merges registry entries into config.toml
 *
 * Strategy: Each agent gets a .codex/agents/<slug>.toml file with developer_instructions,
 * sandbox_mode, and model hints. Registry entries ([agents.X]) are merged into .codex/config.toml
 * using sentinel comments to avoid clobbering user settings.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { computeContentChecksum } from "./checksum-utils.js";
import { buildCodexConfigEntry, toCodexSlug } from "./converters/fm-to-codex-toml.js";
import { convertItem } from "./converters/index.js";
import { addPortableInstallation } from "./portable-registry.js";
import { providers } from "./provider-registry.js";
import type { PortableInstallResult, PortableItem, PortableType, ProviderType } from "./types.js";

const SENTINEL_START = "# --- ck-managed-agents-start ---";
const SENTINEL_END = "# --- ck-managed-agents-end ---";

/** Ensure parent directory exists before writing */
async function ensureDir(filePath: string): Promise<void> {
	const dir = dirname(filePath);
	if (!existsSync(dir)) {
		await mkdir(dir, { recursive: true });
	}
}

/** Merge CK-managed agent entries into config.toml using sentinel comments */
export function mergeConfigToml(existing: string, managedBlock: string): string {
	const startIdx = existing.indexOf(SENTINEL_START);
	const endIdx = existing.indexOf(SENTINEL_END);

	if (startIdx !== -1 && endIdx !== -1) {
		// Replace existing managed block
		const before = existing.slice(0, startIdx);
		const after = existing.slice(endIdx + SENTINEL_END.length);
		return `${before}${SENTINEL_START}\n${managedBlock}\n${SENTINEL_END}${after}`;
	}

	// Append managed block (with blank line separator)
	const separator = existing.trimEnd().length > 0 ? "\n\n" : "";
	return `${existing.trimEnd()}${separator}${SENTINEL_START}\n${managedBlock}\n${SENTINEL_END}\n`;
}

/** Install agents using Codex TOML multi-agent strategy */
export async function installCodexToml(
	items: PortableItem[],
	provider: ProviderType,
	portableType: PortableType,
	options: { global: boolean },
): Promise<PortableInstallResult> {
	const config = providers[provider];
	const pathConfig = config.agents;

	if (!pathConfig) {
		return {
			provider,
			providerDisplayName: config.displayName,
			success: false,
			path: "",
			error: `${config.displayName} does not support agents`,
		};
	}

	const basePath = options.global ? pathConfig.globalPath : pathConfig.projectPath;
	if (!basePath) {
		return {
			provider,
			providerDisplayName: config.displayName,
			success: false,
			path: "",
			error: `${config.displayName} does not support ${options.global ? "global" : "project"}-level agents`,
		};
	}

	// Resolve config.toml path (sibling to agents/ dir)
	const configTomlPath = join(dirname(basePath), "config.toml");
	const agentsDir = resolve(basePath);

	const configEntries: string[] = [];
	const writtenFiles: string[] = [];
	const allWarnings: string[] = [];

	try {
		await ensureDir(join(agentsDir, "_placeholder"));

		for (const item of items) {
			const result = convertItem(item, pathConfig.format, provider);
			if (result.error) {
				allWarnings.push(`Skipped ${item.name}: ${result.error}`);
				continue;
			}
			if (result.warnings.length > 0) {
				allWarnings.push(...result.warnings);
			}

			// Write per-agent .toml file
			const slug = toCodexSlug(item.name);
			const agentTomlPath = join(agentsDir, `${slug}.toml`);

			// Guard against path traversal
			if (
				!resolve(agentTomlPath).startsWith(agentsDir + sep) &&
				resolve(agentTomlPath) !== agentsDir
			) {
				allWarnings.push(`Skipped ${item.name}: path traversal detected`);
				continue;
			}

			await writeFile(agentTomlPath, result.content, "utf-8");
			writtenFiles.push(agentTomlPath);

			// Build config.toml registry entry
			const description = item.frontmatter.description || item.description || item.name;
			configEntries.push(buildCodexConfigEntry(item.name, description));

			// Register in portable registry
			const sourceChecksum = await computeContentChecksum(item.body);
			const targetChecksum = await computeContentChecksum(result.content);
			await addPortableInstallation(
				item.name,
				portableType,
				provider,
				options.global,
				agentTomlPath,
				item.sourcePath,
				{
					sourceChecksum,
					targetChecksum,
					ownedSections: [slug],
					installSource: "kit",
				},
			);
		}

		// Merge registry entries into config.toml
		if (configEntries.length > 0) {
			const managedBlock = configEntries.join("\n\n");
			let existingConfig = "";
			try {
				existingConfig = await readFile(configTomlPath, "utf-8");
			} catch {
				// No existing config.toml — will create new
			}

			const merged = mergeConfigToml(existingConfig, managedBlock);
			await ensureDir(configTomlPath);
			await writeFile(configTomlPath, merged, "utf-8");
		}

		return {
			provider,
			providerDisplayName: config.displayName,
			success: true,
			path: agentsDir,
			warnings: allWarnings.length > 0 ? allWarnings : undefined,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return {
			provider,
			providerDisplayName: config.displayName,
			success: false,
			path: agentsDir,
			error: `Failed to install Codex TOML agents: ${message}`,
			warnings: allWarnings.length > 0 ? allWarnings : undefined,
		};
	}
}
