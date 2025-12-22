/**
 * Config domain - configuration management
 */

export { ConfigManager } from "./config-manager.js";
export { SettingsMerger, type SettingsJson } from "./settings-merger.js";
export { generateEnvFile } from "./config-generator.js";
export { VALIDATION_PATTERNS, validateApiKey } from "./config-validator.js";
export { ResolutionTracer, type ConfigSource, type TracedValue, type ResolutionResult } from "./resolution-tracer.js";
export { BackupManager, type BackupOptions } from "./backup-manager.js";
export { ConfigSchemaWithDescriptions, getJsonSchema, getSchemaDescription } from "./schema-descriptions.js";
export * from "./types.js";
