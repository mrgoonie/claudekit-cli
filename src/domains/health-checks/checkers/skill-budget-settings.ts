import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { type SettingsJson, SettingsMerger } from "@/domains/config/settings-merger.js";

export const MIN_BUDGET_FRACTION = 0.03;
export const MAX_DESC_CHARS = 512;
export const RECOMMENDED_DESC_CHARS = 200;

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

export async function applyBudgetDefaults(settingsPath: string, projectClaudeDir: string) {
	const read = await readProjectSettings(settingsPath);
	if (read.error) return { success: false, message: `Invalid settings: ${read.error}` };
	const settings = read.settings ?? {};
	settings.skillListingBudgetFraction =
		typeof settings.skillListingBudgetFraction === "number" &&
		settings.skillListingBudgetFraction >= MIN_BUDGET_FRACTION
			? settings.skillListingBudgetFraction
			: MIN_BUDGET_FRACTION;
	settings.skillListingMaxDescChars =
		typeof settings.skillListingMaxDescChars === "number" &&
		settings.skillListingMaxDescChars <= MAX_DESC_CHARS
			? settings.skillListingMaxDescChars
			: MAX_DESC_CHARS;
	await mkdir(projectClaudeDir, { recursive: true });
	await SettingsMerger.writeSettingsFile(settingsPath, settings);
	return { success: true, message: "Updated project skill listing budget settings" };
}
