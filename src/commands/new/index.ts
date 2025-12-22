/**
 * New Command Module
 *
 * Re-exports all public APIs from the new command module.
 */

export { newCommand } from "./new-command.js";
export { directorySetup, type DirectorySetupResult } from "./phases/directory-setup.js";
export { projectCreation, type ProjectCreationResult } from "./phases/project-creation.js";
export { postSetup } from "./phases/post-setup.js";
