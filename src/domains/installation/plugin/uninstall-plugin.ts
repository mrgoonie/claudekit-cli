import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
	CK_MARKETPLACE_NAME,
	CK_PLUGIN_NAME,
	detectPluginState,
} from "@/domains/installation/plugin/install-mode-detector.js";
import { PluginInstaller } from "@/domains/installation/plugin/plugin-installer.js";
import { PathResolver } from "@/shared/path-resolver.js";

export interface UninstallPluginResult {
	uninstalled: boolean;
	staleCacheRemoved: boolean;
	pluginStillInstalled: boolean;
	error?: string;
}

export interface UninstallPluginOptions {
	claudeDir?: string;
	installer?: PluginInstaller;
}

/**
 * Remove the engineer `ck` plugin: deregister via `claude plugin uninstall` +
 * `marketplace remove`, then purge any leftover cache payload. Used by
 * `ck uninstall` (#691). Non-fatal / idempotent: a no-op when no plugin/cache
 * is present.
 */
export async function uninstallEnginePlugin(
	opts: UninstallPluginOptions = {},
): Promise<UninstallPluginResult> {
	const claudeDir = opts.claudeDir ?? PathResolver.getGlobalKitDir();
	const installer = opts.installer ?? new PluginInstaller(undefined, claudeDir);
	const state = detectPluginState(claudeDir);

	let uninstalled = false;
	const errors: string[] = [];
	if (state.installed) {
		const removed = await installer.uninstall();
		if (removed.ok) {
			uninstalled = true;
		} else {
			errors.push(`plugin uninstall failed: ${removed.stderr.trim() || "unknown error"}`);
		}
		const marketplaceRemoved = await installer.marketplaceRemove(
			state.marketplace ?? CK_MARKETPLACE_NAME,
		);
		if (!marketplaceRemoved.ok) {
			errors.push(
				`marketplace remove failed: ${marketplaceRemoved.stderr.trim() || "unknown error"}`,
			);
		}
	}

	// Purge cache payload (covers both a registered uninstall and an orphaned stale cache).
	let staleCacheRemoved = false;
	const marketplace = state.marketplace ?? CK_MARKETPLACE_NAME;
	const cacheDir = join(claudeDir, "plugins", "cache", marketplace, CK_PLUGIN_NAME);
	if (existsSync(cacheDir)) {
		rmSync(cacheDir, { recursive: true, force: true });
		staleCacheRemoved = true;
	}

	const pluginStillInstalled = state.installed ? detectPluginState(claudeDir).installed : false;
	if (pluginStillInstalled) {
		errors.push("plugin remains registered after cleanup");
	}

	return {
		uninstalled,
		staleCacheRemoved,
		pluginStillInstalled,
		error: errors.length > 0 ? errors.join("; ") : undefined,
	};
}
