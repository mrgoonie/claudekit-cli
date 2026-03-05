/**
 * Action suggester for GitHub errors
 * Maps error categories to actionable fix commands users can run
 */

import type { ErrorCategory } from "./error-classifier.js";

export interface SuggestedAction {
	title: string;
	commands: string[];
	notes?: string[];
}

/**
 * Get actionable fix suggestions for a given error category
 */
export function suggestActions(category: ErrorCategory): SuggestedAction[] {
	const actions: Record<ErrorCategory, SuggestedAction[]> = {
		RATE_LIMIT: [
			{
				title: "Wait for rate limit reset",
				commands: [],
				notes: ["Rate limits reset hourly", "Check GitHub rate limit status"],
			},
			{
				title: "Authenticate for higher limits",
				commands: ["gh auth login", "(Select 'Login with a web browser' when prompted)"],
				notes: [
					"Authenticated requests have higher rate limits (5,000/hour vs 60/hour)",
					"Use a GitHub token for CI/CD environments",
				],
			},
		],
		AUTH_MISSING: [
			{
				title: "Re-authenticate with GitHub CLI",
				commands: ["gh auth login", "(Select 'Login with a web browser' when prompted)"],
				notes: ["Use web browser authentication instead of personal access token"],
			},
		],
		AUTH_SCOPE: [
			{
				title: "Re-authenticate with full permissions",
				commands: ["gh auth login", "(Select 'Login with a web browser' when prompted)"],
				notes: [
					"Make sure to grant 'repo' scope when authenticating",
					"Web browser login automatically grants required scopes",
				],
			},
		],
		REPO_NOT_FOUND: [
			{
				title: "Accept GitHub repository invitation",
				commands: [],
				notes: [
					"Check your email for a GitHub invitation",
					"Visit https://github.com/notifications to see pending invitations",
					"After accepting, wait 2-5 minutes for permissions to sync",
				],
			},
			{
				title: "Verify repository access",
				commands: ["gh repo view OWNER/REPO"],
				notes: ["Replace OWNER/REPO with the actual repository name"],
			},
		],
		REPO_ACCESS: [
			{
				title: "Accept repository invitation",
				commands: [],
				notes: ["Check email for GitHub invitation and accept it"],
			},
		],
		NETWORK: [
			{
				title: "Check internet connection",
				commands: ["ping github.com", "curl -I https://api.github.com"],
				notes: ["Verify you can reach GitHub servers", "Check firewall/proxy settings"],
			},
		],
		SSH_KEY: [
			{
				title: "Add SSH key to GitHub",
				commands: [
					"ssh-keygen -t ed25519 -C 'your_email@example.com'",
					"cat ~/.ssh/id_ed25519.pub",
					"# Copy the output and add to GitHub: https://github.com/settings/keys",
				],
				notes: ["Alternative: Use HTTPS instead of SSH for git operations"],
			},
		],
		UNKNOWN: [
			{
				title: "Get more details",
				commands: ["ck <command> --verbose"],
				notes: ["Run the command with --verbose flag to see detailed error information"],
			},
		],
	};

	return actions[category] || actions.UNKNOWN;
}

/**
 * Format suggested actions as a user-friendly string
 */
export function formatActions(actions: SuggestedAction[]): string {
	const lines: string[] = [];

	for (const action of actions) {
		lines.push(`\n${action.title}:`);

		if (action.commands.length > 0) {
			for (const cmd of action.commands) {
				lines.push(`  ${cmd}`);
			}
		}

		if (action.notes && action.notes.length > 0) {
			lines.push("");
			for (const note of action.notes) {
				lines.push(`  ${note}`);
			}
		}
	}

	return lines.join("\n");
}
