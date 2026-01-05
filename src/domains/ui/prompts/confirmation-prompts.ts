/**
 * Confirmation Prompts
 *
 * Simple confirmation prompts and local migration prompts
 */

import { confirm, isCancel, log, note, select } from "@/shared/safe-prompts.js";

/**
 * Confirm action
 */
export async function confirmAction(message: string): Promise<boolean> {
	const result = await confirm({
		message,
	});

	if (isCancel(result)) {
		return false;
	}

	return result;
}

/**
 * Prompt user to handle local installation when switching to global mode
 * Returns: "remove" to delete local .claude/, "keep" to proceed with warning, "cancel" to abort
 */
export async function promptLocalMigration(): Promise<"remove" | "keep" | "cancel"> {
	const result = await select({
		message: "Local ClaudeKit installation detected. Local settings take precedence over global.",
		options: [
			{
				value: "remove",
				label: "Remove local installation",
				hint: "Delete .claude/ and use global only",
			},
			{
				value: "keep",
				label: "Keep both installations",
				hint: "Local will take precedence",
			},
			{ value: "cancel", label: "Cancel", hint: "Abort global installation" },
		],
	});

	if (isCancel(result)) {
		return "cancel";
	}

	return result as "remove" | "keep" | "cancel";
}

/**
 * Prompt for skills dependencies installation
 */
export async function promptSkillsInstallation(): Promise<boolean> {
	const isWindows = process.platform === "win32";

	// Show detailed info about what will be installed
	note(
		`This installs dependencies required by ClaudeKit skills:

  Python packages (into ${isWindows ? "%USERPROFILE%\\.claude\\skills\\.venv\\" : "~/.claude/skills/.venv/"}):
    - google-genai      Required for ai-multimodal skill (Gemini API)
    - pillow, pypdf     Image/PDF processing
    - python-dotenv     Environment variable management

  System tools (optional${isWindows ? "" : ", requires sudo"}):
    - ffmpeg            Audio/video processing
    - imagemagick       Image manipulation

  Node.js packages:
    - repomix, pnpm     Development utilities`,
		"Skills Dependencies",
	);

	// Show platform-specific install command
	if (isWindows) {
		log.info(
			"Run 'powershell %USERPROFILE%\\.claude\\skills\\install.ps1' to install/update later.",
		);
	} else {
		log.info("Run 'bash ~/.claude/skills/install.sh' to install/update later.");
	}
	console.log();

	const installSkills = await confirm({
		message: "Install skills dependencies now?",
		initialValue: false,
	});

	if (isCancel(installSkills)) {
		return false;
	}

	return installSkills;
}
