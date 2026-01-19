/**
 * Error handling domain exports
 */

export {
	classifyGitHubError,
	RATE_LIMIT_WARNING_THRESHOLD,
	type ClassifiedError,
	type ErrorCategory,
	type GitHubErrorInput,
} from "./error-classifier.js";
export { suggestActions, formatActions, type SuggestedAction } from "./action-suggester.js";
