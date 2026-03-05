/**
 * Skills Dependencies Configuration
 *
 * Single source of truth for what gets installed during skills setup.
 * Used by confirmation prompts and install scripts reference.
 */

export interface SkillsDependency {
	name: string;
	description: string;
}

export interface SkillsDependenciesConfig {
	python: SkillsDependency[];
	system: SkillsDependency[];
	node: SkillsDependency[];
}

/**
 * Skills dependencies installed by install.sh / install.ps1
 */
export const SKILLS_DEPENDENCIES: SkillsDependenciesConfig = {
	python: [
		{ name: "google-genai", description: "Required for ai-multimodal skill (Gemini API)" },
		{ name: "pillow, pypdf", description: "Image/PDF processing" },
		{ name: "python-dotenv", description: "Environment variable management" },
	],
	system: [
		{ name: "ffmpeg", description: "Audio/video processing" },
		{ name: "imagemagick", description: "Image manipulation" },
	],
	node: [{ name: "repomix, pnpm", description: "Development utilities" }],
} as const;

/**
 * Format dependencies for display in prompts
 */
export function formatDependencyList(deps: SkillsDependency[]): string {
	return deps.map((d) => `    - ${d.name.padEnd(16)} ${d.description}`).join("\n");
}

/**
 * Get platform-specific venv path
 */
export function getVenvPath(isWindows: boolean): string {
	return isWindows ? "%USERPROFILE%\\.claude\\skills\\.venv\\" : "~/.claude/skills/.venv/";
}

/**
 * Get platform-specific install command
 */
export function getInstallCommand(isWindows: boolean): string {
	return isWindows
		? "powershell %USERPROFILE%\\.claude\\skills\\install.ps1"
		: "bash ~/.claude/skills/install.sh";
}
