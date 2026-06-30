import { createHash } from "node:crypto";
import {
	cpSync,
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import {
	ENGINEER_KIT_KEY,
	type InstallMode,
	detectInstallMode,
	detectPluginState,
} from "@/domains/installation/plugin/install-mode-detector.js";
import { PluginInstaller } from "@/domains/installation/plugin/plugin-installer.js";
import { PathResolver } from "@/shared/path-resolver.js";

/**
 * Legacy -> plugin migration for the ClaudeKit Engineer kit.
 *
 * NOTE: this is an INTERNAL flow invoked by `ck init` / `ck update`. It is NOT a
 * new `ck migrate` command (that name already belongs to the portable/provider
 * reconciler). Ordering is rollback-safe: the destructive legacy cleanup runs
 * ONLY after the plugin install has verified, so a failed install leaves the
 * legacy copy untouched.
 */

export type MigrateAction =
	| "noop-already-plugin"
	| "skipped-cc-unsupported"
	| "install-failed"
	| "installed-fresh"
	| "migrated-from-legacy";

export interface MigrateResult {
	action: MigrateAction;
	/** Install mode observed BEFORE migration. */
	modeBefore: InstallMode;
	pluginVerified: boolean;
	backupDir: string | null;
	removedPaths: string[];
	receiptPath: string | null;
	error?: string;
}

/** Removes legacy ck-owned files; returns removed relative paths. Injectable for tests. */
export type LegacyRemover = (claudeDir: string, backupDir: string) => string[];

export interface MigrateOptions {
	/** Staged kit dir containing .claude-plugin/marketplace.json (the local marketplace source). */
	pluginSourceDir: string;
	claudeDir?: string;
	installer?: PluginInstaller;
	removeLegacy?: LegacyRemover;
	/** ISO timestamp; injected in tests, runtime passes new Date().toISOString(). */
	now?: string;
}

export async function migrateLegacyToPlugin(opts: MigrateOptions): Promise<MigrateResult> {
	const claudeDir = opts.claudeDir ?? PathResolver.getGlobalKitDir();
	const installer = opts.installer ?? new PluginInstaller(undefined, claudeDir);
	const removeLegacy = opts.removeLegacy ?? defaultLegacyRemover;
	const ts = opts.now ?? new Date().toISOString();

	const before = detectInstallMode(claudeDir);

	// Already plugin-only (no legacy copy left): nothing to do. "verified" reflects
	// the detector's enable state, not an unconditional true.
	if (before.mode === "plugin") {
		return base("noop-already-plugin", before.mode, before.plugin.enabled);
	}

	// Older Claude Code without plugin support: caller should fall back to legacy copy.
	if (!(await installer.isClaudeAvailable()) || !(await installer.isPluginSupported())) {
		return base("skipped-cc-unsupported", before.mode, false);
	}

	// Non-destructive: register/refresh marketplace + install/update + verify. Surface
	// command failures early before removing the legacy copy.
	const prepared = before.plugin.installed
		? await refreshExistingPlugin(installer, opts.pluginSourceDir, before.plugin.enabled)
		: await installPlugin(installer, opts.pluginSourceDir);
	if (!prepared.ok) {
		return {
			...base("install-failed", before.mode, false),
			error: prepared.error,
		};
	}
	const verified = await installer.verifyInstalled();
	if (!verified) {
		// Nothing destructive happened yet, so there is nothing to roll back.
		return {
			...base("install-failed", before.mode, false),
			error: "plugin did not verify after install",
		};
	}

	// Destructive step runs ONLY after a verified install.
	let backupDir: string | null = null;
	let removedPaths: string[] = [];
	if (before.legacy.installed) {
		backupDir = join(claudeDir, "backups", `ck-legacy-${ts.replace(/[:.]/g, "-")}`);
		mkdirSync(backupDir, { recursive: true });
		removedPaths = removeLegacy(claudeDir, backupDir);
	}

	// Record the version that is now installed (post-install), not the pre-install one.
	const installedVersion = detectPluginState(claudeDir).version;
	const receiptPath = writeReceipt(claudeDir, {
		fromMode: before.mode,
		toMode: "plugin",
		pluginVersion: installedVersion,
		backupDir,
		removedPaths,
		timestamp: ts,
	});

	return {
		action: before.legacy.installed ? "migrated-from-legacy" : "installed-fresh",
		modeBefore: before.mode,
		pluginVerified: true,
		backupDir,
		removedPaths,
		receiptPath,
	};
}

function base(
	action: MigrateAction,
	modeBefore: InstallMode,
	pluginVerified: boolean,
): MigrateResult {
	return {
		action,
		modeBefore,
		pluginVerified,
		backupDir: null,
		removedPaths: [],
		receiptPath: null,
	};
}

const PLUGIN_SUPPLIED_LEGACY_PREFIXES = ["agents/", "skills/"];
const LEGACY_SENTINEL_FILENAMES = new Set([".gitignore"]);

/**
 * Default legacy remover: backs up and removes ck-owned engineer kit files that
 * are now supplied by the Claude Code plugin, preserving user-owned files and
 * legacy runtime surfaces that the plugin format does not yet provide.
 */
export function defaultLegacyRemover(claudeDir: string, backupDir: string): string[] {
	const meta = readJsonSafe(join(claudeDir, "metadata.json"));
	const files = collectTrackedFiles(meta);
	const removed: string[] = [];
	for (const file of files) {
		const legacyPath = resolveSafePluginSuppliedLegacyPath(claudeDir, file.path);
		if (!legacyPath) continue;
		if (!existsSync(legacyPath.absolutePath)) continue;
		if (!isSafeToRemovePluginSuppliedLegacyFile(file, legacyPath.absolutePath)) continue;
		// Back up before removing.
		if (!backupAndRemove(backupDir, legacyPath.relativePath, legacyPath.absolutePath)) continue;
		removed.push(legacyPath.relativePath);
	}
	removed.push(...removeOrphanLegacySentinels(claudeDir, backupDir, removed));
	return removed;
}

function backupAndRemove(backupDir: string, relativePath: string, abs: string): boolean {
	const backupTarget = resolveSafeChildPath(backupDir, relativePath);
	if (!backupTarget) return false;
	mkdirSync(dirname(backupTarget), { recursive: true });
	cpSync(abs, backupTarget, { recursive: true });
	rmSync(abs, { recursive: true, force: true });
	return true;
}

function removeOrphanLegacySentinels(
	claudeDir: string,
	backupDir: string,
	removedTrackedPaths: string[],
): string[] {
	const normalizedRemoved = removedTrackedPaths.map(normalizeLegacyPath);
	const rootsToSweep = new Set<string>();
	for (const pathValue of normalizedRemoved) {
		const [root] = pathValue.split("/");
		if (root && PLUGIN_SUPPLIED_LEGACY_PREFIXES.includes(`${root}/`)) {
			rootsToSweep.add(root);
		}
	}

	const removed: string[] = [];
	for (const root of rootsToSweep) {
		const rootAbs = join(claudeDir, root);
		if (!existsSync(rootAbs)) continue;
		for (const sentinelAbs of findLegacySentinels(rootAbs)) {
			const sentinelPath = normalizeLegacyPath(relative(claudeDir, sentinelAbs));
			if (!isSafeToRemoveLegacySentinel(sentinelPath, sentinelAbs, normalizedRemoved)) continue;
			if (!backupAndRemove(backupDir, sentinelPath, sentinelAbs)) continue;
			removed.push(sentinelPath);
		}
	}
	return removed;
}

function findLegacySentinels(dir: string): string[] {
	const out: string[] = [];
	let entries;
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return out;
	}

	for (const entry of entries) {
		const abs = join(dir, entry.name);
		if (entry.isDirectory()) {
			out.push(...findLegacySentinels(abs));
		} else if (entry.isFile() && LEGACY_SENTINEL_FILENAMES.has(entry.name)) {
			out.push(abs);
		}
	}
	return out;
}

function isSafeToRemoveLegacySentinel(
	sentinelPath: string,
	sentinelAbs: string,
	removedTrackedPaths: string[],
): boolean {
	if (!isPluginSuppliedLegacyPath(sentinelPath)) return false;
	if (!LEGACY_SENTINEL_FILENAMES.has(sentinelPath.split("/").pop() ?? "")) return false;

	const sentinelDir = dirname(sentinelPath).replace(/\\/g, "/");
	if (!removedTrackedPaths.some((removedPath) => removedPath.startsWith(`${sentinelDir}/`))) {
		return false;
	}

	return directoryContainsOnlySentinels(dirname(sentinelAbs));
}

function directoryContainsOnlySentinels(dir: string): boolean {
	let entries;
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return false;
	}

	for (const entry of entries) {
		const abs = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (!directoryContainsOnlySentinels(abs)) return false;
		} else if (!entry.isFile() || !LEGACY_SENTINEL_FILENAMES.has(entry.name)) {
			return false;
		}
	}
	return true;
}

function isSafeToRemovePluginSuppliedLegacyFile(file: TrackedFile, abs: string): boolean {
	if (file.ownership !== "user") {
		return true;
	}

	// Offline/local kit installs can lack release-manifest.json, so files are
	// tracked as user-owned even though the installer just copied them. Remove
	// only when the tracked checksum still matches disk; edited or untracked
	// user files stay protected.
	return checksumMatches(abs, file.checksum);
}

function checksumMatches(filePath: string, expected?: string): boolean {
	if (!expected || !/^[a-f0-9]{64}$/i.test(expected)) {
		return false;
	}
	try {
		const actual = createHash("sha256").update(readFileSync(filePath)).digest("hex");
		return actual.toLowerCase() === expected.toLowerCase();
	} catch {
		return false;
	}
}

function isPluginSuppliedLegacyPath(pathValue: string): boolean {
	const normalized = normalizeLegacyPath(pathValue).replace(/^\.claude\//, "");
	return PLUGIN_SUPPLIED_LEGACY_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function resolveSafePluginSuppliedLegacyPath(
	claudeDir: string,
	pathValue: string,
): { absolutePath: string; relativePath: string } | null {
	const normalized = normalizeLegacyPath(pathValue).replace(/^\.\/+/, "");
	if (!isPluginSuppliedLegacyPath(normalized)) return null;
	const safe = resolveSafeChildPath(claudeDir, normalized);
	if (!safe) return null;

	const relativePath = normalizeLegacyPath(relative(resolve(claudeDir), safe));
	if (!isPluginSuppliedLegacyPath(relativePath)) return null;
	return { absolutePath: safe, relativePath };
}

function resolveSafeChildPath(baseDir: string, pathValue: string): string | null {
	const normalized = normalizeLegacyPath(pathValue);
	if (!normalized || hasPathTraversal(normalized) || isAbsoluteLike(normalized)) return null;

	const resolvedBase = resolve(baseDir);
	const resolvedTarget = resolve(resolvedBase, normalized);
	const relativePath = normalizeLegacyPath(relative(resolvedBase, resolvedTarget));
	if (!relativePath || relativePath === ".." || relativePath.startsWith("../")) return null;
	if (isAbsoluteLike(relativePath)) return null;
	return resolvedTarget;
}

function hasPathTraversal(pathValue: string): boolean {
	return pathValue.split("/").some((segment) => segment === "..");
}

function isAbsoluteLike(pathValue: string): boolean {
	return pathValue.startsWith("/") || pathValue.startsWith("//") || /^[A-Za-z]:/.test(pathValue);
}

function normalizeLegacyPath(pathValue: string): string {
	return pathValue.replace(/\\/g, "/");
}

interface TrackedFile {
	path: string;
	ownership: "ck" | "ck-modified" | "user";
	checksum?: string;
}

function collectTrackedFiles(meta: unknown): TrackedFile[] {
	if (!isRecord(meta)) return [];
	const out: TrackedFile[] = [];
	const push = (arr: unknown) => {
		if (!Array.isArray(arr)) return;
		for (const f of arr) {
			if (isRecord(f) && typeof f.path === "string") {
				const ownership =
					f.ownership === "user" || f.ownership === "ck-modified" ? f.ownership : "ck";
				out.push({
					path: f.path,
					ownership,
					checksum: typeof f.checksum === "string" ? f.checksum : undefined,
				});
			}
		}
	};
	// Engineer-scoped ONLY: this migration must never touch other kits' files.
	if (isRecord(meta.kits)) {
		// Multi-kit format: only the engineer kit's tracked files.
		const engineer = (meta.kits as Record<string, unknown>)[ENGINEER_KIT_KEY];
		if (isRecord(engineer)) push(engineer.files);
	} else {
		// Legacy single-kit format (no kits{}): root files belong to the only installed
		// kit, and migration is gated to the engineer kit by the caller.
		push(meta.files);
	}
	return out;
}

function writeReceipt(
	claudeDir: string,
	receipt: {
		fromMode: InstallMode;
		toMode: "plugin";
		pluginVersion: string | null;
		backupDir: string | null;
		removedPaths: string[];
		timestamp: string;
	},
): string {
	const receiptPath = join(claudeDir, ".ck-migration-log.json");
	const existing = readJsonSafe(receiptPath);
	const history = Array.isArray(existing) ? existing : [];
	history.push(receipt);
	writeFileSync(receiptPath, `${JSON.stringify(history, null, 2)}\n`, "utf-8");
	return receiptPath;
}

function readJsonSafe(filePath: string): unknown {
	try {
		return JSON.parse(readFileSync(filePath, "utf-8"));
	} catch {
		return null;
	}
}

interface PluginPrepareResult {
	ok: boolean;
	error?: string;
}

async function installPlugin(
	installer: PluginInstaller,
	pluginSourceDir: string,
): Promise<PluginPrepareResult> {
	const added = await installer.marketplaceAdd(pluginSourceDir);
	if (!added.ok) {
		return { ok: false, error: `marketplace add failed: ${added.stderr.trim()}` };
	}
	const installed = await installer.install("user");
	if (!installed.ok) {
		return { ok: false, error: `plugin install failed: ${installed.stderr.trim()}` };
	}
	return { ok: true };
}

async function refreshExistingPlugin(
	installer: PluginInstaller,
	pluginSourceDir: string,
	enabled: boolean,
): Promise<PluginPrepareResult> {
	const added = await installer.marketplaceAdd(pluginSourceDir);
	if (!added.ok) {
		const updatedMarketplace = await installer.marketplaceUpdate();
		if (!updatedMarketplace.ok) {
			return {
				ok: false,
				error: `marketplace refresh failed: ${updatedMarketplace.stderr.trim() || added.stderr.trim()}`,
			};
		}
	}

	if (!enabled) {
		const enabledResult = await installer.enable();
		if (!enabledResult.ok) {
			return { ok: false, error: `plugin enable failed: ${enabledResult.stderr.trim()}` };
		}
	}

	const updated = await installer.update();
	if (!updated.ok) {
		return { ok: false, error: `plugin update failed: ${updated.stderr.trim()}` };
	}
	return { ok: true };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
