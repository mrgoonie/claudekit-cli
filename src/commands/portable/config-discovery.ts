import { existsSync, readFileSync } from "node:fs";
import { cp, mkdir, readFile, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import {
	findExistingProjectConfigPath,
	findExistingProjectLayoutPath,
} from "@/shared/kit-layout.js";
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

/**
 * Subdirectory names that must never be copied to a target hooks directory.
 * - `__tests__`, `tests`: unit tests, not required at runtime
 * - `.logs`: per-hook runtime log output (written, not read)
 * - `docs`: JSDoc or markdown authors occasionally drop here; hooks never
 *   `require()` from docs/, so copying it just bloats the target
 */
const HOOKS_SKIP_DIR_NAMES = new Set(["__tests__", "tests", ".logs", "docs"]);

/**
 * Dotfiles (in the hooks source root, NOT subdirs) that should accompany
 * hook scripts to the target because hooks require them at runtime.
 */
const HOOKS_COMPANION_DOTFILES = new Set([".ckignore"]);

/**
 * Result of copying companion directories for a hooks install.
 */
export interface HooksCompanionCopyResult {
	/** Subdirectory names successfully copied */
	copiedDirs: string[];
	/** Companion dotfiles (e.g. .ckignore) successfully copied */
	copiedDotfiles: string[];
	/** Non-fatal errors encountered during copy (per dir/file) */
	errors: Array<{ name: string; error: string }>;
}

/**
 * Copy hook companion directories (e.g. lib/, scout-block/) and companion dotfiles
 * (e.g. .ckignore) from a source hooks directory to a target directory.
 *
 * Called after hook .cjs files are installed so that `require('./lib/*.cjs')` calls
 * inside hooks resolve without MODULE_NOT_FOUND errors.
 *
 * Rules:
 * - Only subdirectories are copied (not top-level files — those are handled by installPerFile).
 * - Directories listed in HOOKS_SKIP_DIR_NAMES (__tests__, tests, .logs, docs) are excluded.
 * - Directories whose names start with "." are excluded.
 * - Dotfiles in HOOKS_COMPANION_DOTFILES (.ckignore) are copied from the source hooks
 *   directory's PARENT to the target's PARENT (e.g. ~/.claude/.ckignore →
 *   ~/.codex/.ckignore). This matches scout-block's `path.dirname(__dirname)` lookup.
 * - Source and target identical paths are silently skipped (no-op for claude-code → claude-code).
 * - Individual copy failures are non-fatal; they are collected in errors[].
 */
export async function copyHooksCompanionDirs(
	sourceDir: string,
	targetDir: string,
): Promise<HooksCompanionCopyResult> {
	const result: HooksCompanionCopyResult = {
		copiedDirs: [],
		copiedDotfiles: [],
		errors: [],
	};

	// Same-path guard: when source IS the target (claude-code project scope), skip entirely.
	if (resolve(sourceDir) === resolve(targetDir)) {
		return result;
	}

	if (!existsSync(sourceDir)) {
		return result;
	}

	let entries: Array<import("node:fs").Dirent<string>>;
	try {
		entries = await readdir(sourceDir, { withFileTypes: true, encoding: "utf8" });
	} catch {
		return result;
	}

	// Non-fatal mkdir per function contract. In practice the hooks dir already
	// exists from per-file install, but an ACL-restricted target would
	// otherwise throw past the caller and abort downstream steps.
	try {
		await mkdir(targetDir, { recursive: true });
	} catch (err) {
		result.errors.push({
			name: targetDir,
			error: err instanceof Error ? err.message : String(err),
		});
		return result;
	}

	// Copy companion dotfiles from source's PARENT dir to target's PARENT dir.
	// scout-block resolves `.ckignore` via `path.dirname(__dirname)` — i.e. at
	// ~/.codex/.ckignore (not ~/.codex/hooks/.ckignore). So we mirror the layout.
	const sourceParent = resolve(sourceDir, "..");
	const targetParent = resolve(targetDir, "..");
	if (sourceParent !== targetParent) {
		for (const dotfile of HOOKS_COMPANION_DOTFILES) {
			const srcPath = join(sourceParent, dotfile);
			if (!existsSync(srcPath)) continue;
			const dstPath = join(targetParent, dotfile);
			try {
				await mkdir(targetParent, { recursive: true });
				await cp(srcPath, dstPath, { force: true });
				result.copiedDotfiles.push(dotfile);
			} catch (err) {
				result.errors.push({
					name: dotfile,
					error: err instanceof Error ? err.message : String(err),
				});
			}
		}
	}

	for (const entry of entries) {
		// Only process directories
		if (!entry.isDirectory()) continue;

		// Skip hidden dirs and excluded test dirs
		if (entry.name.startsWith(".") || HOOKS_SKIP_DIR_NAMES.has(entry.name)) continue;

		// Validate: no path traversal in dir name
		const safeName = basename(entry.name);
		if (!safeName || safeName === "." || safeName === ".." || safeName !== entry.name) continue;

		const srcDir = join(sourceDir, entry.name);
		const dstDir = join(targetDir, entry.name);

		// Skip if the resolved source subdir IS the target subdir
		if (resolve(srcDir) === resolve(dstDir)) continue;

		// TOCTOU guard: re-stat the entry — even though readdir already reported
		// it as a directory, another process could have raced to replace it
		// between readdir and the cp call. stat() follows symlinks, so a
		// symlink-to-dir still resolves as a directory here; the `isDirectory`
		// check on the Dirent above already filtered bare symlinks.
		try {
			const s = await stat(srcDir);
			if (!s.isDirectory()) continue;
		} catch {
			continue;
		}

		try {
			await cp(srcDir, dstDir, { recursive: true, force: true });
			result.copiedDirs.push(entry.name);
		} catch (err) {
			result.errors.push({
				name: entry.name,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}

	return result;
}

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
 * Get default config source path.
 *
 * @param globalOnly When true, bypass CWD discovery and return ~/.claude/CLAUDE.md
 *   directly. Used by `ck migrate -g` so SOURCE follows DESTINATION scope.
 *   Defaults to false: CWD/CLAUDE.md or CWD/.claude/CLAUDE.md first, then global.
 *
 * Checks both CWD/CLAUDE.md and CWD/.claude/CLAUDE.md because Claude Code
 * supports CLAUDE.md at the project root (standard convention) and inside
 * .claude/ (alternative location). Rules only live in .claude/rules/.
 */
export function getConfigSourcePath(globalOnly = false): string {
	if (globalOnly) return getGlobalConfigSourcePath();
	return findExistingProjectConfigPath(process.cwd()) ?? getGlobalConfigSourcePath();
}

/** Get the global config source path (always ~/.claude/CLAUDE.md). */
export function getGlobalConfigSourcePath(): string {
	return join(homedir(), ".claude", "CLAUDE.md");
}

/**
 * Get default rules source path.
 *
 * @param globalOnly When true, bypass CWD discovery and return ~/.claude/rules directly.
 *   Defaults to false: CWD .claude/rules first, then global fallback.
 */
export function getRulesSourcePath(globalOnly = false): string {
	const globalPath = join(homedir(), ".claude", "rules");
	if (globalOnly) return globalPath;
	return findExistingProjectLayoutPath(process.cwd(), "rules") ?? globalPath;
}

/**
 * Get default hooks source path.
 *
 * @param globalOnly When true, bypass CWD discovery and return ~/.claude/hooks directly.
 *   Defaults to false: CWD .claude/hooks first, then global fallback.
 */
export function getHooksSourcePath(globalOnly = false): string {
	const globalPath = join(homedir(), ".claude", "hooks");
	if (globalOnly) return globalPath;
	return findExistingProjectLayoutPath(process.cwd(), "hooks") ?? globalPath;
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
