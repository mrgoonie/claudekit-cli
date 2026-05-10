/**
 * Command-to-Codex-skill converter.
 *
 * Current Codex imports external slash commands as skills under
 * `.agents/skills/<source-command-name>/SKILL.md`, not as project-local prompt files.
 */
import type { ConversionResult, PortableItem } from "../types.js";
import {
	MAX_CODEX_COMMAND_SKILL_DESCRIPTION_LEN,
	MAX_CODEX_COMMAND_SKILL_NAME_LEN,
	getCodexCommandSkillFilename,
	getCodexCommandSkillName,
} from "./codex-command-skill-path.js";

function sourceCommandName(item: PortableItem): string {
	const segments = item.segments && item.segments.length > 0 ? item.segments : item.name.split("/");
	return segments.filter(Boolean).join("-");
}

function yamlString(value: string): string {
	return JSON.stringify(value);
}

function hasUnsupportedCommandTemplateFeatures(template: string): boolean {
	return (
		template.includes("$ARGUMENTS") ||
		/\$[1-9]\d*/.test(template) ||
		(template.includes("{{") && template.includes("}}")) ||
		template.includes("!`") ||
		template.includes("! `") ||
		template.split(/\s+/).some((token) => token.startsWith("@") && token.length > 1)
	);
}

export function convertCommandToCodexSkill(item: PortableItem): ConversionResult {
	const sourceSegments =
		item.segments && item.segments.length > 0 ? item.segments : item.name.split("/");
	const sourceName = sourceCommandName(item);
	const skillName = getCodexCommandSkillName(sourceSegments);
	const description = (item.description || `Migrated command ${sourceName}`)
		.replace(/\s+/g, " ")
		.trim();
	const warnings: string[] = [];

	if (skillName.length > MAX_CODEX_COMMAND_SKILL_NAME_LEN) {
		return {
			content: "",
			filename: getCodexCommandSkillFilename(sourceSegments),
			warnings,
			error: `Codex skill name exceeds ${MAX_CODEX_COMMAND_SKILL_NAME_LEN} characters`,
		};
	}
	if (description.length > MAX_CODEX_COMMAND_SKILL_DESCRIPTION_LEN) {
		return {
			content: "",
			filename: getCodexCommandSkillFilename(sourceSegments),
			warnings,
			error: `Codex skill description exceeds ${MAX_CODEX_COMMAND_SKILL_DESCRIPTION_LEN} characters`,
		};
	}
	if (hasUnsupportedCommandTemplateFeatures(item.body)) {
		warnings.push(
			"Command template contains Claude-specific dynamic syntax; installed as a Codex skill for manual adaptation.",
		);
	}

	const templateBody = item.body.trim() || "No command template body was found.";
	const content = [
		"---",
		`name: ${yamlString(skillName)}`,
		`description: ${yamlString(description)}`,
		"---",
		"",
		`# ${skillName}`,
		"",
		`Use this skill when the user asks to run the migrated source command \`${sourceName}\`.`,
		"",
		"## Command Template",
		"",
		templateBody,
		"",
	].join("\n");

	return {
		content,
		filename: getCodexCommandSkillFilename(sourceSegments),
		warnings,
	};
}
