import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { type SettingsJson, SettingsMerger } from "@/domains/config/settings-merger.js";

export const CONTEXT_FLOOR_TOKENS = 200_000;
export const CHARS_PER_TOKEN = 4;
export const DEFAULT_BUDGET_FRACTION = 0.03;
export const CK_RECOMMENDED_MAX_DESC_CHARS = 512;
export const RECOMMENDED_DESC_CHARS = 200;
// Per listed skill: ": " separator plus "\n" terminator in Claude Code's rendered inventory.
const LISTING_OVERHEAD_PER_SKILL = 4;

export interface SettingsRead {
	exists: boolean;
	settings: SettingsJson | null;
	error?: string;
}

export async function readProjectSettings(settingsPath: string): Promise<SettingsRead> {
	if (!existsSync(settingsPath)) return { exists: false, settings: null };
	try {
		const parsed = JSON.parse(await readFile(settingsPath, "utf8"));
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return { exists: true, settings: null, error: "settings.json must contain a JSON object" };
		}
		return { exists: true, settings: parsed as SettingsJson };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { exists: true, settings: null, error: message };
	}
}

export function estimateListingChars(
	skills: { id: string; description: string }[],
	maxDescChars: number,
) {
	if (skills.length === 0) return 0;
	return skills.reduce((sum, skill) => {
		return (
			sum +
			skill.id.length +
			LISTING_OVERHEAD_PER_SKILL +
			Math.min(skill.description.length, maxDescChars)
		);
	}, skills.length - 1);
}

export function requiredBudgetFraction(listingChars: number, contextTokens = CONTEXT_FLOOR_TOKENS) {
	if (listingChars <= 0) return DEFAULT_BUDGET_FRACTION;
	const raw = listingChars / (contextTokens * CHARS_PER_TOKEN);
	return Math.min(1, Math.max(DEFAULT_BUDGET_FRACTION, Math.ceil(raw * 1000) / 1000));
}

export async function applyBudgetDefaults(
	settingsPath: string,
	projectClaudeDir: string,
	requiredFraction = DEFAULT_BUDGET_FRACTION,
) {
	const read = await readProjectSettings(settingsPath);
	if (read.error) return { success: false, message: `Invalid settings: ${read.error}` };
	const settings = read.settings ?? {};
	const targetFraction = Math.min(1, Math.max(DEFAULT_BUDGET_FRACTION, requiredFraction));
	settings.skillListingBudgetFraction =
		typeof settings.skillListingBudgetFraction === "number" &&
		settings.skillListingBudgetFraction > 0 &&
		settings.skillListingBudgetFraction <= 1 &&
		settings.skillListingBudgetFraction >= targetFraction
			? settings.skillListingBudgetFraction
			: targetFraction;
	const existingMaxDescChars = settings.skillListingMaxDescChars;
	settings.skillListingMaxDescChars =
		typeof existingMaxDescChars === "number" &&
		Number.isInteger(existingMaxDescChars) &&
		existingMaxDescChars > 0 &&
		existingMaxDescChars <= CK_RECOMMENDED_MAX_DESC_CHARS
			? existingMaxDescChars
			: CK_RECOMMENDED_MAX_DESC_CHARS;
	await mkdir(projectClaudeDir, { recursive: true });
	await SettingsMerger.writeSettingsFile(settingsPath, settings);
	return { success: true, message: "Updated project skill listing budget settings" };
}
