/**
 * Skills migration mappings from old (flat) to new (categorized) structure
 * Based on claudekit-web → claudekit-engineer migration
 */

export interface SkillCategoryMapping {
	oldSkills: string[]; // Old flat skill names
	newCategory: string; // New category directory name
}

/**
 * Mapping of old flat skills to new categorized structure
 */
export const SKILL_CATEGORY_MAPPINGS: SkillCategoryMapping[] = [
	// AI & Multimodal skills
	{
		oldSkills: [
			"gemini-vision",
			"gemini-image-gen",
			"gemini-video",
			"gemini-thinking",
			"gemini-files",
		],
		newCategory: "ai-multimodal",
	},

	// Database skills
	{
		oldSkills: ["postgresql-psql", "mongodb"],
		newCategory: "databases",
	},

	// DevOps & Infrastructure
	{
		oldSkills: [
			"cloudflare-dns",
			"cloudflare-pages",
			"cloudflare-workers",
			"cloudflare-d1",
			"docker",
			"gcloud",
		],
		newCategory: "devops",
	},

	// Media Processing
	{
		oldSkills: ["ffmpeg", "imagemagick"],
		newCategory: "media-processing",
	},

	// Web Frameworks
	{
		oldSkills: ["nextjs", "remix-icon", "turborepo"],
		newCategory: "web-frameworks",
	},

	// UI & Styling
	{
		oldSkills: ["tailwindcss", "shadcn-ui", "canvas-design"],
		newCategory: "ui-styling",
	},
];

/**
 * Skills that are preserved across versions (no migration needed)
 * These exist in both old and new structures in the same location
 */
export const PRESERVED_SKILLS = [
	// Core skills
	"common",
	"debugging",
	"document-skills",
	"problem-solving",
	"sequential-thinking",

	// Development tools
	"claude-code",
	"better-auth",
	"chrome-devtools",
	"shopify",
	"mcp-builder",

	// Utilities
	"docs-seeker",
	"repomix",
	"skill-creator",
	"template-skill",
	"google-adk-python",
];

/**
 * Get category for a given old skill name
 *
 * @param skillName Old skill name
 * @returns Category name or null if preserved/unknown
 */
export function getCategoryForSkill(skillName: string): string | null {
	// Check if it's a preserved skill (no migration needed)
	if (PRESERVED_SKILLS.includes(skillName)) {
		return null;
	}

	// Find in mappings
	for (const mapping of SKILL_CATEGORY_MAPPINGS) {
		if (mapping.oldSkills.includes(skillName)) {
			return mapping.newCategory;
		}
	}

	// Unknown skill
	return null;
}

/**
 * Get all old skill names that should be migrated
 *
 * @returns Array of old skill names
 */
export function getAllMigratableSkills(): string[] {
	return SKILL_CATEGORY_MAPPINGS.flatMap((mapping) => mapping.oldSkills);
}

/**
 * Get all skill categories in new structure
 *
 * @returns Array of category names
 */
export function getAllCategories(): string[] {
	return [...new Set(SKILL_CATEGORY_MAPPINGS.map((mapping) => mapping.newCategory))];
}

/**
 * Check if a skill name is known (either preserved or in mappings)
 *
 * @param skillName Skill name to check
 * @returns True if known, false otherwise
 */
export function isKnownSkill(skillName: string): boolean {
	return PRESERVED_SKILLS.includes(skillName) || getAllMigratableSkills().includes(skillName);
}

/**
 * Generate mapping from old path to new path
 *
 * @param skillName Old skill name
 * @param oldBasePath Base path for old structure (e.g., ".claude/skills")
 * @param newBasePath Base path for new structure (e.g., ".claude/skills")
 * @returns Object with oldPath and newPath, or null if preserved
 */
export function getPathMapping(
	skillName: string,
	oldBasePath: string,
	newBasePath: string,
): { oldPath: string; newPath: string } | null {
	const category = getCategoryForSkill(skillName);

	if (category === null) {
		// Preserved skill, no path change
		return null;
	}

	return {
		oldPath: `${oldBasePath}/${skillName}`,
		newPath: `${newBasePath}/${category}/${skillName}`,
	};
}
