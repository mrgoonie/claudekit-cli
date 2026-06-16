import { detectInstallMode } from "@/domains/installation/plugin/install-mode-detector.js";
import type { CheckResult, CheckStatus, Checker } from "./types.js";

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
	constructor(private readonly claudeDir?: string) {}

	async run(): Promise<CheckResult[]> {
		const r = detectInstallMode(this.claudeDir);

		const detail: string[] = [];
		if (r.plugin.installed) {
			const bits = [r.plugin.enabled ? "enabled" : "disabled"];
			if (r.plugin.version) bits.push(r.plugin.version);
			if (r.plugin.marketplace) bits.push(`via ${r.plugin.marketplace}`);
			detail.push(`plugin: ${bits.join(", ")}`);
		}
		if (r.legacy.installed) {
			detail.push(`legacy copy${r.legacy.version ? ` (${r.legacy.version})` : ""}`);
		}
		const suffix = detail.length > 0 ? ` — ${detail.join("; ")}` : "";

		let status: CheckStatus = "pass";
		let message = `Install mode: ${r.mode}${suffix}`;

		if (r.mode === "mixed") {
			status = "warn";
			message = `Install mode: mixed (legacy copy + plugin both present). Run \`ck update\` to migrate to plugin-only.${suffix}`;
		} else if (r.mode === "plugin" && !r.plugin.enabled) {
			status = "warn";
			message = `Install mode: plugin, but the plugin is disabled. Run \`claude plugin enable ck\`.${suffix}`;
		} else if (r.mode === "fresh") {
			status = "info";
			message = "Install mode: fresh (ClaudeKit Engineer not installed). Run `ck init` to install.";
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
}
