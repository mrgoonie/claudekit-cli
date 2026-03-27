/**
 * Skill-MD converter — convert agents/commands to OpenHands SKILL.md format
 * Used by: OpenHands (.openhands/skills/<name>/SKILL.md)
 *
 * OpenHands skills have a different semantic model than Claude Code agents:
 * - Skills are reusable capabilities, not personas
 * - They use triggers for auto-injection
 */
import matter from "gray-matter";
import type { ConversionResult, PortableItem } from "../types.js";

/**
 * Convert a Claude Code agent or command to OpenHands SKILL.md format
 */
export function convertToSkillMd(item: PortableItem): ConversionResult {
	const fm: Record<string, unknown> = {
		name: item.frontmatter.name || item.name,
		description: item.description || "",
	};

	const body = `# ${fm.name}\n\n${item.body}`;
	const content = matter.stringify(body, fm);

	// OpenHands uses directory structure: .openhands/skills/<name>/SKILL.md
	return {
		content,
		filename: `${item.name}/SKILL.md`,
		warnings: [],
	};
}
