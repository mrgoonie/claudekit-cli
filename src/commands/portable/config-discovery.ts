import { existsSync, readFileSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, extname, join, relative, sep } from "node:path";
import {
	type HooksSection,
	extractHookReferencesFromCommand,
	hookAssetBasename,
	isExcludedHookAsset,
	normalizeHookAssetPath,
} from "./hook-migration-compatibility.js";
import type { MigrationWarning, PortableItem } from "./types.js";

/** Node-runnable hook scripts — what Claude Code settings.json references via `node` command */
const HOOK_EXTENSIONS = new Set([".js", ".cjs", ".mjs", ".ts"]);

/** Shell/batch hook extensions that are skipped (not node-runnable) */
const SHELL_HOOK_EXTENSIONS = new Set([".sh", ".ps1", ".bat", ".cmd"]);
const HOOK_ASSET_EXTENSIONS = new Set([...HOOK_EXTENSIONS, ...SHELL_HOOK_EXTENSIONS]);
const HOOK_DEPENDENCY_SKIP_SEGMENTS = new Set(["__tests__", "tests", "docs", ".logs"]);

/** Determine if a source path is project-local or global */
export function resolveSourceOrigin(sourcePath: string | null): "project" | "global" {
	if (!sourcePath) return "global";
	const home = homedir();
	const cwd = process.cwd();
	// If CWD is home dir, can't distinguish — treat as global
	if (cwd === home) return "global";
	// Use separator-terminated prefix to avoid substring false positives
	// e.g., /home/kai/project vs /home/kai/project-other/rules
	const cwdPrefix = cwd.endsWith(sep) ? cwd : `${cwd}${sep}`;
	if (sourcePath === cwd || sourcePath.startsWith(cwdPrefix)) return "project";
	return "global";
}

/**
 * Get default config source path — CWD-first, then global fallback.
 * Checks both CWD/CLAUDE.md and CWD/.claude/CLAUDE.md because Claude Code
 * supports CLAUDE.md at the project root (standard convention) and inside
 * .claude/ (alternative location). Rules only live in .claude/rules/.
 */
export function getConfigSourcePath(): string {
	// Check project root CLAUDE.md first (standard Claude Code convention)
	const projectPath = join(process.cwd(), "CLAUDE.md");
	if (existsSync(projectPath)) {
		return projectPath;
	}
	// Also check .claude/CLAUDE.md at project level
	const projectDotClaudePath = join(process.cwd(), ".claude", "CLAUDE.md");
	if (existsSync(projectDotClaudePath)) {
		return projectDotClaudePath;
	}
	return getGlobalConfigSourcePath();
}

/** Get the global config source path (always ~/.claude/CLAUDE.md). */
export function getGlobalConfigSourcePath(): string {
	return join(homedir(), ".claude", "CLAUDE.md");
}

/** Get default rules source path — CWD-first, then global fallback */
export function getRulesSourcePath(): string {
	const projectPath = join(process.cwd(), ".claude", "rules");
	if (existsSync(projectPath)) {
		return projectPath;
	}
	return join(homedir(), ".claude", "rules");
}

/** Get default hooks source path (project preferred, then global fallback). */
export function getHooksSourcePath(): string {
	const projectPath = join(process.cwd(), ".claude", "hooks");
	if (existsSync(projectPath)) {
		return projectPath;
	}
	return join(homedir(), ".claude", "hooks");
}

/** Discover CLAUDE.md config file */
export async function discoverConfig(sourcePath?: string): Promise<PortableItem | null> {
	const path = sourcePath ?? getConfigSourcePath();

	if (!existsSync(path)) {
		return null;
	}

	const content = await readFile(path, "utf-8");

	return {
		name: "CLAUDE",
		description: "Project configuration",
		type: "config",
		sourcePath: path,
		frontmatter: {},
		body: content,
	};
}

/** Discover .claude/rules/ files */
export async function discoverRules(sourcePath?: string): Promise<PortableItem[]> {
	const path = sourcePath ?? getRulesSourcePath();

	if (!existsSync(path)) {
		return [];
	}

	return discoverPortableFiles(path, path, {
		type: "rules",
		includeExtensions: new Set([".md"]),
		stripExtension: true,
		descriptionPrefix: "Rule",
	});
}

/** Result of hook discovery including any skipped shell hook filenames */
export interface HookDiscoveryResult {
	items: PortableItem[];
	skippedShellHooks: string[];
	warnings?: MigrationWarning[];
}

/** Discover .claude/hooks/ files. Returns node-runnable hooks and names of skipped shell hooks. */
export async function discoverHooks(sourcePath?: string): Promise<HookDiscoveryResult> {
	const path = sourcePath ?? getHooksSourcePath();

	if (!existsSync(path)) {
		return { items: [], skippedShellHooks: [] };
	}

	const skippedShellHooks: string[] = [];
	const warnings: MigrationWarning[] = [];
	const discoveredFiles = await collectHookFiles(path);
	const fileMap = new Map(discoveredFiles.map((file) => [file.name, file]));
	const settingsHooks = await readHooksNearHooksDir(path);
	const referencedAssets = settingsHooks
		? collectReferencedHookAssets(settingsHooks, warnings)
		: new Set<string>();
	const selectedAssets =
		referencedAssets.size > 0
			? expandHookDependencyClosure(referencedAssets, fileMap)
			: new Set(
					discoveredFiles
						.filter((file) => !file.name.includes("/") && HOOK_EXTENSIONS.has(file.ext))
						.map((file) => file.name),
				);

	const items: PortableItem[] = [];
	for (const file of discoveredFiles) {
		if (isExcludedHookAsset(file.name)) {
			if (selectedAssets.has(file.name) || hookAssetBasename(file.name) === file.name) {
				warnings.push({
					reason: "excluded-hook",
					hookFile: file.name,
					message: `Skipped excluded hook ${file.name}`,
				});
			}
			continue;
		}
		if (!selectedAssets.has(file.name)) {
			if (SHELL_HOOK_EXTENSIONS.has(file.ext) && !skippedShellHooks.includes(file.name)) {
				skippedShellHooks.push(file.name);
			}
			continue;
		}
		if (SHELL_HOOK_EXTENSIONS.has(file.ext) && !referencedAssets.has(file.name)) {
			skippedShellHooks.push(file.name);
			continue;
		}

		try {
			const content = await readFile(file.fullPath, "utf-8");
			items.push({
				name: file.name,
				segments: file.name.split("/"),
				description: `Hook: ${file.name}`,
				type: "hooks",
				sourcePath: file.fullPath,
				frontmatter: {},
				body: content,
			});
		} catch (_err) {
			warnings.push({
				reason: "unreadable-hook-file",
				hookFile: file.name,
				message: `Skipped unreadable hook file ${file.name}`,
			});
		}
	}

	return {
		items,
		skippedShellHooks,
		warnings: warnings.length > 0 ? warnings : undefined,
	};
}

interface HookFileInfo {
	name: string;
	fullPath: string;
	ext: string;
}

async function readHooksNearHooksDir(hooksDir: string): Promise<HooksSection | null> {
	const settingsPath = join(dirname(hooksDir), "settings.json");
	if (!existsSync(settingsPath)) return null;
	try {
		const parsed = JSON.parse(await readFile(settingsPath, "utf-8")) as { hooks?: unknown };
		return parsed.hooks && typeof parsed.hooks === "object" ? (parsed.hooks as HooksSection) : null;
	} catch {
		return null;
	}
}

function collectReferencedHookAssets(
	hooks: HooksSection,
	warnings: MigrationWarning[],
): Set<string> {
	const referenced = new Set<string>();
	for (const [event, groups] of Object.entries(hooks)) {
		for (const group of groups) {
			for (const entry of group.hooks) {
				for (const ref of extractHookReferencesFromCommand(entry.command)) {
					const normalized = normalizeHookAssetPath(ref);
					if (!normalized) continue;
					if (isExcludedHookAsset(normalized)) {
						warnings.push({
							reason: "excluded-hook",
							event,
							hookFile: normalized,
							message: `Skipped excluded hook ${hookAssetBasename(normalized)}`,
						});
						continue;
					}
					referenced.add(normalized);
				}
			}
		}
	}
	return referenced;
}

async function collectHookFiles(dir: string, baseDir = dir): Promise<HookFileInfo[]> {
	const files: HookFileInfo[] = [];
	let entries: Array<import("node:fs").Dirent<string>>;
	try {
		entries = await readdir(dir, { withFileTypes: true, encoding: "utf8" });
	} catch {
		return files;
	}

	for (const entry of entries) {
		const fullPath = join(dir, entry.name);
		const relPath = relative(baseDir, fullPath).split(/[/\\]/).join("/");
		if (entry.isSymbolicLink()) continue;
		if (entry.isDirectory()) {
			if (!entry.name.startsWith(".") && !HOOK_DEPENDENCY_SKIP_SEGMENTS.has(entry.name)) {
				files.push(...(await collectHookFiles(fullPath, baseDir)));
			}
			continue;
		}
		if (!entry.isFile()) continue;
		const ext = extname(entry.name).toLowerCase();
		const isHookLocalDotfile = entry.name === ".ckignore" || entry.name === ".ck.json";
		if (!HOOK_ASSET_EXTENSIONS.has(ext) && !isHookLocalDotfile) continue;
		if (entry.name.startsWith(".") && !isHookLocalDotfile) continue;
		files.push({ name: relPath, fullPath, ext });
	}

	return files;
}

function expandHookDependencyClosure(
	initialAssets: Set<string>,
	fileMap: Map<string, HookFileInfo>,
): Set<string> {
	const selected = new Set<string>();
	const queue = [...initialAssets];

	while (queue.length > 0) {
		const current = normalizeHookAssetPath(queue.shift() ?? "");
		const file = fileMap.get(current) ?? fileMap.get(hookAssetBasename(current));
		if (!file || selected.has(file.name) || isExcludedHookAsset(file.name)) continue;

		selected.add(file.name);
		for (const dep of collectStaticRequireCandidates(file.name, fileMap)) {
			if (!selected.has(dep)) queue.push(dep);
		}
	}

	return selected;
}

function collectStaticRequireCandidates(
	assetName: string,
	fileMap: Map<string, HookFileInfo>,
): string[] {
	const file = fileMap.get(assetName);
	if (!file || !HOOK_EXTENSIONS.has(file.ext)) return [];
	let content = "";
	try {
		content = readFileSync(file.fullPath, "utf-8");
	} catch {
		return [];
	}

	const deps: string[] = [];
	for (const match of content.matchAll(/require\(["'](\.{1,2}\/[^"']+)["']\)/g)) {
		const raw = match[1];
		const base = dirname(assetName);
		const candidate = normalizeHookAssetPath(join(base, raw).split(/[/\\]/).join("/"));
		const ext = extname(candidate);
		const variants = ext
			? [candidate]
			: [`${candidate}.cjs`, `${candidate}.js`, `${candidate}.mjs`];
		for (const variant of variants) {
			if (fileMap.has(variant)) deps.push(variant);
		}
	}
	if (content.includes(".ckignore") && fileMap.has(".ckignore")) deps.push(".ckignore");
	if (content.includes(".ck.json") && fileMap.has(".ck.json")) deps.push(".ck.json");
	return deps;
}

interface DiscoverPortableFileOptions {
	type: "rules" | "hooks";
	includeExtensions: Set<string>;
	stripExtension: boolean;
	descriptionPrefix: "Rule" | "Hook";
	/**
	 * Whether to recurse into subdirectories (default: true).
	 * Hooks are top-level only — callers of discoverPortableFiles for hooks should set this to false.
	 */
	recursive?: boolean;
}

/** Helper for recursive discovery of portable files */
async function discoverPortableFiles(
	dir: string,
	baseDir: string,
	options: DiscoverPortableFileOptions,
): Promise<PortableItem[]> {
	const items: PortableItem[] = [];
	let entries: Array<import("node:fs").Dirent<string>>;
	try {
		entries = await readdir(dir, { withFileTypes: true, encoding: "utf8" });
	} catch {
		return items;
	}

	for (const entry of entries) {
		if (entry.name.startsWith(".")) continue;

		const fullPath = join(dir, entry.name);

		if (entry.isSymbolicLink()) {
			continue;
		}

		if (entry.isDirectory()) {
			if (options.recursive ?? true) {
				const nested = await discoverPortableFiles(fullPath, baseDir, options);
				items.push(...nested);
			}
			continue;
		}

		if (!entry.isFile()) {
			continue;
		}

		const extension = extname(entry.name).toLowerCase();
		if (!options.includeExtensions.has(extension)) continue;

		const relPath = relative(baseDir, fullPath);
		const normalizedPath = relPath.split(/[/\\]/).join("/");
		const name = options.stripExtension ? normalizedPath.replace(/\.[^.]+$/, "") : normalizedPath;

		try {
			const content = await readFile(fullPath, "utf-8");

			items.push({
				name,
				description: `${options.descriptionPrefix}: ${name}`,
				type: options.type,
				sourcePath: fullPath,
				frontmatter: {},
				body: content,
			});
		} catch (_err) {
			// Individual file read errors are non-fatal — skip and continue discovery
		}
	}

	return items;
}
