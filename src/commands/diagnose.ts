import { execSync } from "node:child_process";
import * as clack from "@clack/prompts";
import { AuthManager } from "../lib/auth.js";
import { GitHubClient } from "../lib/github.js";
import { AVAILABLE_KITS, type KitType } from "../types.js";
import { logger } from "../utils/logger.js";

interface DiagnosticResult {
	name: string;
	status: "pass" | "fail" | "warning" | "info";
	message: string;
	details?: string;
	suggestion?: string;
}

export async function diagnoseCommand(options: { kit?: KitType }) {
	clack.intro("🔍 ClaudeKit CLI Diagnostics");

	const results: DiagnosticResult[] = [];

	// 1. Check GitHub CLI
	results.push(await checkGitHubCli());

	// 2. Check Environment Variables
	results.push(checkEnvironmentVariables());

	// 3. Check Authentication
	const authResult = await checkAuthentication();
	results.push(authResult);

	// If auth succeeded, check repository access
	if (authResult.status === "pass") {
		// 4. Check Repository Access
		const kitsToCheck = options.kit ? [options.kit] : (["engineer"] as KitType[]);
		for (const kit of kitsToCheck) {
			const repoResult = await checkRepositoryAccess(kit);
			results.push(repoResult);

			// If repo access succeeded, check releases
			if (repoResult.status === "pass") {
				results.push(await checkReleases(kit));
			}
		}
	}

	// 5. Check System Info
	results.push(checkSystemInfo());

	// Display results
	logger.info("");
	logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
	logger.info("Diagnostic Results:");
	logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
	logger.info("");

	let passCount = 0;
	let failCount = 0;
	let warnCount = 0;

	for (const result of results) {
		const icon =
			result.status === "pass"
				? "✅"
				: result.status === "fail"
					? "❌"
					: result.status === "warning"
						? "⚠️"
						: "ℹ️";

		logger.info(`${icon} ${result.name}`);
		logger.info(`   ${result.message}`);

		if (result.details) {
			logger.info(`   ${result.details}`);
		}

		if (result.suggestion) {
			logger.info(`   💡 ${result.suggestion}`);
		}

		logger.info("");

		if (result.status === "pass") passCount++;
		if (result.status === "fail") failCount++;
		if (result.status === "warning") warnCount++;
	}

	// Summary
	logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
	logger.info(`Summary: ${passCount} passed, ${failCount} failed, ${warnCount} warnings`);
	logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

	if (failCount > 0) {
		logger.info("");
		logger.info("Run 'ck diagnose --verbose' for more details");
		logger.info("Need help? https://github.com/mrgoonie/claudekit-cli/issues");
	}

	clack.outro(failCount === 0 ? "All checks passed! 🎉" : "Some issues detected");

	process.exit(failCount > 0 ? 1 : 0);
}

/**
 * Check if GitHub CLI is installed and authenticated
 */
async function checkGitHubCli(): Promise<DiagnosticResult> {
	try {
		// Check if gh is installed
		execSync("gh --version", { stdio: "ignore" });

		// Check if authenticated
		try {
			const status = execSync("gh auth status", {
				encoding: "utf-8",
				stdio: ["pipe", "pipe", "pipe"],
			});

			logger.debug(`GitHub CLI status: ${String(status)}`);

			return {
				name: "GitHub CLI",
				status: "pass",
				message: "GitHub CLI is installed and authenticated",
				details: "This is the recommended authentication method",
			};
		} catch (authError) {
			return {
				name: "GitHub CLI",
				status: "warning",
				message: "GitHub CLI is installed but not authenticated",
				suggestion: "Run: gh auth login",
			};
		}
	} catch {
		return {
			name: "GitHub CLI",
			status: "info",
			message: "GitHub CLI is not installed",
			suggestion:
				"Install for easier authentication:\n" +
				"   • Windows: winget install GitHub.cli\n" +
				"   • macOS: brew install gh\n" +
				"   • Linux: sudo apt install gh",
		};
	}
}

/**
 * Check environment variables
 */
function checkEnvironmentVariables(): DiagnosticResult {
	const githubToken = process.env.GITHUB_TOKEN;
	const ghToken = process.env.GH_TOKEN;

	if (githubToken || ghToken) {
		const tokenToCheck = githubToken || ghToken;
		const tokenVar = githubToken ? "GITHUB_TOKEN" : "GH_TOKEN";

		// Validate token format
		if (!tokenToCheck?.startsWith("ghp_") && !tokenToCheck?.startsWith("github_pat_")) {
			return {
				name: "Environment Variables",
				status: "fail",
				message: `${tokenVar} is set but has invalid format`,
				details: "Token should start with 'ghp_' or 'github_pat_'",
				suggestion: "Create new token: https://github.com/settings/tokens/new?scopes=repo",
			};
		}

		return {
			name: "Environment Variables",
			status: "pass",
			message: `${tokenVar} is set and has valid format`,
			details: `Token: ${tokenToCheck.substring(0, 8)}...`,
		};
	}

	return {
		name: "Environment Variables",
		status: "info",
		message: "No GitHub token found in environment variables",
		details: "GITHUB_TOKEN or GH_TOKEN not set",
		suggestion:
			"Set token:\n" +
			"   • Unix/Mac: export GITHUB_TOKEN=ghp_xxx\n" +
			"   • Windows: [System.Environment]::SetEnvironmentVariable('GITHUB_TOKEN', 'ghp_xxx', 'User')",
	};
}

/**
 * Check authentication
 */
async function checkAuthentication(): Promise<DiagnosticResult> {
	try {
		const { token, method } = await AuthManager.getToken();

		const methodLabels = {
			"gh-cli": "GitHub CLI",
			"env-var": "Environment Variable",
			keychain: "OS Keychain",
			prompt: "User Prompt",
		};

		// Validate token format
		if (!AuthManager.isValidTokenFormat(token)) {
			return {
				name: "Authentication",
				status: "fail",
				message: "Token has invalid format",
				details: "Token should start with 'ghp_' or 'github_pat_'",
				suggestion: "Create new token: https://github.com/settings/tokens/new?scopes=repo",
			};
		}

		return {
			name: "Authentication",
			status: "pass",
			message: `Successfully authenticated via ${methodLabels[method]}`,
			details: `Token: ${token.substring(0, 8)}...`,
		};
	} catch (error: any) {
		return {
			name: "Authentication",
			status: "fail",
			message: "Failed to obtain authentication token",
			details: error?.message || "Unknown error",
			suggestion:
				"Options:\n" +
				"   1. Use GitHub CLI: gh auth login\n" +
				"   2. Set GITHUB_TOKEN environment variable\n" +
				"   3. Create token: https://github.com/settings/tokens/new?scopes=repo",
		};
	}
}

/**
 * Check repository access
 */
async function checkRepositoryAccess(kit: KitType): Promise<DiagnosticResult> {
	const kitConfig = AVAILABLE_KITS[kit];
	if (!kitConfig) {
		return {
			name: `Repository Access (${kit})`,
			status: "fail",
			message: `Unknown kit: ${kit}`,
		};
	}

	try {
		const client = new GitHubClient();
		const hasAccess = await client.checkAccess(kitConfig);

		if (hasAccess) {
			return {
				name: `Repository Access (${kit})`,
				status: "pass",
				message: `You have access to ${kitConfig.owner}/${kitConfig.repo}`,
			};
		}

		return {
			name: `Repository Access (${kit})`,
			status: "fail",
			message: `Cannot access ${kitConfig.owner}/${kitConfig.repo}`,
			suggestion:
				"Solutions:\n" +
				"   1. Check email for GitHub invitation and accept it\n" +
				"   2. Verify token has 'repo' scope (not just 'public_repo')\n" +
				"   3. Wait 2-5 minutes after accepting invitation\n" +
				"   4. Contact support if issue persists",
		};
	} catch (error: any) {
		return {
			name: `Repository Access (${kit})`,
			status: "fail",
			message: "Failed to check repository access",
			details: error?.message || "Unknown error",
			suggestion:
				"Possible causes:\n" +
				"   • Token lacks 'repo' scope\n" +
				"   • You haven't been added as collaborator\n" +
				"   • Network connectivity issues",
		};
	}
}

/**
 * Check releases
 */
async function checkReleases(kit: KitType): Promise<DiagnosticResult> {
	const kitConfig = AVAILABLE_KITS[kit];
	if (!kitConfig) {
		return {
			name: `Releases (${kit})`,
			status: "fail",
			message: `Unknown kit: ${kit}`,
		};
	}

	try {
		const client = new GitHubClient();
		const releases = await client.listReleases(kitConfig, 5);

		if (releases.length === 0) {
			return {
				name: `Releases (${kit})`,
				status: "warning",
				message: "No releases found",
				suggestion: "Contact support if releases should exist",
			};
		}

		const latest = releases[0];
		const publishDate =
			latest.published_at && latest.published_at !== ""
				? new Date(latest.published_at).toLocaleDateString()
				: "N/A";
		return {
			name: `Releases (${kit})`,
			status: "pass",
			message: `Found ${releases.length} release(s)`,
			details: `Latest: ${latest.tag_name} (${publishDate})`,
		};
	} catch (error: any) {
		return {
			name: `Releases (${kit})`,
			status: "fail",
			message: "Failed to fetch releases",
			details: error?.message || "Unknown error",
		};
	}
}

/**
 * Check system info
 */
function checkSystemInfo(): DiagnosticResult {
	const platform = process.platform;
	const arch = process.arch;
	const nodeVersion = process.version;
	const cwd = process.cwd();

	const platformLabels: Record<string, string> = {
		win32: "Windows",
		darwin: "macOS",
		linux: "Linux",
	};

	return {
		name: "System Information",
		status: "info",
		message: `${platformLabels[platform] || platform} ${arch}`,
		details:
			`Node.js: ${nodeVersion}\n` +
			`   Working directory: ${cwd}\n` +
			`   ClaudeKit CLI: v${process.env.npm_package_version || "unknown"}`,
	};
}
