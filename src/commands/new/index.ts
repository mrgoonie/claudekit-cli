/**
 * New Command Module
 *
 * Re-exports all public APIs from the new command module.
 */

export { newCommand } from "./new-command.js";
export { directorySetup } from "./phases/directory-setup.js";
export { projectCreation } from "./phases/project-creation.js";
export { postSetup } from "./phases/post-setup.js";
export { selectVersion, type VersionSelectionResult } from "./phases/version-selection.js";
export * from "./types.js";
