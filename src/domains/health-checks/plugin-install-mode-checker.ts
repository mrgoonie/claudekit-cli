import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	type CodexPluginState,
	type CodexPluginStateOptions,
	detectCodexPluginState,
} from "@/domains/installation/plugin/codex-plugin-installer.js";
import { detectInstallMode } from "@/domains/installation/plugin/install-mode-detector.js";
import {
	DEFAULT_INSTALL_MODE_PREFERENCE,
	readInstallModePreferenceFromClaudeDir,
} from "@/domains/installation/plugin/install-mode-preference.js";
import { PathResolver } from "@/shared/path-resolver.js";
import type { InstallModePreference } from "@/types";
import type { CheckResult, CheckStatus, Checker } from "./types.js";

interface PluginInstallModeCheckerDeps {
	detectCodexPluginState?: (options?: CodexPluginStateOptions) => Promise<CodexPluginState>;
	readInstallModePreference?: (claudeDir: string) => InstallModePreference | null;
}

/**
 * Reports how the ClaudeKit Engineer kit is installed: fresh / legacy / plugin /
 * mixed. Surfaced under `ck doctor` to aid support and migration debugging (#692).
 *
 * Status mapping:
 *  - mixed                -> warn (legacy + plugin both present; needs migration)
 *  - plugin but disabled  -> warn (installed but not enabled)
 *  - plugin / legacy      -> pass
 *  - fresh                -> info (nothing installed yet)
 */
export class PluginInstallModeChecker implements Checker {
	readonly group = "claudekit" as const;

	// claudeDir is injectable for tests; production uses the resolved global dir.
	constructor(
		private readonly claudeDir?: string,
		private readonly deps: PluginInstallModeCheckerDeps = {},
	) {}

	async run(): Promise<CheckResult[]> {
		const r = detectInstallMode(this.claudeDir);
		const readPreference =
			this.deps.readInstallModePreference ?? readInstallModePreferenceFromClaudeDir;
		const preference = readPreference(r.claudeDir) ?? DEFAULT_INSTALL_MODE_PREFERENCE;
		const codexState = await this.readCodexState(expectedCodexPluginOptions(r.claudeDir));

		const detail: string[] = [];
		detail.push(`preference: ${preference}`);
		if (r.plugin.installed) {
			const bits = [r.plugin.enabled ? "enabled" : "disabled"];
			if (r.plugin.version) bits.push(r.plugin.version);
			if (r.plugin.marketplace) bits.push(`via ${r.plugin.marketplace}`);
			detail.push(`Claude plugin: ${bits.join(", ")}`);
		}
		if (r.legacy.installed) {
			detail.push(`legacy copy${r.legacy.version ? ` (${r.legacy.version})` : ""}`);
		}
		detail.push(formatCodexDetail(codexState));
		const suffix = detail.length > 0 ? ` — ${detail.join("; ")}` : "";

		let status: CheckStatus = "pass";
		let message = `Install mode: ${r.mode}${suffix}`;

		if (r.mode === "mixed") {
			status = "warn";
			message = `Install mode: mixed (legacy copy + plugin both present). Run \`ck update\` to migrate to plugin-only.${suffix}`;
		} else if (r.mode === "plugin" && !r.plugin.enabled) {
			status = "warn";
			message = `Install mode: plugin, but the plugin is disabled. Run \`claude plugin enable ck\`.${suffix}`;
		} else if (
			preference === "legacy" &&
			(r.plugin.installed || r.plugin.staleCache || codexState.installed)
		) {
			status = "warn";
			message = `Install mode: ${r.mode}, but preference is legacy. Run \`ck init -g --kit engineer --install-mode legacy\`.${suffix}`;
		} else if (
			preference === "plugin" &&
			(r.mode === "legacy" || r.mode === "fresh" || !r.plugin.enabled)
		) {
			status = "warn";
			message = `Install mode: ${r.mode}, but preference is plugin. Run \`ck init -g --kit engineer --install-mode plugin\`.${suffix}`;
		} else if (codexState.shouldRefresh && preference !== "legacy") {
			status = "warn";
			message = `Install mode: ${r.mode}; Codex plugin requires refresh. Run \`ck update\`.${suffix}`;
		} else if (r.mode === "fresh") {
			status = "info";
			message = `Install mode: fresh (ClaudeKit Engineer not installed). Run \`ck init\` to install.${suffix}`;
		}

		return [
			{
				id: "engineer-install-mode",
				name: "Engineer install mode",
				group: this.group,
				status,
				message,
				autoFixable: false,
			},
		];
	}

	private async readCodexState(options: CodexPluginStateOptions): Promise<CodexPluginState> {
		try {
			if (this.deps.detectCodexPluginState) return await this.deps.detectCodexPluginState(options);
			return await detectCodexPluginState(undefined, options);
		} catch (error) {
			return {
				status: "unknown",
				pluginId: "ck@claudekit",
				enabled: false,
				installed: false,
				installedVersion: null,
				expectedVersion: options.expectedVersion ?? null,
				marketplace: null,
				expectedMarketplace: options.expectedMarketplace ?? "claudekit",
				source: null,
				expectedSource: options.expectedSource ?? null,
				shouldRefresh: false,
				error: error instanceof Error ? error.message : "unknown",
			};
		}
	}
}

function formatCodexDetail(state: CodexPluginState): string {
	const bits: string[] = [state.status];
	if (state.installedVersion) bits.push(state.installedVersion);
	if (state.marketplace) bits.push(`via ${state.marketplace}`);
	if (state.source) bits.push(`source ${state.source}`);
	if (state.error) bits.push(state.error);
	return `Codex plugin: ${bits.join(", ")}`;
}

function expectedCodexPluginOptions(claudeDir: string): CodexPluginStateOptions {
	return {
		expectedVersion: readEngineerKitVersion(claudeDir),
		expectedMarketplace: "claudekit",
		expectedSource: join(PathResolver.getCacheDir(true), "ck-plugin-source"),
	};
}

function readEngineerKitVersion(claudeDir: string): string | null {
	try {
		const parsed = JSON.parse(readFileSync(join(claudeDir, "metadata.json"), "utf-8"));
		if (!isRecord(parsed) || !isRecord(parsed.kits) || !isRecord(parsed.kits.engineer)) {
			return null;
		}
		const version = parsed.kits.engineer.version;
		return typeof version === "string" && version.trim() !== "" ? version : null;
	} catch {
		return null;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
