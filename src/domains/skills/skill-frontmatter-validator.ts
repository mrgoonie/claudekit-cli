/**
 * Validate SKILL.md frontmatter against skill-schema.json contract.
 * Warn-only: never rejects skills, only logs warnings for invalid fields.
 */
import skillSchema from "./skill-schema.json" with { type: "json" };

const VALID_CATEGORIES = new Set<string>(
	(skillSchema.properties?.category as { enum?: string[] })?.enum ?? [],
);

export interface ValidationResult {
	valid: boolean;
	warnings: string[];
}

/**
 * Validate parsed frontmatter data against the skill schema.
 * Returns warnings for missing required fields and invalid enum values.
 * Permissive: unknown fields are allowed (no warning).
 */
export function validateSkillFrontmatter(
	data: Record<string, unknown>,
	skillName: string,
): ValidationResult {
	const warnings: string[] = [];

	// Required fields
	if (!data.name || typeof data.name !== "string") {
		warnings.push(`[!] Skill "${skillName}": missing required field "name"`);
	}
	if (!data.description || typeof data.description !== "string") {
		warnings.push(`[!] Skill "${skillName}": missing required field "description"`);
	}

	// Category enum validation (only if present)
	if (data.category && typeof data.category === "string" && !VALID_CATEGORIES.has(data.category)) {
		warnings.push(
			`[!] Skill "${skillName}": invalid category "${data.category}" (valid: ${[...VALID_CATEGORIES].join(", ")})`,
		);
	}

	return { valid: warnings.length === 0, warnings };
}
