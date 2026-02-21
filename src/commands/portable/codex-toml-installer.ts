/**
 * Codex TOML installer — writes per-agent .toml files and merges registry entries into config.toml
 *
 * Strategy: Each agent gets a .codex/agents/<slug>.toml file with developer_instructions,
 * sandbox_mode, and model hints. Registry entries ([agents.X]) are merged into .codex/config.toml
 * using sentinel comments to avoid clobbering user settings.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve, sep } from "node:path";
import lockfile from "proper-lockfile";
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

function isErrnoCode(error: unknown, code: string): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as NodeJS.ErrnoException).code === code
	);
}

interface FileSnapshot {
	path: string;
	existed: boolean;
	content: string | null;
}

async function captureFileSnapshot(filePath: string): Promise<FileSnapshot> {
	try {
		const content = await readFile(filePath, "utf-8");
		return { path: filePath, existed: true, content };
	} catch (error) {
		if (isErrnoCode(error, "ENOENT")) {
			return { path: filePath, existed: false, content: null };
		}
		throw error;
	}
}

async function restoreFileSnapshot(snapshot: FileSnapshot): Promise<void> {
	if (snapshot.existed) {
		await ensureDir(snapshot.path);
		await writeFile(snapshot.path, snapshot.content ?? "", "utf-8");
		return;
	}
	try {
		await unlink(snapshot.path);
	} catch (error) {
		if (!isErrnoCode(error, "ENOENT")) {
			throw error;
		}
	}
}

async function restoreFileSnapshots(snapshots: FileSnapshot[]): Promise<void> {
	for (let index = snapshots.length - 1; index >= 0; index -= 1) {
		await restoreFileSnapshot(snapshots[index]);
	}
}

function getConfigTomlLockPath(configPath: string): string {
	const lockName = `.${basename(configPath)}.ck-merge.lock`;
	return join(dirname(configPath), lockName);
}

async function withConfigTomlLock<T>(configPath: string, operation: () => Promise<T>): Promise<T> {
	const resolvedPath = resolve(configPath);
	await ensureDir(resolvedPath);

	const release = await lockfile.lock(dirname(resolvedPath), {
		realpath: false,
		lockfilePath: getConfigTomlLockPath(resolvedPath),
		retries: {
			retries: 10,
			factor: 1.5,
			minTimeout: 25,
			maxTimeout: 500,
		},
	});

	try {
		return await operation();
	} finally {
		try {
			await release();
		} catch {
			// Best-effort lock cleanup; avoid masking real install result
		}
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
	const rollbackSnapshots: FileSnapshot[] = [];
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

			// Snapshot before write for rollback
			rollbackSnapshots.push(await captureFileSnapshot(agentTomlPath));
			await writeFile(agentTomlPath, result.content, "utf-8");

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

		// Merge registry entries into config.toml with file lock
		if (configEntries.length > 0) {
			try {
				await withConfigTomlLock(configTomlPath, async () => {
					const managedBlock = configEntries.join("\n\n");
					let existingConfig = "";
					try {
						existingConfig = await readFile(configTomlPath, "utf-8");
					} catch {
						// No existing config.toml — will create new
					}

					rollbackSnapshots.push(await captureFileSnapshot(configTomlPath));
					const merged = mergeConfigToml(existingConfig, managedBlock);
					await ensureDir(configTomlPath);
					await writeFile(configTomlPath, merged, "utf-8");
				});
			} catch (error) {
				const lockMessage = error instanceof Error ? error.message : "Unknown error";
				// Rollback already-written agent .toml files
				try {
					await restoreFileSnapshots(rollbackSnapshots);
				} catch (rollbackError) {
					const rbMsg = rollbackError instanceof Error ? rollbackError.message : "Unknown";
					return {
						provider,
						providerDisplayName: config.displayName,
						success: false,
						path: agentsDir,
						error: `Failed to lock/merge config.toml: ${lockMessage}; rollback failed: ${rbMsg}`,
						warnings: allWarnings.length > 0 ? allWarnings : undefined,
					};
				}
				return {
					provider,
					providerDisplayName: config.displayName,
					success: false,
					path: agentsDir,
					error: `Failed to lock/merge config.toml: ${lockMessage}`,
					warnings: allWarnings.length > 0 ? allWarnings : undefined,
				};
			}
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
		// Rollback all written files on any failure
		let errorMessage = `Failed to install Codex TOML agents: ${message}`;
		if (rollbackSnapshots.length > 0) {
			try {
				await restoreFileSnapshots(rollbackSnapshots);
			} catch (rollbackError) {
				const rbMsg = rollbackError instanceof Error ? rollbackError.message : "Unknown";
				errorMessage = `${errorMessage}; rollback failed: ${rbMsg}`;
			}
		}
		return {
			provider,
			providerDisplayName: config.displayName,
			success: false,
			path: agentsDir,
			error: errorMessage,
			warnings: allWarnings.length > 0 ? allWarnings : undefined,
		};
	}
}
