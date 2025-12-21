/**
 * GitHub Repository API operations
 */
import { GitHubError, type KitConfig } from "@/types";
import type { Octokit } from "@octokit/rest";
import { handleHttpError } from "./error-handler.js";

export class RepoApi {
	constructor(private getClient: () => Promise<Octokit>) {}

	/**
	 * Check if user has access to repository
	 * Throws detailed error messages for common auth issues
	 */
	async checkAccess(kit: KitConfig): Promise<boolean> {
		try {
			const client = await this.getClient();

			await client.repos.get({
				owner: kit.owner,
				repo: kit.repo,
			});

			return true;
		} catch (error: any) {
			// Custom 404 with additional account verification hint
			if (error?.status === 404) {
				throw new GitHubError(
					`Cannot access ${kit.name} repository.\n\nPossible causes:\n  • You haven't accepted the GitHub repository invitation\n  • You're not added as a collaborator yet\n  • You're logged into a different GitHub account\n\nSolutions:\n  1. Check email for GitHub invitation and accept it\n  2. Re-authenticate: gh auth login (select 'Login with a web browser')\n  3. Verify you're using the correct GitHub account\n  4. Wait 2-5 minutes after accepting invitation for permissions to sync\n\nNeed help? Run with: ck new --verbose`,
					404,
				);
			}
			return handleHttpError(error, {
				kit,
				operation: "check repository access",
				verboseFlag: "ck new --verbose",
			});
		}
	}
}
