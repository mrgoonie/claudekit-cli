/**
 * Portable installer — installs agents/commands to target providers
 * Handles all write strategies: per-file, merge-single, yaml-merge, json-merge
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import lockfile from "proper-lockfile";
import { z } from "zod";
import { computeContentChecksum } from "./checksum-utils.js";
import { buildMergedAgentsMd } from "./converters/fm-strip.js";
import { type ClineCustomMode, buildClineModesJson } from "./converters/fm-to-json.js";
import { buildYamlModesFile } from "./converters/fm-to-yaml.js";
import { convertItem } from "./converters/index.js";
import { addPortableInstallation } from "./portable-registry.js";
import { providers } from "./provider-registry.js";
import type { PortableInstallResult, PortableItem, PortableType, ProviderType } from "./types.js";

const ClineCustomModeSchema = z.object({
	slug: z.string(),
	name: z.string(),
	roleDefinition: z.string(),
	groups: z.array(z.string()),
	customInstructions: z.string(),
});

const ClineCustomModesFileSchema = z.object({
	customModes: z.array(ClineCustomModeSchema).optional(),
});

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

function isErrnoCode(error: unknown, code: string): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as NodeJS.ErrnoException).code === code
	);
}

function isWindowsAbsolutePath(path: string): boolean {
	return /^[a-zA-Z]:[\\/]/.test(path) || /^\\\\/.test(path);
}

function isPathWithinBoundary(targetPath: string, boundaryPath: string): boolean {
	const resolvedTarget = resolve(targetPath);
	const resolvedBoundary = resolve(boundaryPath);
	return (
		resolvedTarget === resolvedBoundary || resolvedTarget.startsWith(`${resolvedBoundary}${sep}`)
	);
}

function validateStrategyTargetPath(
	targetPath: string,
	options: { global: boolean },
): string | null {
	const boundary = options.global ? homedir() : process.cwd();
	if (!isPathWithinBoundary(targetPath, boundary)) {
		return `Unsafe path: target escapes ${options.global ? "home" : "project"} directory`;
	}
	return null;
}

function getPortableItemSegments(item: PortableItem): string[] {
	if (item.segments && item.segments.length > 0) {
		return item.segments;
	}
	return item.name.replace(/\\/g, "/").split("/").filter(Boolean);
}

function validatePortableItemSegments(item: PortableItem): string | null {
	if (item.name.startsWith("/") || item.name.startsWith("\\") || isWindowsAbsolutePath(item.name)) {
		return `Unsafe item path: absolute paths are not allowed (${item.name})`;
	}

	const segments = getPortableItemSegments(item);
	if (segments.length === 0) {
		return `Unsafe item path: empty path segments (${item.name})`;
	}

	for (const segment of segments) {
		if (!segment || segment === "." || segment === "..") {
			return `Unsafe item path segment: ${segment || "<empty>"}`;
		}
		if (segment.includes("/") || segment.includes("\\") || segment.includes("\0")) {
			return `Unsafe item path segment: ${segment}`;
		}
		// Check for encoded path traversal attempts
		let decoded: string;
		try {
			decoded = decodeURIComponent(segment);
		} catch {
			decoded = segment;
		}
		const normalized = decoded.normalize("NFC");
		if (
			normalized.includes("..") ||
			normalized === "." ||
			normalized.includes("/") ||
			normalized.includes("\\") ||
			normalized.includes("\0")
		) {
			return "Unsafe item path segment: encoded traversal detected";
		}
	}

	return null;
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

function getMergeTargetLockPath(targetPath: string): string {
	const lockName = `.${basename(targetPath)}.ck-merge.lock`;
	return join(dirname(targetPath), lockName);
}

async function withMergeTargetLock<T>(targetPath: string, operation: () => Promise<T>): Promise<T> {
	const resolvedTargetPath = resolve(targetPath);
	await ensureDir(resolvedTargetPath);

	const release = await lockfile.lock(dirname(resolvedTargetPath), {
		realpath: false,
		lockfilePath: getMergeTargetLockPath(resolvedTargetPath),
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

/**
 * Parse merged AGENTS.md into a map of agent name -> section content
 * Sections are separated by "---" and start with "## Agent: {name}"
 */
type MergeSectionKind = "agent" | "rule" | "config";
type ParsedSectionKind = MergeSectionKind | "unknown";

const SECTION_HEADING_PATTERNS: Record<MergeSectionKind, RegExp> = {
	agent: /^##\s*agent\s*:\s*(.+?)\s*$/im,
	rule: /^##\s*rule\s*:\s*(.+?)\s*$/im,
	config: /^##\s*config\s*$/im,
};

interface ParsedSection {
	kind: ParsedSectionKind;
	key: string;
	content: string;
}

interface ParsedMergedSections {
	sections: ParsedSection[];
	preamble: string;
	warnings: string[];
}

/**
 * Split content by --- separators, ignoring separators inside fenced code blocks.
 * Also returns the index of the first managed section heading (outside fences).
 */
function splitManagedContent(content: string): { preambleEnd: number; parts: string[] } {
	const lines = content.split(/\r?\n/);
	let inFence = false;
	let firstManagedIndex = -1;
	const separatorIndices: number[] = [];
	let currentLineIndex = 0;

	// Track fence state and find first managed heading outside fence
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmedLine = line.trim();

		// Toggle fence state on ``` or ~~~ markers
		if (trimmedLine.startsWith("```") || trimmedLine.startsWith("~~~")) {
			inFence = !inFence;
		}

		// Only detect headings and separators when NOT inside fence
		if (!inFence) {
			// Check for managed section headings (reuse SECTION_HEADING_PATTERNS)
			const isManagedHeading = Object.values(SECTION_HEADING_PATTERNS).some((regex) =>
				regex.test(trimmedLine),
			);
			if (isManagedHeading) {
				if (firstManagedIndex === -1) {
					firstManagedIndex = currentLineIndex;
				}
			}

			// Check for separator (--- with optional surrounding whitespace)
			if (/^[ \t]*---[ \t]*$/.test(trimmedLine)) {
				separatorIndices.push(currentLineIndex);
			}
		}

		currentLineIndex += line.length + 1; // +1 for newline
	}

	if (firstManagedIndex === -1) {
		return { preambleEnd: content.length, parts: [] };
	}

	const managedContent = content.slice(firstManagedIndex);
	const managedStart = firstManagedIndex;

	// Split by separator indices that fall within managed content
	const parts: string[] = [];
	let lastSplitPos = 0;

	for (const sepIdx of separatorIndices) {
		if (sepIdx >= managedStart) {
			const relativeIdx = sepIdx - managedStart;
			if (relativeIdx > lastSplitPos) {
				const part = managedContent.slice(lastSplitPos, relativeIdx).trim();
				if (part) parts.push(part);
			}
			// Skip past separator line and following newlines
			const sepLineEnd = managedContent.indexOf("\n", relativeIdx);
			lastSplitPos = sepLineEnd >= 0 ? sepLineEnd + 1 : managedContent.length;
		}
	}

	// Add final part
	const finalPart = managedContent.slice(lastSplitPos).trim();
	if (finalPart) parts.push(finalPart);

	return { preambleEnd: firstManagedIndex, parts };
}

function parseSectionMetadata(content: string): { kind: MergeSectionKind; key: string } | null {
	const agentMatch = content.match(SECTION_HEADING_PATTERNS.agent);
	if (agentMatch) {
		return { kind: "agent", key: agentMatch[1].trim() };
	}

	const ruleMatch = content.match(SECTION_HEADING_PATTERNS.rule);
	if (ruleMatch) {
		return { kind: "rule", key: ruleMatch[1].trim() };
	}

	if (SECTION_HEADING_PATTERNS.config.test(content)) {
		return { kind: "config", key: "config" };
	}

	return null;
}

function parseMergedSections(content: string): ParsedMergedSections {
	const sections: ParsedSection[] = [];
	const warnings: string[] = [];

	const { preambleEnd, parts } = splitManagedContent(content);

	if (parts.length === 0) {
		return {
			sections,
			preamble: content.trim(),
			warnings,
		};
	}

	let unknownIndex = 0;
	const seenKeys = new Map<string, number>(); // composite key -> index in sections array

	for (const part of parts) {
		const trimmed = part.trim();
		if (!trimmed) continue;

		const metadata = parseSectionMetadata(trimmed);
		if (metadata) {
			const compositeKey = `${metadata.kind}:${metadata.key}`;
			const existingIndex = seenKeys.get(compositeKey);

			if (existingIndex !== undefined) {
				warnings.push(
					`Duplicate ${metadata.kind} section "${metadata.key}" in existing file; keeping last occurrence`,
				);
				// Remove previous occurrence
				sections.splice(existingIndex, 1);
				// Update indices in seenKeys map (all entries after deleted index shift down by 1)
				for (const [key, idx] of seenKeys) {
					if (idx > existingIndex) {
						seenKeys.set(key, idx - 1);
					}
				}
			}

			const newIndex = sections.length;
			sections.push({
				kind: metadata.kind,
				key: metadata.key,
				content: trimmed,
			});
			seenKeys.set(compositeKey, newIndex);
			continue;
		}

		// Preserve unknown sections so user-authored content is never dropped.
		unknownIndex += 1;
		sections.push({
			kind: "unknown",
			key: `unknown-${unknownIndex}`,
			content: trimmed,
		});
	}

	// Strip generated merge headers from preamble if present
	let preamble = content.slice(0, preambleEnd).trimEnd();
	preamble = preamble
		.replace(
			/^# Agents\r?\n\r?\n> Ported from Claude Code agents via ClaudeKit CLI \(ck agents\)\r?\n> Target: .*\r?\n+/is,
			"",
		)
		.replace(
			/^# Rules\r?\n\r?\n> Ported from Claude Code rules via ClaudeKit CLI \(ck migrate --rules\)\r?\n> Target: .*\r?\n+/is,
			"",
		)
		.replace(/^# Config\r?\n\r?\n> Ported from Claude Code config via ClaudeKit CLI.*\r?\n+/is, "")
		.trimEnd();

	return {
		sections,
		preamble: preamble.trim(),
		warnings,
	};
}

function getMergeSectionKey(kind: MergeSectionKind, item: PortableItem): string {
	if (kind === "config") return "config";
	if (kind === "agent") return item.frontmatter.name || item.name;
	return item.name;
}

function buildMergeSectionContent(
	kind: MergeSectionKind,
	sectionKey: string,
	convertedContent: string,
): string {
	if (kind === "config") {
		return `## Config\n\n${convertedContent.trim()}\n`;
	}
	if (kind === "rule") {
		return `## Rule: ${sectionKey}\n\n${convertedContent.trim()}\n`;
	}
	return convertedContent.trimEnd();
}

/**
 * Parse YAML modes file into a map of slug -> YAML entry
 * Entries start with "  - slug: " and are indented
 */
function parseYamlModesFile(content: string): Map<string, string> {
	const modes = new Map<string, string>();

	// Remove "customModes:" header
	const match = content.match(/customModes:\s*\n/);
	if (!match || match.index === undefined) return modes;

	const modesContent = content.slice(match.index + match[0].length);

	// Split by "  - slug:" pattern
	const parts = modesContent.split(/(?=\n {2}- slug:)/);

	for (const part of parts) {
		const trimmed = part.trim();
		if (!trimmed) continue;

		// Extract slug from '  - slug: "value"'
		const slugMatch = trimmed.match(/- slug:\s*"([^"]+)"/);
		if (slugMatch) {
			const slug = slugMatch[1];
			modes.set(slug, part); // Keep original indentation
		}
	}

	return modes;
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
	const typeKey =
		portableType === "agent"
			? "agents"
			: portableType === "command"
				? "commands"
				: portableType === "skill"
					? "skills"
					: portableType === "config"
						? "config"
						: "rules";
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

	const segmentError = validatePortableItemSegments(item);
	if (segmentError) {
		return {
			provider,
			providerDisplayName: config.displayName,
			success: false,
			path: basePath,
			error: segmentError,
		};
	}

	let targetPath = basePath;
	let targetSnapshot: FileSnapshot | null = null;
	try {
		// Convert to target format
		const result = convertItem(item, pathConfig.format, provider);
		if (result.error) {
			return {
				provider,
				providerDisplayName: config.displayName,
				success: false,
				path: targetPath,
				error: `Failed to convert ${item.name}: ${result.error}`,
				warnings: result.warnings.length > 0 ? result.warnings : undefined,
			};
		}
		// Flatten nested filename if provider doesn't support nested commands
		let resolvedFilename = result.filename;
		if (pathConfig.nestedCommands === false && resolvedFilename.includes("/")) {
			const extIdx = resolvedFilename.lastIndexOf(".");
			const ext = extIdx >= 0 ? resolvedFilename.substring(extIdx) : "";
			const nameWithoutExt = extIdx >= 0 ? resolvedFilename.substring(0, extIdx) : resolvedFilename;
			resolvedFilename = `${nameWithoutExt.replace(/\//g, "-")}${ext}`;
		}

		targetPath =
			pathConfig.writeStrategy === "single-file" ? basePath : join(basePath, resolvedFilename);

		// Guard against path traversal
		const resolvedTarget = resolve(targetPath);
		const resolvedBase =
			pathConfig.writeStrategy === "single-file" ? resolve(dirname(basePath)) : resolve(basePath);
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

		await ensureDir(targetPath);
		targetSnapshot = await captureFileSnapshot(targetPath);
		const alreadyExists = targetSnapshot.existed;
		await writeFile(targetPath, result.content, "utf-8");

		// Compute checksums for v3.0 registry
		const sourceChecksum = computeContentChecksum(result.content);
		const targetChecksum = sourceChecksum; // Same for per-file strategy

		await addPortableInstallation(
			item.name,
			portableType,
			provider,
			options.global,
			targetPath,
			item.sourcePath,
			{
				sourceChecksum,
				targetChecksum,
				installSource: "kit",
			},
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
		let errorMessage = getErrorMessage(error, targetPath);
		if (targetSnapshot) {
			try {
				await restoreFileSnapshots([targetSnapshot]);
			} catch (rollbackError) {
				errorMessage = `${errorMessage}; rollback failed: ${getErrorMessage(rollbackError, targetPath)}`;
			}
		}
		return {
			provider,
			providerDisplayName: config.displayName,
			success: false,
			path: targetPath,
			error: errorMessage,
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
	const typeKey =
		portableType === "agent"
			? "agents"
			: portableType === "command"
				? "commands"
				: portableType === "skill"
					? "skills"
					: portableType === "config"
						? "config"
						: "rules";
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

	const targetPathError = validateStrategyTargetPath(targetPath, options);
	if (targetPathError) {
		return {
			provider,
			providerDisplayName: config.displayName,
			success: false,
			path: targetPath,
			error: targetPathError,
		};
	}

	try {
		return await withMergeTargetLock(targetPath, async () => {
			let targetSnapshot: FileSnapshot | null = null;
			try {
				const sectionKind: MergeSectionKind =
					portableType === "rules" ? "rule" : portableType === "config" ? "config" : "agent";
				if (sectionKind === "config" && items.length > 1) {
					return {
						provider,
						providerDisplayName: config.displayName,
						success: false,
						path: targetPath,
						error: "Config merge target accepts only one item per install",
					};
				}

				// Read existing file if present
				const alreadyExists = existsSync(targetPath);
				let existingSections: ParsedSection[] = [];
				let existingPreamble = "";
				const allWarnings: string[] = [];

				if (alreadyExists) {
					try {
						const existing = await readFile(targetPath, "utf-8");
						const parsed = parseMergedSections(existing);
						existingSections = parsed.sections;
						existingPreamble = parsed.preamble;
						// Propagate parsing warnings
						allWarnings.push(...parsed.warnings);
					} catch (error) {
						if (!isErrnoCode(error, "ENOENT")) {
							return {
								provider,
								providerDisplayName: config.displayName,
								success: false,
								path: targetPath,
								error: `Failed to read existing merged file: ${getErrorMessage(error, targetPath)}`,
							};
						}
					}
				}

				// Convert all items
				const newOwnedSections = new Map<string, string>();
				const newSourceChecksums = new Map<string, string>();
				for (const item of items) {
					const segmentError = validatePortableItemSegments(item);
					if (segmentError) {
						return {
							provider,
							providerDisplayName: config.displayName,
							success: false,
							path: targetPath,
							error: segmentError,
						};
					}

					const result = convertItem(item, pathConfig.format, provider);
					if (result.error) {
						return {
							provider,
							providerDisplayName: config.displayName,
							success: false,
							path: targetPath,
							error: `Failed to convert ${item.name}: ${result.error}`,
							warnings: result.warnings.length > 0 ? result.warnings : undefined,
						};
					}

					const sectionKey = getMergeSectionKey(sectionKind, item);
					if (newOwnedSections.has(sectionKey)) {
						allWarnings.push(
							`Duplicate ${sectionKind} section "${sectionKey}" in this batch; last item wins`,
						);
					}
					newOwnedSections.set(
						sectionKey,
						buildMergeSectionContent(sectionKind, sectionKey, result.content),
					);
					newSourceChecksums.set(sectionKey, computeContentChecksum(result.content));
					allWarnings.push(...result.warnings);
				}

				// Merge while preserving existing section order and unknown custom blocks.
				const mergedSections: ParsedSection[] = [];
				const replacedOwnedKeys = new Set<string>();
				for (const existingSection of existingSections) {
					if (existingSection.kind === sectionKind) {
						const replacement = newOwnedSections.get(existingSection.key);
						if (replacement !== undefined) {
							mergedSections.push({
								kind: sectionKind,
								key: existingSection.key,
								content: replacement,
							});
							replacedOwnedKeys.add(existingSection.key);
							continue;
						}
					}
					mergedSections.push(existingSection);
				}

				for (const [sectionKey, sectionContent] of newOwnedSections) {
					if (!replacedOwnedKeys.has(sectionKey)) {
						mergedSections.push({
							kind: sectionKind,
							key: sectionKey,
							content: sectionContent,
						});
					}
				}

				// Build merged file — preserve preamble if present
				const sections = mergedSections
					.map((section) => section.content)
					.filter((s) => s.trim().length > 0);
				const onlyAgentSections = mergedSections.every((section) => section.kind === "agent");
				let content: string;
				if (sections.length === 0) {
					content = existingPreamble ? `${existingPreamble.trim()}\n` : "";
				} else if (existingPreamble) {
					content = `${existingPreamble.trim()}\n\n---\n\n${sections.join("\n---\n\n")}\n`;
				} else if (sectionKind === "agent" && onlyAgentSections) {
					content = buildMergedAgentsMd(sections, config.displayName);
				} else {
					content = `${sections.join("\n---\n\n")}\n`;
				}

				targetSnapshot = await captureFileSnapshot(targetPath);
				await writeFile(targetPath, content, "utf-8");

				// Register each item with section-level checksums
				for (const item of items) {
					const sectionKey = getMergeSectionKey(sectionKind, item);
					const sectionContent = newOwnedSections.get(sectionKey) || "";
					const sourceChecksum =
						newSourceChecksums.get(sectionKey) ?? computeContentChecksum(item.body);
					// Use section content as target checksum (not whole file)
					const targetChecksum = computeContentChecksum(sectionContent);

					await addPortableInstallation(
						item.name,
						portableType,
						provider,
						options.global,
						targetPath,
						item.sourcePath,
						{
							sourceChecksum,
							targetChecksum,
							ownedSections: [sectionKey], // Only THIS item's section
							installSource: "kit",
						},
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
				let errorMessage = getErrorMessage(error, targetPath);
				if (targetSnapshot) {
					try {
						await restoreFileSnapshots([targetSnapshot]);
					} catch (rollbackError) {
						errorMessage = `${errorMessage}; rollback failed: ${getErrorMessage(rollbackError, targetPath)}`;
					}
				}
				return {
					provider,
					providerDisplayName: config.displayName,
					success: false,
					path: targetPath,
					error: errorMessage,
				};
			}
		});
	} catch (error) {
		return {
			provider,
			providerDisplayName: config.displayName,
			success: false,
			path: targetPath,
			error: `Failed to acquire merge lock: ${getErrorMessage(error, targetPath)}`,
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

	const targetPathError = validateStrategyTargetPath(targetPath, options);
	if (targetPathError) {
		return {
			provider,
			providerDisplayName: config.displayName,
			success: false,
			path: targetPath,
			error: targetPathError,
		};
	}

	let targetSnapshot: FileSnapshot | null = null;
	try {
		// Read existing file if present
		const alreadyExists = existsSync(targetPath);
		let existingModes = new Map<string, string>();
		if (alreadyExists) {
			try {
				const existing = await readFile(targetPath, "utf-8");
				existingModes = parseYamlModesFile(existing);
			} catch (error) {
				if (!isErrnoCode(error, "ENOENT")) {
					return {
						provider,
						providerDisplayName: config.displayName,
						success: false,
						path: targetPath,
						error: `Failed to read existing YAML modes file: ${getErrorMessage(error, targetPath)}`,
					};
				}
			}
		}

		// Convert all items to YAML entries
		const newModes = new Map<string, string>();
		for (const item of items) {
			const segmentError = validatePortableItemSegments(item);
			if (segmentError) {
				return {
					provider,
					providerDisplayName: config.displayName,
					success: false,
					path: targetPath,
					error: segmentError,
				};
			}

			const result = convertItem(item, pathConfig.format, provider);
			if (result.error) {
				return {
					provider,
					providerDisplayName: config.displayName,
					success: false,
					path: targetPath,
					error: `Failed to convert ${item.name}: ${result.error}`,
					warnings: result.warnings.length > 0 ? result.warnings : undefined,
				};
			}
			// result.filename contains the slug for YAML entries
			newModes.set(result.filename, result.content);
		}

		// Merge: new modes overwrite existing, keep non-matching existing
		for (const [slug, content] of existingModes) {
			if (!newModes.has(slug)) {
				newModes.set(slug, content);
			}
		}

		// Build merged file with all entries
		const entries = Array.from(newModes.values());
		const content = buildYamlModesFile(entries);

		await ensureDir(targetPath);
		targetSnapshot = await captureFileSnapshot(targetPath);
		await writeFile(targetPath, content, "utf-8");

		// Compute checksums for v3.0 registry
		const targetChecksum = computeContentChecksum(content);
		const ownedSections = items.map((item) => {
			// Extract slug from converted result (stored in newModes keys)
			const result = convertItem(item, pathConfig.format, provider);
			return result.filename; // Slug for YAML entries
		});

		for (const item of items) {
			const result = convertItem(item, pathConfig.format, provider);
			const sourceChecksum = computeContentChecksum(result.content);

			await addPortableInstallation(
				item.name,
				portableType,
				provider,
				options.global,
				targetPath,
				item.sourcePath,
				{
					sourceChecksum,
					targetChecksum,
					ownedSections,
					installSource: "kit",
				},
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
		let errorMessage = getErrorMessage(error, targetPath);
		if (targetSnapshot) {
			try {
				await restoreFileSnapshots([targetSnapshot]);
			} catch (rollbackError) {
				errorMessage = `${errorMessage}; rollback failed: ${getErrorMessage(rollbackError, targetPath)}`;
			}
		}
		return {
			provider,
			providerDisplayName: config.displayName,
			success: false,
			path: targetPath,
			error: errorMessage,
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

	const basePathError = validateStrategyTargetPath(basePath, options);
	if (basePathError) {
		return {
			provider,
			providerDisplayName: config.displayName,
			success: false,
			path: basePath,
			error: basePathError,
		};
	}

	const rollbackSnapshots: FileSnapshot[] = [];
	let failurePath = basePath;
	try {
		// Convert all items to Cline mode objects
		const modes: ClineCustomMode[] = [];
		for (const item of items) {
			const segmentError = validatePortableItemSegments(item);
			if (segmentError) {
				return {
					provider,
					providerDisplayName: config.displayName,
					success: false,
					path: basePath,
					error: segmentError,
				};
			}

			const result = convertItem(item, pathConfig.format, provider);
			if (result.error) {
				return {
					provider,
					providerDisplayName: config.displayName,
					success: false,
					path: basePath,
					error: `Failed to convert ${item.name}: ${result.error}`,
					warnings: result.warnings.length > 0 ? result.warnings : undefined,
				};
			}
			let parsedModeRaw: unknown;
			try {
				parsedModeRaw = JSON.parse(result.content);
			} catch (error) {
				return {
					provider,
					providerDisplayName: config.displayName,
					success: false,
					path: basePath,
					error: `Failed to parse generated Cline mode JSON for ${item.name}: ${getErrorMessage(error, basePath)}`,
				};
			}

			const parsedMode = ClineCustomModeSchema.safeParse(parsedModeRaw);
			if (!parsedMode.success) {
				return {
					provider,
					providerDisplayName: config.displayName,
					success: false,
					path: basePath,
					error: `Invalid Cline mode format for ${item.name}: ${parsedMode.error.issues[0]?.message || "schema validation failed"}`,
				};
			}

			modes.push(parsedMode.data);
		}

		// Write cline_custom_modes.json
		const modesPath = join(basePath, "cline_custom_modes.json");
		failurePath = modesPath;
		await ensureDir(modesPath);
		const alreadyExists = existsSync(modesPath);

		// Merge with existing modes if present
		if (alreadyExists) {
			try {
				const existingRaw = JSON.parse(await readFile(modesPath, "utf-8"));
				const parsedExisting = ClineCustomModesFileSchema.safeParse(existingRaw);
				if (!parsedExisting.success) {
					return {
						provider,
						providerDisplayName: config.displayName,
						success: false,
						path: modesPath,
						error: `Invalid existing Cline modes file format: ${parsedExisting.error.issues[0]?.message || "schema validation failed"}`,
					};
				}

				if (parsedExisting.data.customModes) {
					// Remove duplicates by slug, keep new versions
					const newSlugs = new Set(modes.map((m) => m.slug));
					const kept = parsedExisting.data.customModes.filter((m) => !newSlugs.has(m.slug));
					modes.push(...kept);
				}
			} catch (error) {
				if (!isErrnoCode(error, "ENOENT")) {
					return {
						provider,
						providerDisplayName: config.displayName,
						success: false,
						path: modesPath,
						error: `Failed to parse existing Cline modes JSON: ${getErrorMessage(error, modesPath)}`,
					};
				}
			}
		}

		const modesJson = buildClineModesJson(modes);
		rollbackSnapshots.push(await captureFileSnapshot(modesPath));
		await writeFile(modesPath, modesJson, "utf-8");

		// Compute checksums for v3.0 registry
		const targetChecksum = computeContentChecksum(modesJson);
		const ownedSections = modes.map((m) => m.slug);

		// Also write plain MD rules to .clinerules/
		const rulesDir = join(dirname(basePath), ".clinerules");
		await mkdir(rulesDir, { recursive: true });
		const capturedRuleSnapshots = new Set<string>();
		for (const item of items) {
			const namespacedName =
				item.name.includes("/") || item.name.includes("\\")
					? item.name.replace(/\\/g, "/")
					: item.segments && item.segments.length > 0
						? item.segments.join("/")
						: item.name;
			// Validate namespacedName segments before constructing path
			const nameSegments = namespacedName.split("/").filter(Boolean);
			for (const seg of nameSegments) {
				if (seg === "." || seg === "..") {
					throw new Error(`Unsafe path segment in item name: ${seg}`);
				}
				let decoded: string;
				try {
					decoded = decodeURIComponent(seg);
				} catch {
					decoded = seg;
				}
				const norm = decoded.normalize("NFC");
				if (norm.includes("..") || norm === "." || norm.includes("\0")) {
					throw new Error("Unsafe path segment: encoded traversal detected");
				}
			}
			const filename = `${namespacedName}.md`;
			const rulePath = join(rulesDir, filename);
			failurePath = rulePath;
			const resolvedRulePath = resolve(rulePath);
			const resolvedRulesDir = resolve(rulesDir);
			if (
				!resolvedRulePath.startsWith(resolvedRulesDir + sep) &&
				resolvedRulePath !== resolvedRulesDir
			) {
				throw new Error(`Unsafe path: rule target escapes rules directory (${rulePath})`);
			}
			await ensureDir(rulePath);
			if (!capturedRuleSnapshots.has(rulePath)) {
				rollbackSnapshots.push(await captureFileSnapshot(rulePath));
				capturedRuleSnapshots.add(rulePath);
			}
			await writeFile(
				rulePath,
				`# ${item.frontmatter.name || item.name}\n\n${item.body}\n`,
				"utf-8",
			);
		}

		for (const item of items) {
			const result = convertItem(item, pathConfig.format, provider);
			const sourceChecksum = computeContentChecksum(result.content);

			await addPortableInstallation(
				item.name,
				portableType,
				provider,
				options.global,
				modesPath,
				item.sourcePath,
				{
					sourceChecksum,
					targetChecksum,
					ownedSections,
					installSource: "kit",
				},
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
		let errorMessage = getErrorMessage(error, failurePath);
		if (rollbackSnapshots.length > 0) {
			try {
				await restoreFileSnapshots(rollbackSnapshots);
			} catch (rollbackError) {
				errorMessage = `${errorMessage}; rollback failed: ${getErrorMessage(rollbackError, failurePath)}`;
			}
		}
		return {
			provider,
			providerDisplayName: config.displayName,
			success: false,
			path: basePath,
			error: errorMessage,
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
		portableType === "agent"
			? "agents"
			: portableType === "command"
				? "commands"
				: portableType === "skill"
					? "skills"
					: portableType === "config"
						? "config"
						: "rules";
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
		case "single-file":
			return installPerFile(items[0], provider, portableType, options);
		case "per-file": {
			// For per-file, install each item individually and aggregate results
			// Track aggregate char count for providers with totalCharLimit (e.g., Windsurf 12K)
			const results: PortableInstallResult[] = [];
			let aggregateChars = 0;
			const totalCharLimit = pathConfig.totalCharLimit;

			for (const item of items) {
				// Pre-compute converted size to enforce aggregate limit BEFORE writing
				let itemSize = 0;
				if (totalCharLimit) {
					try {
						const converted = convertItem(item, pathConfig.format, provider);
						itemSize = converted.content.length;
					} catch {
						itemSize = 0; // fail-open: install anyway if measurement fails
					}

					if (aggregateChars + itemSize > totalCharLimit) {
						results.push({
							provider,
							providerDisplayName: config.displayName,
							success: true,
							path: "",
							skipped: true,
							skipReason: `Would exceed aggregate char limit (${aggregateChars}+${itemSize}/${totalCharLimit})`,
							warnings: [
								`Skipped "${item.name}": would exceed ${totalCharLimit} char limit (${aggregateChars}+${itemSize})`,
							],
						});
						continue;
					}
				}

				const result = await installPerFile(item, provider, portableType, options);

				// Track chars written for aggregate limit
				if (result.success && !result.skipped) {
					aggregateChars += itemSize;
				}

				results.push(result);
			}

			// Return aggregated result
			const successes = results.filter((r) => r.success && !r.skipped);
			const failures = results.filter((r) => !r.success);
			const warnings = results.flatMap((r) => r.warnings || []);
			for (const failure of failures) {
				if (failure.error) {
					warnings.push(`Failed item: ${failure.error}`);
				}
			}

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
 * Install portable items to multiple providers (parallel execution)
 */
export async function installPortableItems(
	items: PortableItem[],
	targetProviders: ProviderType[],
	portableType: PortableType,
	options: { global: boolean },
): Promise<PortableInstallResult[]> {
	const uniqueProviders = Array.from(new Set(targetProviders));
	const results: PortableInstallResult[] = [];
	for (const provider of uniqueProviders) {
		// Override global option for providers that only support global installs
		const providerOptions = { ...options };
		if (provider === "codex" && portableType === "command" && !options.global) {
			// Codex commands are global-only (~/.codex/prompts/)
			providerOptions.global = true;
		}
		results.push(await installPortableItem(items, provider, portableType, providerOptions));
	}
	return results;
}
