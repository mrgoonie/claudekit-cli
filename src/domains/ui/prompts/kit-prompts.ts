/**
 * Kit Prompts
 *
 * Prompts for kit selection and directory input
 */

import { isCancel, select, text } from "@/shared/safe-prompts.js";
import { AVAILABLE_KITS, type KitType } from "@/types";

/**
 * Prompt user to select a kit
 * @param defaultKit - Optional default kit to preselect
 * @param accessibleKits - Optional filter to only show accessible kits
 */
export async function selectKit(
	defaultKit?: KitType,
	accessibleKits?: KitType[],
): Promise<KitType> {
	const kits = accessibleKits ?? (Object.keys(AVAILABLE_KITS) as KitType[]);

	const kit = await select({
		message: "Select a ClaudeKit:",
		options: kits.map((key) => ({
			value: key,
			label: AVAILABLE_KITS[key].name,
			hint: AVAILABLE_KITS[key].description,
		})),
		initialValue: defaultKit,
	});

	if (isCancel(kit)) {
		throw new Error("Kit selection cancelled");
	}

	return kit as KitType;
}

/**
 * Prompt user for target directory
 * @returns Directory path (defaults to defaultDir if empty input)
 */
export async function getDirectory(defaultDir = "."): Promise<string> {
	// text returns string | symbol (cancel) | undefined (empty input)
	const dir = await text({
		message: "Enter target directory:",
		placeholder: `Press Enter for "${defaultDir}"`,
		// Don't use initialValue - it pre-fills and causes ".myproject" issue
		validate: () => {
			// Allow empty input - will use default
			return;
		},
	});

	if (isCancel(dir)) {
		throw new Error("Directory input cancelled");
	}

	// Handle undefined (empty input) and empty string cases
	const trimmed = (dir ?? "").trim();
	return trimmed.length > 0 ? trimmed : defaultDir;
}
