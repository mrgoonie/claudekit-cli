import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
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
		if (file.ownership === "user") continue; // never delete user-owned content
		if (!isPluginSuppliedLegacyPath(file.path)) continue;
		const abs = join(claudeDir, file.path);
		if (!existsSync(abs)) continue;
		// Back up before removing.
		const backupTarget = join(backupDir, file.path);
		mkdirSync(dirname(backupTarget), { recursive: true });
		cpSync(abs, backupTarget, { recursive: true });
		rmSync(abs, { recursive: true, force: true });
		removed.push(file.path);
	}
	return removed;
}

function isPluginSuppliedLegacyPath(pathValue: string): boolean {
	const normalized = pathValue.replace(/\\/g, "/").replace(/^\.claude\//, "");
	return PLUGIN_SUPPLIED_LEGACY_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

interface TrackedFile {
	path: string;
	ownership: "ck" | "ck-modified" | "user";
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
				out.push({ path: f.path, ownership });
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
