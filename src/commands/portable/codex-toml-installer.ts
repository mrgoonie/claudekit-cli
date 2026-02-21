/**
 * Codex TOML installer — writes per-agent .toml files and merges registry entries into config.toml
 *
 * Strategy: Each agent gets a .codex/agents/<slug>.toml file with developer_instructions,
 * sandbox_mode, and model hints. Registry entries ([agents.X]) are merged into .codex/config.toml
 * using sentinel comments to avoid clobbering user settings.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, realpath, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import lockfile from "proper-lockfile";
import { computeContentChecksum } from "./checksum-utils.js";
import { buildCodexConfigEntry, toCodexSlug } from "./converters/fm-to-codex-toml.js";
import { convertItem } from "./converters/index.js";
import { addPortableInstallation, removePortableInstallation } from "./portable-registry.js";
import { providers } from "./provider-registry.js";
import type { PortableInstallResult, PortableItem, PortableType, ProviderType } from "./types.js";

const SENTINEL_START = "# --- ck-managed-agents-start ---";
const SENTINEL_END = "# --- ck-managed-agents-end ---";
const MAX_WINDOWS_PATH_LENGTH = 240;

interface ManagedBlockRange {
	start: number;
	end: number;
	content: string;
}

interface AnalyzeConfigTomlResult {
	lineEnding: "\n" | "\r\n";
	unmanagedContent: string;
	warnings: string[];
	error?: string;
}

interface MergeConfigTomlResult {
	content: string;
	unmanagedContent: string;
	warnings: string[];
	error?: string;
}

interface PendingCodexInstall {
	itemName: string;
	slug: string;
	agentTomlPath: string;
	sourcePath: string;
	sourceChecksum: string;
	targetChecksum: string;
}

interface FileSnapshot {
	path: string;
	existed: boolean;
	content: string | null;
}

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

function normalizePathForComparison(path: string): string {
	const normalized = resolve(path);
	return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function isPathWithinBoundary(targetPath: string, boundaryPath: string): boolean {
	const normalizedTarget = normalizePathForComparison(targetPath);
	const normalizedBoundary = normalizePathForComparison(boundaryPath);

	if (normalizedTarget === normalizedBoundary) {
		return true;
	}

	const rel = relative(normalizedBoundary, normalizedTarget);
	return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

async function resolveRealPathSafe(path: string): Promise<string> {
	try {
		return await realpath(path);
	} catch {
		return resolve(path);
	}
}

async function isCanonicalPathWithinBoundary(
	targetPath: string,
	boundaryPath: string,
): Promise<boolean> {
	const canonicalTarget = await resolveRealPathSafe(targetPath);
	const canonicalBoundary = await resolveRealPathSafe(boundaryPath);
	return isPathWithinBoundary(canonicalTarget, canonicalBoundary);
}

function detectLineEnding(content: string): "\n" | "\r\n" {
	return content.includes("\r\n") ? "\r\n" : "\n";
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isManagedAgentBlock(content: string): boolean {
	const hasAgentTable = /^\[agents\.[^\]\r\n]+\]\s*$/m.test(content);
	const hasDescription = /^\s*description\s*=\s*.+$/m.test(content);
	const hasAgentConfig = /^\s*config_file\s*=\s*"agents\/.+?"\s*$/m.test(content);
	return hasAgentTable && (hasDescription || hasAgentConfig);
}

function extractManagedAgentEntries(existing: string): Map<string, string> {
	const entries = new Map<string, string>();
	const escapedStart = escapeRegExp(SENTINEL_START);
	const escapedEnd = escapeRegExp(SENTINEL_END);
	const blockRegex = new RegExp(
		`^${escapedStart}\\s*\\r?\\n[\\s\\S]*?^${escapedEnd}\\s*(?:\\r?\\n)?`,
		"gm",
	);

	let match = blockRegex.exec(existing);
	while (match) {
		const blockContent = match[0]
			.split(/\r?\n/)
			.filter((line) => {
				const trimmed = line.trim();
				return trimmed !== SENTINEL_START && trimmed !== SENTINEL_END;
			})
			.join("\n");

		const lines = blockContent.split(/\r?\n/);
		let currentSlug: string | null = null;
		let currentLines: string[] = [];
		const commitEntry = () => {
			if (currentSlug && currentLines.length > 0) {
				entries.set(currentSlug, currentLines.join("\n").trimEnd());
			}
		};

		for (const line of lines) {
			const headerMatch = line.match(/^\[agents\.(?:"([^"]+)"|([^\]\r\n]+))\]\s*$/);
			if (headerMatch) {
				commitEntry();
				currentSlug = (headerMatch[1] || headerMatch[2] || "").trim();
				currentLines = [line];
				continue;
			}
			if (currentSlug) {
				currentLines.push(line);
			}
		}
		commitEntry();
		match = blockRegex.exec(existing);
	}

	return entries;
}

function stripRanges(content: string, ranges: ManagedBlockRange[]): string {
	if (ranges.length === 0) {
		return content;
	}

	const sorted = [...ranges].sort((a, b) => a.start - b.start);
	let cursor = 0;
	let result = "";

	for (const range of sorted) {
		result += content.slice(cursor, range.start);
		cursor = range.end;
	}

	result += content.slice(cursor);
	return result;
}

function analyzeConfigToml(existing: string): AnalyzeConfigTomlResult {
	const lineEnding = detectLineEnding(existing);
	const warnings: string[] = [];
	const escapedStart = escapeRegExp(SENTINEL_START);
	const escapedEnd = escapeRegExp(SENTINEL_END);
	const startLineRegex = new RegExp(`^${escapedStart}\\s*$`, "gm");
	const endLineRegex = new RegExp(`^${escapedEnd}\\s*$`, "gm");
	const startCount = [...existing.matchAll(startLineRegex)].length;
	const endCount = [...existing.matchAll(endLineRegex)].length;

	const blockRegex = new RegExp(
		`^${escapedStart}\\s*\\r?\\n[\\s\\S]*?^${escapedEnd}\\s*(?:\\r?\\n)?`,
		"gm",
	);
	const candidateRanges: ManagedBlockRange[] = [];
	let match: RegExpExecArray | null = blockRegex.exec(existing);
	while (match) {
		candidateRanges.push({
			start: match.index,
			end: match.index + match[0].length,
			content: match[0],
		});
		match = blockRegex.exec(existing);
	}

	const candidateCount = candidateRanges.length;
	const unmatchedStart = Math.max(0, startCount - candidateCount);
	const unmatchedEnd = Math.max(0, endCount - candidateCount);
	if (unmatchedStart > 0 || unmatchedEnd > 0) {
		return {
			lineEnding,
			unmanagedContent: existing,
			warnings,
			error:
				"Malformed CK managed agent sentinels in config.toml (unmatched start/end markers). Please clean up sentinels manually.",
		};
	}

	const managedRanges = candidateRanges.filter((range) => isManagedAgentBlock(range.content));
	if (managedRanges.length > 1) {
		warnings.push(
			`Found ${managedRanges.length} CK-managed agent blocks in config.toml; collapsing into one managed block`,
		);
	}

	const unmanagedContent = stripRanges(existing, managedRanges);
	return {
		lineEnding,
		unmanagedContent,
		warnings,
	};
}

function extractUnmanagedAgentSlugs(content: string): Set<string> {
	const slugs = new Set<string>();
	const regex = /^\[agents\.(?:"([^"]+)"|([^\]\r\n]+))\]\s*$/gm;
	let match = regex.exec(content);
	while (match) {
		const slug = (match[1] || match[2] || "").trim();
		if (slug.length > 0) {
			slugs.add(slug);
		}
		match = regex.exec(content);
	}
	return slugs;
}

/** Merge CK-managed agent entries into config.toml using sentinel comments */
export function mergeConfigToml(existing: string, managedBlock: string): string {
	return mergeConfigTomlWithDiagnostics(existing, managedBlock).content;
}

export function mergeConfigTomlWithDiagnostics(
	existing: string,
	managedBlock: string,
): MergeConfigTomlResult {
	const analysis = analyzeConfigToml(existing);
	if (analysis.error) {
		return {
			content: existing,
			unmanagedContent: analysis.unmanagedContent,
			warnings: analysis.warnings,
			error: analysis.error,
		};
	}

	const normalizedManagedBlock = managedBlock.trim();
	if (normalizedManagedBlock.length === 0) {
		return {
			content: analysis.unmanagedContent,
			unmanagedContent: analysis.unmanagedContent,
			warnings: [...analysis.warnings, "Managed block is empty; config.toml merge skipped"],
		};
	}

	const lineEnding = analysis.lineEnding;
	const base = analysis.unmanagedContent.trimEnd();
	const separator = base.length > 0 ? `${lineEnding}${lineEnding}` : "";
	const content = `${base}${separator}${SENTINEL_START}${lineEnding}${normalizedManagedBlock}${lineEnding}${SENTINEL_END}${lineEnding}`;

	return {
		content,
		unmanagedContent: analysis.unmanagedContent,
		warnings: analysis.warnings,
	};
}

function getCodexLockPath(configTomlPath: string): string {
	return join(dirname(configTomlPath), `.${basename(configTomlPath)}.ck-codex.lock`);
}

async function withCodexTargetLock<T>(
	configTomlPath: string,
	operation: () => Promise<T>,
): Promise<T> {
	const resolvedTargetPath = resolve(configTomlPath);
	await ensureDir(resolvedTargetPath);

	const release = await lockfile.lock(dirname(resolvedTargetPath), {
		realpath: false,
		lockfilePath: getCodexLockPath(resolvedTargetPath),
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
			// Best-effort lock cleanup; avoid masking install failures
		}
	}
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

async function rollbackRegistryEntries(
	entries: PendingCodexInstall[],
	portableType: PortableType,
	provider: ProviderType,
	global: boolean,
): Promise<void> {
	for (let index = entries.length - 1; index >= 0; index -= 1) {
		await removePortableInstallation(entries[index].itemName, portableType, provider, global);
	}
}

/** Install agents using Codex TOML multi-agent strategy */
export async function installCodexToml(
	items: PortableItem[],
	provider: ProviderType,
	portableType: PortableType,
	options: { global: boolean },
): Promise<PortableInstallResult> {
	const config = providers[provider];
	// Codex TOML strategy applies to agents only; portableType parameter is
	// required by the writeStrategy interface but unused here.
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

	const boundary = options.global ? homedir() : process.cwd();
	const agentsDir = resolve(basePath);
	const configTomlPath = join(dirname(agentsDir), "config.toml");

	if (!isPathWithinBoundary(agentsDir, boundary)) {
		return {
			provider,
			providerDisplayName: config.displayName,
			success: false,
			path: agentsDir,
			error: `Unsafe path: agents directory escapes ${options.global ? "home" : "project"} boundary`,
		};
	}

	if (!isPathWithinBoundary(configTomlPath, boundary)) {
		return {
			provider,
			providerDisplayName: config.displayName,
			success: false,
			path: configTomlPath,
			error: `Unsafe path: config.toml escapes ${options.global ? "home" : "project"} boundary`,
		};
	}

	try {
		await ensureDir(join(agentsDir, "_placeholder"));
		await ensureDir(configTomlPath);

		if (!(await isCanonicalPathWithinBoundary(agentsDir, boundary))) {
			return {
				provider,
				providerDisplayName: config.displayName,
				success: false,
				path: agentsDir,
				error: `Unsafe path: canonical agents directory escapes ${options.global ? "home" : "project"} boundary`,
			};
		}

		if (!(await isCanonicalPathWithinBoundary(dirname(configTomlPath), boundary))) {
			return {
				provider,
				providerDisplayName: config.displayName,
				success: false,
				path: configTomlPath,
				error: `Unsafe path: canonical config directory escapes ${options.global ? "home" : "project"} boundary`,
			};
		}

		return await withCodexTargetLock(configTomlPath, async () => {
			const allWarnings: string[] = [];
			const snapshots: FileSnapshot[] = [];
			const snapshottedPaths = new Set<string>();
			const pendingInstalls: PendingCodexInstall[] = [];
			const addedRegistryEntries: PendingCodexInstall[] = [];
			const configEntryBySlug = new Map<string, string>();
			const seenSlugOwners = new Map<string, string>();

			try {
				const configSnapshot = await captureFileSnapshot(configTomlPath);
				snapshots.push(configSnapshot);
				snapshottedPaths.add(configTomlPath);

				const existingConfig = configSnapshot.content ?? "";
				const configAnalysis = analyzeConfigToml(existingConfig);
				allWarnings.push(...configAnalysis.warnings);
				if (configAnalysis.error) {
					return {
						provider,
						providerDisplayName: config.displayName,
						success: false,
						path: configTomlPath,
						error: configAnalysis.error,
						warnings: allWarnings.length > 0 ? allWarnings : undefined,
					};
				}

				const existingManagedEntries = extractManagedAgentEntries(existingConfig);
				const unmanagedAgentSlugs = extractUnmanagedAgentSlugs(configAnalysis.unmanagedContent);

				for (const item of items) {
					const result = convertItem(item, pathConfig.format, provider);
					if (result.error) {
						allWarnings.push(`Skipped ${item.name}: ${result.error}`);
						continue;
					}
					if (result.warnings.length > 0) {
						allWarnings.push(...result.warnings);
					}

					const slug = toCodexSlug(item.name);
					if (!slug) {
						allWarnings.push(`Skipped ${item.name}: empty slug after normalization`);
						continue;
					}

					if (unmanagedAgentSlugs.has(slug)) {
						allWarnings.push(
							`Skipped ${item.name}: [agents.${slug}] already exists outside CK-managed block in config.toml`,
						);
						continue;
					}

					const existingOwner = seenSlugOwners.get(slug);
					if (existingOwner) {
						allWarnings.push(
							`Skipped ${item.name}: slug collision with ${existingOwner} (normalized slug "${slug}")`,
						);
						continue;
					}
					seenSlugOwners.set(slug, item.name);

					const agentTomlPath = join(agentsDir, `${slug}.toml`);
					if (process.platform === "win32" && agentTomlPath.length > MAX_WINDOWS_PATH_LENGTH) {
						allWarnings.push(
							`Skipped ${item.name}: target path exceeds ${MAX_WINDOWS_PATH_LENGTH} characters on Windows`,
						);
						continue;
					}

					if (!isPathWithinBoundary(agentTomlPath, agentsDir)) {
						allWarnings.push(`Skipped ${item.name}: path traversal detected`);
						continue;
					}
					if (!(await isCanonicalPathWithinBoundary(dirname(agentTomlPath), agentsDir))) {
						allWarnings.push(
							`Skipped ${item.name}: canonical target directory escapes agents directory`,
						);
						continue;
					}

					if (!snapshottedPaths.has(agentTomlPath)) {
						snapshots.push(await captureFileSnapshot(agentTomlPath));
						snapshottedPaths.add(agentTomlPath);
					}
					await writeFile(agentTomlPath, result.content, "utf-8");

					const description = item.frontmatter.description || item.description || item.name;
					configEntryBySlug.set(slug, buildCodexConfigEntry(item.name, description));

					pendingInstalls.push({
						itemName: item.name,
						slug,
						agentTomlPath,
						sourcePath: item.sourcePath,
						sourceChecksum: await computeContentChecksum(item.body),
						targetChecksum: await computeContentChecksum(result.content),
					});
				}

				if (pendingInstalls.length === 0) {
					return {
						provider,
						providerDisplayName: config.displayName,
						success: false,
						path: agentsDir,
						error: "No Codex agents were installed (all items skipped)",
						warnings: allWarnings.length > 0 ? allWarnings : undefined,
					};
				}

				for (const [slug, entry] of existingManagedEntries) {
					if (!configEntryBySlug.has(slug) && !unmanagedAgentSlugs.has(slug)) {
						configEntryBySlug.set(slug, entry);
					}
				}

				const sortedEntries = [...configEntryBySlug.entries()]
					.sort(([leftSlug], [rightSlug]) => leftSlug.localeCompare(rightSlug))
					.map(([, entry]) => entry);
				const managedBlock = sortedEntries.join("\n\n");
				const mergeResult = mergeConfigTomlWithDiagnostics(existingConfig, managedBlock);
				allWarnings.push(...mergeResult.warnings);
				if (mergeResult.error) {
					return {
						provider,
						providerDisplayName: config.displayName,
						success: false,
						path: configTomlPath,
						error: mergeResult.error,
						warnings: allWarnings.length > 0 ? allWarnings : undefined,
					};
				}
				await writeFile(configTomlPath, mergeResult.content, "utf-8");

				for (const install of pendingInstalls) {
					await addPortableInstallation(
						install.itemName,
						portableType,
						provider,
						options.global,
						install.agentTomlPath,
						install.sourcePath,
						{
							sourceChecksum: install.sourceChecksum,
							targetChecksum: install.targetChecksum,
							ownedSections: [install.slug],
							installSource: "kit",
						},
					);
					addedRegistryEntries.push(install);
				}

				return {
					provider,
					providerDisplayName: config.displayName,
					success: true,
					path: agentsDir,
					warnings: allWarnings.length > 0 ? allWarnings : undefined,
				};
			} catch (error) {
				let message = error instanceof Error ? error.message : "Unknown error";

				if (addedRegistryEntries.length > 0) {
					try {
						await rollbackRegistryEntries(
							addedRegistryEntries,
							portableType,
							provider,
							options.global,
						);
					} catch (rollbackRegistryError) {
						const rollbackMessage =
							rollbackRegistryError instanceof Error
								? rollbackRegistryError.message
								: "Unknown registry rollback error";
						message = `${message}; registry rollback failed: ${rollbackMessage}`;
					}
				}

				if (snapshots.length > 0) {
					try {
						await restoreFileSnapshots(snapshots);
					} catch (rollbackError) {
						const rollbackMessage =
							rollbackError instanceof Error ? rollbackError.message : "Unknown rollback error";
						message = `${message}; file rollback failed: ${rollbackMessage}`;
					}
				}

				return {
					provider,
					providerDisplayName: config.displayName,
					success: false,
					path: agentsDir,
					error: `Failed to install Codex TOML agents: ${message}`,
					warnings: allWarnings.length > 0 ? allWarnings : undefined,
				};
			}
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return {
			provider,
			providerDisplayName: config.displayName,
			success: false,
			path: agentsDir,
			error: `Failed to install Codex TOML agents: ${message}`,
		};
	}
}
