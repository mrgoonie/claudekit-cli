import { existsSync } from "node:fs";
import { join } from "node:path";
import type { InitContext } from "@/commands/init/types.js";
import { detectInstallMode } from "@/domains/installation/plugin/install-mode-detector.js";
import {
	hasKitMetadataInClaudeDir,
	readInstallModePreferenceFromClaudeDir,
	resolveEffectiveInstallModePreference,
} from "@/domains/installation/plugin/install-mode-preference.js";
import { logger } from "@/shared/logger.js";

interface InstallModeSelectionTarget {
	kitType: string;
	claudeDir: string;
	legacyCandidateDirs?: string[];
}

/** Resolve global Engineer install consent before download or install-side mutation. */
export async function handleInstallModeSelection(
	ctx: InitContext,
	target: InstallModeSelectionTarget,
): Promise<InitContext> {
	if (!ctx.options.global || target.kitType !== "engineer") return ctx;

	const candidateDirs = [target.claudeDir, ...(target.legacyCandidateDirs ?? [])];
	const observedReports = candidateDirs.map((dir) => detectInstallMode(dir));
	const observedInstallations = observedReports.filter(
		(report, index) =>
			index === 0 ||
			existsSync(join(candidateDirs[index] ?? report.claudeDir, "metadata.json")) ||
			report.mode !== "fresh",
	);
	const canonicalStored = readInstallModePreferenceFromClaudeDir(target.claudeDir);
	const hasCanonicalMetadata = hasKitMetadataInClaudeDir(target.claudeDir);
	const stored = hasCanonicalMetadata
		? canonicalStored
		: (candidateDirs
				.slice(1)
				.map((dir) => readInstallModePreferenceFromClaudeDir(dir))
				.find((preference) => preference === "plugin") ?? null);
	let effective: "plugin" | "legacy";

	if (ctx.options.installModeExplicit) {
		effective = resolveEffectiveInstallModePreference(ctx.options.installMode);
		if (stored === "plugin" && effective === "legacy") {
			logger.info(
				"Switching from persisted plugin mode to normal skills; CK-owned plugin state will be removed after the copied install verifies.",
			);
		}
	} else if (stored === "plugin") {
		effective = "plugin";
		ctx.prompts.note(
			"This installation previously opted into ClaudeKit plugins. Plugin mode will be preserved.\nTo return to normal copied skills, run with --install-mode legacy.",
			"Plugin preference preserved",
		);
	} else {
		const isFresh =
			stored === null &&
			candidateDirs.every((dir) => !hasKitMetadataInClaudeDir(dir)) &&
			observedReports.every((report) => report.mode === "fresh");
		if (!ctx.isNonInteractive && isFresh) {
			ctx.prompts.note(
				"Normal skills live in ~/.claude/skills without ClaudeKit plugin registrations; sync them to Codex later with ck migrate --agent codex.\nPlugin mode registers the ck plugin namespace for Claude and Codex and remains enabled on future updates.",
				"Engineer install mode",
			);
			const selected = await ctx.prompts.selectEngineerInstallMode();
			if (selected === "cancel") return { ...ctx, cancelled: true };
			effective = selected;
		} else {
			effective = "legacy";
			if (ctx.isNonInteractive) {
				logger.info("Using normal copied skills (non-interactive default)");
			}
		}
	}

	return {
		...ctx,
		options: {
			...ctx.options,
			installMode: effective,
			installModeTransitionRequired:
				effective === "plugin"
					? observedInstallations.some((report) => report.mode !== "plugin")
					: observedInstallations.some(
							(report) => report.plugin.installed || report.plugin.staleCache,
						),
		},
	};
}
