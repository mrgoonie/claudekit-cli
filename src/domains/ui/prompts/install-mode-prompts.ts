import { isCancel, select } from "@/shared/safe-prompts.js";

export type InstallModeSelection = "legacy" | "plugin" | "cancel";

/** Ask for plugin consent. Normal copied skills remain the recommended first option. */
export async function promptEngineerInstallMode(): Promise<InstallModeSelection> {
	const options = [
		{
			value: "legacy" as const,
			label: "Normal skills (recommended)",
			hint: "Copy to ~/.claude/skills without CK plugins; sync Codex later with ck migrate --agent codex",
		},
		{
			value: "plugin" as const,
			label: "Claude and Codex plugins (advanced opt-in)",
			hint: "Register ck provider plugins and preserve this preference for updates",
		},
	];
	const selected = await select<typeof options, "legacy" | "plugin">({
		message: "How should ClaudeKit Engineer be installed?",
		options,
	});
	return isCancel(selected) ? "cancel" : selected;
}
