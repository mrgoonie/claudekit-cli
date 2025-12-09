import * as clack from "@clack/prompts";
import type {
	CustomizationDetection,
	MigrationDetectionResult,
	SkillMapping,
} from "../../types/index.js";

/**
 * Interactive prompts for skills migration process
 * Provides user guidance and confirmation dialogs
 */
export class SkillsMigrationPrompts {
	/**
	 * Ask user if they want to proceed with migration
	 *
	 * @param detection Migration detection result
	 * @returns True if user wants to migrate, false otherwise
	 */
	static async promptMigrationDecision(detection: MigrationDetectionResult): Promise<boolean> {
		const customizedCount = detection.customizations.filter((c) => c.isCustomized).length;
		const totalSkills = detection.skillMappings.length;

		// Build message
		let message = "Skills directory structure migration available.\n\n";
		message += `Found ${totalSkills} skill(s) that can be migrated to new categorized structure.\n`;

		if (customizedCount > 0) {
			message += `\n⚠️  ${customizedCount} skill(s) have customizations that will be preserved.\n`;
		}

		message += "\nWould you like to migrate now?";

		const result = await clack.confirm({
			message,
			initialValue: true,
		});

		return result === true;
	}

	/**
	 * Show migration preview to user
	 *
	 * @param mappings Skill mappings
	 * @param customizations Customization detections
	 */
	static async showMigrationPreview(
		mappings: SkillMapping[],
		customizations: CustomizationDetection[],
	): Promise<void> {
		clack.log.info("Migration Preview:");
		clack.log.message("");

		// Group mappings by category
		const byCategory = new Map<string, SkillMapping[]>();
		for (const mapping of mappings) {
			const category = mapping.category || "other";
			if (!byCategory.has(category)) {
				byCategory.set(category, []);
			}
			byCategory.get(category)?.push(mapping);
		}

		// Show grouped mappings
		for (const [category, skills] of byCategory.entries()) {
			clack.log.step(`${category}/ (${skills.length} skills)`);
			for (const skill of skills) {
				const customization = customizations.find((c) => c.skillName === skill.skillName);
				const badge = customization?.isCustomized ? " [CUSTOMIZED]" : "";
				clack.log.message(`  └─ ${skill.skillName}${badge}`);
			}
			clack.log.message("");
		}
	}

	/**
	 * Ask user about handling customizations
	 *
	 * @param customizations Customized skills
	 * @returns Selected handling strategy
	 */
	static async promptCustomizationHandling(
		customizations: CustomizationDetection[],
	): Promise<"preserve" | "review" | "skip"> {
		if (customizations.length === 0) {
			return "preserve";
		}

		const result = await clack.select({
			message: "How should customized skills be handled?",
			options: [
				{
					value: "preserve",
					label: "Preserve all customizations (recommended)",
					hint: "Keep your changes and migrate structure",
				},
				{
					value: "review",
					label: "Review each customization",
					hint: "Decide for each customized skill individually",
				},
				{
					value: "skip",
					label: "Skip customized skills",
					hint: "Only migrate unmodified skills",
				},
			],
			initialValue: "preserve",
		});

		return result as "preserve" | "review" | "skip";
	}

	/**
	 * Ask user about individual skill migration
	 *
	 * @param skillName Skill name
	 * @param customization Customization detection
	 * @returns True if should migrate, false otherwise
	 */
	static async promptSkillMigration(
		skillName: string,
		customization: CustomizationDetection,
	): Promise<boolean> {
		let message = `Migrate skill: ${skillName}?`;

		if (customization.isCustomized && customization.changes) {
			const changes = customization.changes;
			const added = changes.filter((c) => c.type === "added").length;
			const modified = changes.filter((c) => c.type === "modified").length;
			const deleted = changes.filter((c) => c.type === "deleted").length;

			message += "\n\nDetected changes:";
			if (added > 0) message += `\n  + ${added} file(s) added`;
			if (modified > 0) message += `\n  ~ ${modified} file(s) modified`;
			if (deleted > 0) message += `\n  - ${deleted} file(s) deleted`;
		}

		const result = await clack.confirm({
			message,
			initialValue: true,
		});

		return result === true;
	}

	/**
	 * Show migration progress
	 *
	 * @returns Spinner instance
	 */
	static showProgress() {
		return clack.spinner();
	}

	/**
	 * Show migration summary
	 *
	 * @param migrated Number of migrated skills
	 * @param preserved Number of preserved customizations
	 * @param skipped Number of skipped skills
	 * @param errors Number of errors
	 */
	static showSummary(migrated: number, preserved: number, skipped: number, errors: number): void {
		clack.log.message("");
		clack.log.info("Migration Summary:");
		clack.log.message("");
		clack.log.success(`✓ ${migrated} skill(s) migrated`);

		if (preserved > 0) {
			clack.log.info(`→ ${preserved} customization(s) preserved`);
		}

		if (skipped > 0) {
			clack.log.warning(`⊘ ${skipped} skill(s) skipped`);
		}

		if (errors > 0) {
			clack.log.error(`✗ ${errors} error(s) occurred`);
		}

		clack.log.message("");
	}

	/**
	 * Ask user if they want to create a backup
	 *
	 * @returns True if backup should be created
	 */
	static async promptBackup(): Promise<boolean> {
		const result = await clack.confirm({
			message: "Create backup of current skills directory before migration?",
			initialValue: true,
		});

		return result === true;
	}

	/**
	 * Show error message
	 *
	 * @param message Error message
	 */
	static showError(message: string): void {
		clack.log.error(message);
	}

	/**
	 * Show warning message
	 *
	 * @param message Warning message
	 */
	static showWarning(message: string): void {
		clack.log.warning(message);
	}

	/**
	 * Show info message
	 *
	 * @param message Info message
	 */
	static showInfo(message: string): void {
		clack.log.info(message);
	}

	/**
	 * Show success message
	 *
	 * @param message Success message
	 */
	static showSuccess(message: string): void {
		clack.log.success(message);
	}
}
