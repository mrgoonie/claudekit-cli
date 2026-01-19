/**
 * Error handling domain exports
 */

export {
	classifyGitHubError,
	type ClassifiedError,
	type ErrorCategory,
} from "./error-classifier.js";
export { suggestActions, formatActions, type SuggestedAction } from "./action-suggester.js";
