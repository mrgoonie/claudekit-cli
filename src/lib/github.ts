import { Octokit } from "@octokit/rest";
import { GitHubError, type GitHubRelease, GitHubReleaseSchema, type KitConfig } from "../types.js";
import { logger } from "../utils/logger.js";
import { AuthManager } from "./auth.js";

export class GitHubClient {
	private octokit: Octokit | null = null;

	/**
	 * Initialize Octokit client with authentication
	 */
	private async getClient(): Promise<Octokit> {
		if (this.octokit) {
			return this.octokit;
		}

		const { token } = await AuthManager.getToken();

		this.octokit = new Octokit({
			auth: token,
			userAgent: "claudekit-cli",
			request: {
				timeout: 30000, // 30 seconds
			},
		});

		return this.octokit;
	}

	/**
	 * Get latest release for a kit
	 */
	async getLatestRelease(kit: KitConfig): Promise<GitHubRelease> {
		try {
			const client = await this.getClient();

			logger.debug(`Fetching latest release for ${kit.owner}/${kit.repo}`);

			const { data } = await client.repos.getLatestRelease({
				owner: kit.owner,
				repo: kit.repo,
			});

			return GitHubReleaseSchema.parse(data);
		} catch (error: any) {
			if (error?.status === 404) {
				throw new GitHubError(`No releases found for ${kit.name}`, 404);
			}
			if (error?.status === 401) {
				throw new GitHubError("Authentication failed. Please check your GitHub token.", 401);
			}
			if (error?.status === 403) {
				throw new GitHubError(
					"Access denied. Make sure your token has access to private repositories.",
					403,
				);
			}
			throw new GitHubError(
				`Failed to fetch release: ${error?.message || "Unknown error"}`,
				error?.status,
			);
		}
	}

	/**
	 * Get specific release by version tag
	 */
	async getReleaseByTag(kit: KitConfig, tag: string): Promise<GitHubRelease> {
		try {
			const client = await this.getClient();

			logger.debug(`Fetching release ${tag} for ${kit.owner}/${kit.repo}`);

			const { data } = await client.repos.getReleaseByTag({
				owner: kit.owner,
				repo: kit.repo,
				tag,
			});

			return GitHubReleaseSchema.parse(data);
		} catch (error: any) {
			if (error?.status === 404) {
				throw new GitHubError(`Release ${tag} not found for ${kit.name}`, 404);
			}
			if (error?.status === 401) {
				throw new GitHubError("Authentication failed. Please check your GitHub token.", 401);
			}
			if (error?.status === 403) {
				throw new GitHubError(
					"Access denied. Make sure your token has access to private repositories.",
					403,
				);
			}
			throw new GitHubError(
				`Failed to fetch release: ${error?.message || "Unknown error"}`,
				error?.status,
			);
		}
	}

	/**
	 * List all releases for a kit
	 */
	async listReleases(kit: KitConfig, limit = 10): Promise<GitHubRelease[]> {
		try {
			const client = await this.getClient();

			logger.debug(`Listing releases for ${kit.owner}/${kit.repo}`);

			const { data } = await client.repos.listReleases({
				owner: kit.owner,
				repo: kit.repo,
				per_page: limit,
			});

			return data.map((release) => GitHubReleaseSchema.parse(release));
		} catch (error: any) {
			if (error?.status === 401) {
				throw new GitHubError("Authentication failed. Please check your GitHub token.", 401);
			}
			if (error?.status === 403) {
				throw new GitHubError(
					"Access denied. Make sure your token has access to private repositories.",
					403,
				);
			}
			throw new GitHubError(
				`Failed to list releases: ${error?.message || "Unknown error"}`,
				error?.status,
			);
		}
	}

	/**
	 * Check if user has access to repository
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
			if (error?.status === 404 || error?.status === 403) {
				return false;
			}
			throw new GitHubError(
				`Failed to check repository access: ${error?.message || "Unknown error"}`,
				error?.status,
			);
		}
	}
}
