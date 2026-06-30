import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { InitContext } from "@/commands/init/types.js";
import {
	type CodexPluginInstallResult,
	type RemoveCodexPluginResult,
	installCodexPlugin,
	removeCodexPlugin,
} from "@/domains/installation/plugin/codex-plugin-installer.js";
import {
	type MigrateResult,
	migrateLegacyToPlugin,
} from "@/domains/installation/plugin/migrate-legacy-to-plugin.js";
import {
	type UninstallPluginResult,
	uninstallEnginePlugin,
} from "@/domains/installation/plugin/uninstall-plugin.js";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";

const ENGINEER_KIT = "engineer";

export interface PluginInstallDeps {
	/** Injectable for tests; defaults to the real migrate flow. */
	migrate?: typeof migrateLegacyToPlugin;
	/** Injectable for tests; defaults to the real Codex plugin install flow. */
	installCodex?: typeof installCodexPlugin;
	/** Injectable for tests; defaults to the real Claude plugin removal flow. */
	uninstallClaudePlugin?: typeof uninstallEnginePlugin;
	/** Injectable for tests; defaults to the real Codex plugin removal flow. */
	removeCodexPlugin?: typeof removeCodexPlugin;
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
	const installCodex = deps.installCodex ?? installCodexPlugin;
	const uninstallClaude = deps.uninstallClaudePlugin ?? uninstallEnginePlugin;
	const removeCodex = deps.removeCodexPlugin ?? removeCodexPlugin;

	if (ctx.options.installMode === "legacy") {
		let cleanupError: Error | null = null;
		try {
			const result = await uninstallClaude({ claudeDir: ctx.claudeDir });
			logLegacyPluginCleanup(result);
			if (result.pluginStillInstalled) {
				cleanupError = new Error(
					`Claude plugin cleanup failed for legacy install mode: ${
						result.error ?? "plugin remains registered"
					}`,
				);
			}
		} catch (err) {
			logger.verbose(`Claude plugin cleanup skipped: ${(err as Error).message}`);
			cleanupError = err as Error;
		}
		try {
			const result = await removeCodex();
			logCodexPluginCleanup(result);
		} catch (err) {
			logger.verbose(`Codex plugin cleanup skipped: ${(err as Error).message}`);
		}
		if (cleanupError) {
			throw cleanupError;
		}
		return ctx;
	}

	try {
		const pluginSourceDir = stagePluginSource(ctx.extractDir, deps.stageBaseDir);
		try {
			const result = await migrate({ pluginSourceDir, claudeDir: ctx.claudeDir });
			logPluginResult(result);
			if (ctx.options.installMode === "plugin" && !result.pluginVerified) {
				throw new Error(`Claude plugin install failed: ${result.error ?? result.action}`);
			}
		} catch (err) {
			if (ctx.options.installMode === "plugin") {
				throw err;
			}
			logger.verbose(
				`Claude plugin install skipped (legacy copy retained): ${(err as Error).message}`,
			);
		}
		try {
			const result = await installCodex({ pluginSourceDir });
			logCodexPluginResult(result);
		} catch (err) {
			logger.verbose(`Codex plugin install skipped: ${(err as Error).message}`);
		}
	} catch (err) {
		if (ctx.options.installMode === "plugin") {
			throw err;
		}
		// Never fail init over the plugin path — the legacy copy from handleMerge stands.
		logger.verbose(`Plugin staging skipped (legacy copy retained): ${(err as Error).message}`);
	}
	return ctx;
}

function logLegacyPluginCleanup(result: UninstallPluginResult): void {
	if (result.uninstalled || result.staleCacheRemoved) {
		logger.info("Removed ClaudeKit Engineer plugin state for legacy install mode.");
	} else {
		logger.verbose("No ClaudeKit Engineer Claude plugin state found for legacy install mode.");
	}
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
	const stagedPayload = join(base, ".claude");
	cpSync(payloadSrc, stagedPayload, { recursive: true });
	ensureCodexPluginManifest(stagedPayload);

	const claudeMarketplace = {
		name: "claudekit",
		owner: { name: "ClaudeKit" },
		plugins: [{ name: "ck", source: "./.claude", description: "ClaudeKit Engineer" }],
	};
	mkdirSync(join(base, ".claude-plugin"), { recursive: true });
	writeFileSync(
		join(base, ".claude-plugin", "marketplace.json"),
		`${JSON.stringify(claudeMarketplace, null, 2)}\n`,
		"utf-8",
	);

	const codexMarketplace = {
		name: "claudekit",
		interface: { displayName: "ClaudeKit" },
		plugins: [
			{
				name: "ck",
				source: { source: "local", path: "./.claude" },
				policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
				category: "Productivity",
			},
		],
	};
	mkdirSync(join(base, ".agents", "plugins"), { recursive: true });
	writeFileSync(
		join(base, ".agents", "plugins", "marketplace.json"),
		`${JSON.stringify(codexMarketplace, null, 2)}\n`,
		"utf-8",
	);
	return base;
}

function ensureCodexPluginManifest(pluginRoot: string): void {
	const manifestPath = join(pluginRoot, ".codex-plugin", "plugin.json");
	if (existsSync(manifestPath)) return;

	const claudeManifest = readJsonSafe(join(pluginRoot, ".claude-plugin", "plugin.json"));
	const manifest = pruneUndefined({
		name: stringField(claudeManifest, "name") ?? "ck",
		version: stringField(claudeManifest, "version") ?? "0.0.0",
		description:
			stringField(claudeManifest, "description") ??
			"ClaudeKit Engineer — multi-agent planning, code review, debugging, and workflow skills for Codex.",
		author: authorField(claudeManifest),
		homepage: stringField(claudeManifest, "homepage"),
		repository: stringField(claudeManifest, "repository"),
		license: stringField(claudeManifest, "license"),
		keywords: ["claudekit", "codex", "skills", "agents", "workflow"],
		skills: "./skills/",
		interface: {
			displayName: "ClaudeKit Engineer",
			shortDescription: "ClaudeKit planning, review, debugging, and workflow skills.",
			longDescription:
				"ClaudeKit Engineer provides planning, code review, debugging, testing, browser workflow, and implementation skills for Codex.",
			developerName: "ClaudeKit",
			category: "Productivity",
			capabilities: ["Skills"],
			websiteURL: "https://github.com/claudekit/claudekit-engineer",
		},
	});

	mkdirSync(join(pluginRoot, ".codex-plugin"), { recursive: true });
	writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
}

function readJsonSafe(filePath: string): Record<string, unknown> | null {
	try {
		const parsed = JSON.parse(readFileSync(filePath, "utf-8"));
		return isRecord(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

function stringField(source: Record<string, unknown> | null, key: string): string | undefined {
	const value = source?.[key];
	return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function authorField(source: Record<string, unknown> | null): { name: string } {
	const author = source?.author;
	if (isRecord(author) && typeof author.name === "string" && author.name.trim() !== "") {
		return { name: author.name };
	}
	return { name: "ClaudeKit" };
}

function pruneUndefined<T extends Record<string, unknown>>(value: T): Record<string, unknown> {
	return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
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

function logCodexPluginResult(result: CodexPluginInstallResult): void {
	switch (result.action) {
		case "installed":
			logger.info("Installed ClaudeKit Engineer as a Codex plugin.");
			break;
		case "skipped-codex-unsupported":
			logger.verbose("Codex plugin support unavailable; skipped Codex plugin install.");
			break;
		case "install-failed":
			logger.verbose(`Codex plugin install did not verify. ${result.error ?? ""}`);
			break;
	}
}

function logCodexPluginCleanup(result: RemoveCodexPluginResult): void {
	if (result.removed || result.marketplaceRemoved) {
		logger.info("Removed ClaudeKit Engineer Codex plugin state for legacy install mode.");
	} else {
		logger.verbose("No ClaudeKit Engineer Codex plugin state found for legacy install mode.");
	}
}
