const COMMAND_SKILL_PREFIX = "source-command";
export const CODEX_COMMAND_SKILL_FILENAME = "SKILL.md";
export const MAX_CODEX_COMMAND_SKILL_NAME_LEN = 64;
export const MAX_CODEX_COMMAND_SKILL_DESCRIPTION_LEN = 1024;

function slugifySkillName(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-{2,}/g, "-");
}

export function getCodexCommandSkillName(segments: string[]): string {
	return slugifySkillName(`${COMMAND_SKILL_PREFIX}-${segments.filter(Boolean).join("-")}`);
}

export function getCodexCommandSkillFilename(segments: string[]): string {
	return `${getCodexCommandSkillName(segments)}/${CODEX_COMMAND_SKILL_FILENAME}`;
}

export function getCodexCommandSkillFilenameFromCommandPath(commandPath: string): string {
	const segments = commandPath.replace(/\\/g, "/").replace(/\.md$/i, "").split("/").filter(Boolean);

	return getCodexCommandSkillFilename(segments);
}
