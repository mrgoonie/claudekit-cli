/**
 * Setup command phase handlers
 * Export all phase handlers for clean imports
 */

export { handlePreflightCheck } from "./preflight-check.js";
export { handleEnvironmentConfig } from "./environment-config.js";
export { handleOptionalPackages } from "./packages-optional.js";
export { handleKitSelection } from "./kit-selection.js";
