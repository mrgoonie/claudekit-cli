/**
 * File operations service - file system operations
 */

export { FileScanner } from "./file-scanner.js";
export { ManifestWriter, type FileTrackInfo } from "./manifest-writer.js";
export {
	scanDirectoryTree,
	filterItemsByPatterns,
	flattenSelectedItems,
	getClaudeKitDirectories,
	createDefaultSelection,
	type DirectoryItem,
	type SelectionState,
} from "./directory-selector.js";
export {
	scanClaudeKitDirectory,
	readClaudeKitMetadata,
	getClaudeKitSetup,
	type ClaudeKitMetadata,
} from "./claudekit-scanner.js";
export { OwnershipChecker, type OwnershipCheckResult } from "./ownership-checker.js";
