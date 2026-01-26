/**
 * Transformers service - path and content transformations
 */

export { transformPathsForGlobalInstall } from "./global-path-transformer.js";
export { transformFolderPaths, validateFolderOptions } from "./folder-path-transformer.js";
export { CommandsPrefix } from "./commands-prefix.js";
export {
	transformOpenCodeContent,
	transformPathsForGlobalOpenCode,
	getOpenCodeGlobalPath,
	IS_WINDOWS as OPENCODE_IS_WINDOWS,
	OPENCODE_HOME_PREFIX,
} from "./opencode-path-transformer.js";
