/**
 * Kit Access Checker
 * Detects which kits the user has GitHub access to
 */
import { classifyGitHubError } from "@/domains/error/error-classifier.js";
import { formatActions, suggestActions } from "@/domains/error/index.js";
import { logger } from "@/shared/logger.js";
import { createSpinner } from "@/shared/safe-spinner.js";
import { GitHubError } from "@/types";
import { AVAILABLE_KITS, type KitType } from "@/types";
import { GitHubClient } from "./github-client.js";

/**
 * Convert an arbitrary caught error into a GitHubError using the classifier.
 * If the error is already a GitHubError, re-throw it directly (message already formatted).
 * Otherwise classify it and build the standard formatted message.
 */
function toGitHubError(error: unknown): GitHubError {
	// Already a classified GitHubError — preserve it as-is
	if (error instanceof GitHubError) {
		return error;
	}

	const classified = classifyGitHubError(error as any, "check repository access");
	const actions = suggestActions(classified.category);
	const formattedActions = formatActions(actions);

	const messageParts: string[] = [classified.message];

	if (classified.details) {
		messageParts.push(`\n${classified.details}`);
	}

	if (formattedActions) {
		messageParts.push(`\nSolutions:${formattedActions}`);
	}

	messageParts.push("\nNeed help? Run with: ck new --verbose");

	return new GitHubError(messageParts.join("\n"), classified.httpStatus);
}

/**
 * Check access to all available kits in parallel.
 *
 * Behavior:
 *   - 404 on a kit  -> that kit is excluded from results (no access, not an error)
 *   - 404 on ALL kits -> returns [] (same UX as before: "No kit access found")
 *   - Any non-404 error -> throws a classified GitHubError so the caller can surface it
 *   - Mixed 404 + non-404 -> throws (the non-404 failure wins; we must not silently
 *     fall back to "no access" when the real cause is network/auth/rate-limit)
 *
 * @returns Array of kit types the user has access to
 * @throws {GitHubError} When any kit check fails for a non-404 reason
 */
export async function detectAccessibleKits(): Promise<KitType[]> {
	const spinner = createSpinner("Checking kit access...").start();
	const github = new GitHubClient();

	// Use allSettled so a single failure does not abort other in-flight checks
	const settled = await Promise.allSettled(
		Object.entries(AVAILABLE_KITS).map(async ([type, config]) => {
			await github.checkAccess(config);
			logger.debug(`Access confirmed: ${type}`);
			return type as KitType;
		}),
	);

	// Separate 404 rejections (benign "no access") from other failures (must propagate)
	const accessible: KitType[] = [];
	const fatalErrors: GitHubError[] = [];

	for (const result of settled) {
		if (result.status === "fulfilled") {
			accessible.push(result.value);
		} else {
			const err = result.reason;
			// 404 = kit not accessible to this user — expected, treat as "no access".
			// In production, `checkAccess` always wraps errors as GitHubError (which uses
			// `statusCode` via ClaudeKitError). The `.status` fallback is defense-in-depth
			// for raw Octokit-style errors that might bypass that wrapping (e.g. in tests
			// or future call paths) — without it, a raw 404 would fall through to the
			// fatal-error branch and incorrectly throw.
			const status = (err as any)?.statusCode ?? (err as any)?.status;
			if (status === 404) {
				logger.debug("No access to kit (404)");
			} else {
				// Any other failure is a real error — classify and collect it
				fatalErrors.push(toGitHubError(err));
			}
		}
	}

	// If any non-404 error occurred, throw the first one so callers can surface it.
	// We must never silently convert a NETWORK/AUTH/RATE_LIMIT failure into "no access".
	if (fatalErrors.length > 0) {
		spinner.fail("Kit access check failed");
		// Log any additional errors at debug level so they aren't silently lost
		for (const extra of fatalErrors.slice(1)) {
			logger.debug(`Additional kit access error (suppressed): ${extra.message}`);
		}
		throw fatalErrors[0];
	}

	if (accessible.length === 0) {
		spinner.fail("No kit access found");
	} else {
		spinner.succeed(`Access verified: ${accessible.join(", ")}`);
	}

	return accessible;
}
