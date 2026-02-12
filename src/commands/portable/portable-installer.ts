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
 * Parse merged AGENTS.md into a map of agent name -> section content
 * Sections are separated by "---" and start with "## Agent: {name}"
 */
type MergeSectionKind = "agent" | "rule";

interface ParsedMergedSections {
	sections: Map<string, string>;
	preamble: string;
}

function parseMergedSections(content: string, kind: MergeSectionKind): ParsedMergedSections {
	const headingRegex = kind === "agent" ? /^## Agent:\s*(.+?)$/m : /^## Rule:\s*(.+?)$/m;
	const sections = new Map<string, string>();

	const firstMatch = content.match(headingRegex);
	if (!firstMatch || firstMatch.index === undefined) {
		return {
			sections,
			preamble: content.trim(),
		};
	}

	const managedContent = content.slice(firstMatch.index);

	// Split by --- separator
	const parts = managedContent.split(/\n---\n+/);

	for (const part of parts) {
		const trimmed = part.trim();
		if (!trimmed) continue;

		// Extract section name from heading
		const match = trimmed.match(headingRegex);
		if (match) {
			const sectionName = match[1].trim();
			sections.set(sectionName, trimmed);
		}
	}

	// Strip generated merge header from preamble if present
	let preamble = content.slice(0, firstMatch.index).trimEnd();
	if (kind === "agent") {
		preamble = preamble
			.replace(
				/^# Agents\n\n> Ported from Claude Code agents via ClaudeKit CLI \(ck agents\)\n> Target: .*\n+/s,
				"",
			)
			.trimEnd();
	} else {
		preamble = preamble
			.replace(
				/^# Rules\n\n> Ported from Claude Code rules via ClaudeKit CLI \(ck port --rules\)\n> Target: .*\n+/s,
				"",
			)
			.trimEnd();
	}

	return {
		sections,
		preamble: preamble.trim(),
	};
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

	// Convert to target format
	const result = convertItem(item, pathConfig.format, provider);
	const targetPath =
		pathConfig.writeStrategy === "single-file" ? basePath : join(basePath, result.filename);

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

	try {
		// Read existing file if present
		const alreadyExists = existsSync(targetPath);
		const sectionKind: MergeSectionKind = portableType === "rules" ? "rule" : "agent";
		let existingSections = new Map<string, string>();
		let existingPreamble = "";
		if (alreadyExists) {
			try {
				const existing = await readFile(targetPath, "utf-8");
				const parsed = parseMergedSections(existing, sectionKind);
				existingSections = parsed.sections;
				existingPreamble = parsed.preamble;
			} catch {
				// Ignore read errors, proceed with empty map
			}
		}

		// Convert all items
		const newSections = new Map<string, string>();
		const allWarnings: string[] = [];
		for (const item of items) {
			const result = convertItem(item, pathConfig.format, provider);
			const sectionName = sectionKind === "agent" ? item.frontmatter.name || item.name : item.name;
			const sectionContent =
				sectionKind === "agent"
					? result.content.trimEnd()
					: `## Rule: ${sectionName}\n\n${result.content.trim()}\n`;
			newSections.set(sectionName, sectionContent);
			allWarnings.push(...result.warnings);
		}

		// Merge: new sections overwrite existing, keep non-matching existing
		for (const [name, content] of existingSections) {
			if (!newSections.has(name)) {
				newSections.set(name, content);
			}
		}

		// Build merged file — preserve preamble if present
		const sections = Array.from(newSections.values()).filter(
			(section) => section.trim().length > 0,
		);
		let content: string;
		if (sections.length === 0) {
			content = existingPreamble ? `${existingPreamble.trim()}\n` : "";
		} else if (existingPreamble) {
			content = `${existingPreamble.trim()}\n\n---\n\n${sections.join("\n---\n\n")}\n`;
		} else if (sectionKind === "agent") {
			content = buildMergedAgentsMd(sections, config.displayName);
		} else {
			content = `${sections.join("\n---\n\n")}\n`;
		}

		await ensureDir(targetPath);
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
		// Read existing file if present
		const alreadyExists = existsSync(targetPath);
		let existingModes = new Map<string, string>();
		if (alreadyExists) {
			try {
				const existing = await readFile(targetPath, "utf-8");
				existingModes = parseYamlModesFile(existing);
			} catch {
				// Ignore read errors, proceed with empty map
			}
		}

		// Convert all items to YAML entries
		const newModes = new Map<string, string>();
		for (const item of items) {
			const result = convertItem(item, pathConfig.format, provider);
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
			const namespacedName =
				item.name.includes("/") || item.name.includes("\\")
					? item.name.replace(/\\/g, "/")
					: item.segments && item.segments.length > 0
						? item.segments.join("/")
						: item.name;
			const filename = `${namespacedName}.md`;
			const rulePath = join(rulesDir, filename);
			const resolvedRulePath = resolve(rulePath);
			const resolvedRulesDir = resolve(rulesDir);
			if (
				!resolvedRulePath.startsWith(resolvedRulesDir + sep) &&
				resolvedRulePath !== resolvedRulesDir
			) {
				throw new Error(`Unsafe path: rule target escapes rules directory (${rulePath})`);
			}
			await ensureDir(rulePath);
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
