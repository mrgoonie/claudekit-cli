import { logger } from "../../utils/logger.js";
import type { CheckResult, Checker } from "./types.js";

// Make NETWORK_TIMEOUT configurable via environment variable
const NETWORK_TIMEOUT = Number.parseInt(process.env.CLAUDEKIT_NETWORK_TIMEOUT || "3000", 10); // 3 seconds default

export class NetworkChecker implements Checker {
	readonly group = "network" as const;

	async run(): Promise<CheckResult[]> {
		// Skip in CI or test mode
		if (this.isCI()) {
			logger.verbose("NetworkChecker: Skipping in CI environment");
			return [];
		}

		const results: CheckResult[] = [];

		// Check proxy first (no network call)
		results.push(this.checkProxyDetected());

		// Network checks
		results.push(await this.checkGitHubReachable());
		results.push(await this.checkApiGitHub());

		return results;
	}

	private isCI(): boolean {
		return (
			process.env.CI === "true" ||
			process.env.CI_SAFE_MODE === "true" ||
			process.env.NODE_ENV === "test" ||
			process.env.VITEST === "true" ||
			process.env.JEST_WORKER_ID !== undefined ||
			process.env.TEST === "true"
		);
	}

	private checkProxyDetected(): CheckResult {
		const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
		const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
		const noProxy = process.env.NO_PROXY || process.env.no_proxy;

		const hasProxy = !!(httpProxy || httpsProxy);

		if (!hasProxy) {
			return {
				id: "net-proxy-detected",
				name: "Proxy",
				group: "network",
				priority: "standard",
				status: "info",
				message: "No proxy configured",
				autoFixable: false,
			};
		}

		const details: string[] = [];
		if (httpProxy) details.push(`HTTP_PROXY=${httpProxy}`);
		if (httpsProxy) details.push(`HTTPS_PROXY=${httpsProxy}`);
		if (noProxy) details.push(`NO_PROXY=${noProxy}`);

		return {
			id: "net-proxy-detected",
			name: "Proxy",
			group: "network",
			priority: "standard",
			status: "warn",
			message: "Proxy detected",
			details: details.join(", "),
			suggestion: "Ensure proxy settings allow access to github.com",
			autoFixable: false,
		};
	}

	private async checkGitHubReachable(): Promise<CheckResult> {
		const startTime = Date.now();

		try {
			const response = await fetch("https://github.com", {
				method: "HEAD",
				signal: AbortSignal.timeout(NETWORK_TIMEOUT),
			});

			const latency = Date.now() - startTime;

			if (response.ok || response.status === 301 || response.status === 302) {
				return {
					id: "net-github-reachable",
					name: "GitHub",
					group: "network",
					priority: "standard",
					status: "pass",
					message: `Connected (${latency}ms)`,
					autoFixable: false,
				};
			}

			return {
				id: "net-github-reachable",
				name: "GitHub",
				group: "network",
				priority: "standard",
				status: "warn",
				message: `HTTP ${response.status}`,
				suggestion: "GitHub returned unexpected status",
				autoFixable: false,
			};
		} catch (error) {
			const isTimeout = error instanceof Error && error.name === "AbortError";

			return {
				id: "net-github-reachable",
				name: "GitHub",
				group: "network",
				priority: "standard",
				status: "fail",
				message: isTimeout ? `Timeout (>${NETWORK_TIMEOUT}ms)` : "Connection failed",
				suggestion: "Check internet connection or proxy settings",
				autoFixable: false,
			};
		}
	}

	private async checkApiGitHub(): Promise<CheckResult> {
		const startTime = Date.now();

		try {
			// Use rate_limit endpoint - lightweight, no auth needed
			const response = await fetch("https://api.github.com/rate_limit", {
				method: "GET",
				headers: {
					Accept: "application/vnd.github.v3+json",
					"User-Agent": "claudekit-cli",
				},
				signal: AbortSignal.timeout(NETWORK_TIMEOUT),
			});

			const latency = Date.now() - startTime;

			if (response.ok) {
				return {
					id: "net-api-github",
					name: "GitHub API",
					group: "network",
					priority: "standard",
					status: "pass",
					message: `Connected (${latency}ms)`,
					autoFixable: false,
				};
			}

			return {
				id: "net-api-github",
				name: "GitHub API",
				group: "network",
				priority: "standard",
				status: "warn",
				message: `HTTP ${response.status}`,
				suggestion:
					response.status === 403
						? "Rate limited - wait or authenticate"
						: "API returned unexpected status",
				autoFixable: false,
			};
		} catch (error) {
			const isTimeout = error instanceof Error && error.name === "AbortError";

			return {
				id: "net-api-github",
				name: "GitHub API",
				group: "network",
				priority: "standard",
				status: "fail",
				message: isTimeout ? `Timeout (>${NETWORK_TIMEOUT}ms)` : "Connection failed",
				suggestion: "Check internet connection or proxy settings for api.github.com",
				autoFixable: false,
			};
		}
	}
}
