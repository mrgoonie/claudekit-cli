/**
 * Config domain - configuration management
 */

export { ConfigManager } from "./config-manager.js";
export { SettingsMerger, type SettingsJson } from "./settings-merger.js";
export { generateEnvFile } from "./config-generator.js";
export { VALIDATION_PATTERNS, validateApiKey } from "./config-validator.js";
export * from "./types.js";
