/**
 * Selection module exports
 */
export { VERSION_PATTERN, isValidVersionFormat, normalizeVersionTag } from "./version-filter.js";
export {
	createVersionPrompt,
	getDefaultIndex,
	getManualVersion,
	handleNoReleases,
	handleSelectionError,
} from "./selection-ui.js";
