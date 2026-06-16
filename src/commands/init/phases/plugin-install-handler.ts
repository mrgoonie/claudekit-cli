import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { InitContext } from "@/commands/init/types.js";
import {
	type MigrateResult,
	migrateLegacyToPlugin,
} from "@/domains/installation/plugin/migrate-legacy-to-plugin.js";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";

const ENGINEER_KIT = "engineer";

export interface PluginInstallDeps {
	/** Injectable for tests; defaults to the real migrate flow. */
	migrate?: typeof migrateLegacyToPlugin;
	/** Override the staged-source base dir (tests). */
	stageBaseDir?: string;
}

/**
 * Phase 7.5 (#689): install the engineer kit as a Claude Code plugin for GLOBAL
 * (user-scope) installs.
 *
 * Additive and NON-FATAL by design: handleMerge has already copied the kit, so any
 * failure here (no claude binary, older CC, install error) leaves the working
 * legacy copy intact. The migrate flow installs the plugin and removes the legacy
 * skill copies only after a verified install.
 */
export async function handlePluginInstall(
	ctx: InitContext,
	deps: PluginInstallDeps = {},
): Promise<InitContext> {
	// Only the engineer kit ships as a plugin, and only global (user-scope) installs migrate.
	if (ctx.kitType !== ENGINEER_KIT || !ctx.options?.global || !ctx.extractDir || !ctx.claudeDir) {
		return ctx;
	}

	const migrate = deps.migrate ?? migrateLegacyToPlugin;
	try {
		const pluginSourceDir = stagePluginSource(ctx.extractDir, deps.stageBaseDir);
		const result = await migrate({ pluginSourceDir, claudeDir: ctx.claudeDir });
		logPluginResult(result);
	} catch (err) {
		// Never fail init over the plugin path — the legacy copy from handleMerge stands.
		logger.verbose(`Plugin install skipped (legacy copy retained): ${(err as Error).message}`);
	}
	return ctx;
}

/**
 * Stage the extracted kit payload to a stable marketplace source dir and synthesize
 * the marketplace.json. The release archive ships `.claude/` (which contains
 * `.claude-plugin/plugin.json`) but not a repo-root marketplace, so the CLI writes
 * one pointing at `./.claude`. A stable path is used so `claude plugin marketplace
 * update` keeps resolving after init.
 */
export function stagePluginSource(extractDir: string, stageBaseDir?: string): string {
	const base = stageBaseDir ?? join(PathResolver.getCacheDir(true), "ck-plugin-source");
	const payloadSrc = join(extractDir, ".claude");
	if (!existsSync(payloadSrc)) {
		throw new Error(`plugin payload not found in archive: ${payloadSrc}`);
	}

	rmSync(base, { recursive: true, force: true });
	mkdirSync(base, { recursive: true });
	cpSync(payloadSrc, join(base, ".claude"), { recursive: true });

	const marketplace = {
		name: "claudekit",
		owner: { name: "ClaudeKit" },
		plugins: [{ name: "ck", source: "./.claude", description: "ClaudeKit Engineer" }],
	};
	mkdirSync(join(base, ".claude-plugin"), { recursive: true });
	writeFileSync(
		join(base, ".claude-plugin", "marketplace.json"),
		`${JSON.stringify(marketplace, null, 2)}\n`,
		"utf-8",
	);
	return base;
}

function logPluginResult(result: MigrateResult): void {
	switch (result.action) {
		case "migrated-from-legacy":
			logger.info("Migrated ClaudeKit Engineer to plugin install (legacy skills cleaned).");
			break;
		case "installed-fresh":
			logger.info("Installed ClaudeKit Engineer as a Claude Code plugin.");
			break;
		case "noop-already-plugin":
			logger.verbose("ClaudeKit Engineer already installed as a plugin.");
			break;
		case "skipped-cc-unsupported":
			logger.verbose("Claude Code lacks plugin support; kept the legacy copy.");
			break;
		case "install-failed":
			logger.verbose(`Plugin install did not verify; kept the legacy copy. ${result.error ?? ""}`);
			break;
	}
}
