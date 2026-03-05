/**
 * API key domain facade
 * Exports all API key related functionality
 */

export {
	validateApiKey,
	isValidKeyFormat,
	type ValidationResult,
} from "./validator.js";

export {
	getEnvFilePath,
	readExistingApiKey,
	saveApiKey,
	removeApiKey,
} from "./storage.js";
