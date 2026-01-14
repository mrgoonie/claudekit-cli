/**
 * Kit Prompts
 *
 * Prompts for kit selection and directory input
 */

import { isCancel, multiselect, select, text } from "@/shared/safe-prompts.js";
import { AVAILABLE_KITS, type KitType } from "@/types";

/** Minimum number of kits required for multi-select prompt */
const MIN_KITS_FOR_MULTISELECT = 2;

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
 * Prompt user to select multiple kits (for dual-kit purchasers)
 * @param accessibleKits - Kits the user has access to (required, must have >= MIN_KITS_FOR_MULTISELECT)
 * @returns Array of selected kit types (guaranteed non-empty due to `required: true`)
 * @throws {Error} If called with fewer than MIN_KITS_FOR_MULTISELECT kits or user cancels
 */
export async function selectKits(accessibleKits: KitType[]): Promise<KitType[]> {
	if (accessibleKits.length < MIN_KITS_FOR_MULTISELECT) {
		throw new Error(`selectKits requires at least ${MIN_KITS_FOR_MULTISELECT} accessible kits`);
	}

	// Note: `required: true` prevents empty selection at the prompt level.
	// The clack/prompts multiselect will show an error and prevent submission
	// if user tries to submit without selecting any options.
	const selected = await multiselect({
		message: "Select ClaudeKit(s) to install:",
		options: accessibleKits.map((key) => ({
			value: key,
			label: AVAILABLE_KITS[key].name,
			hint: AVAILABLE_KITS[key].description,
		})),
		required: true,
	});

	if (isCancel(selected)) {
		throw new Error("Kit selection cancelled");
	}

	return selected as KitType[];
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
