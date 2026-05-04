/**
 * Unit tests for GitHubReachabilityChecker
 * Tests each probe layer using dependency injection (no global mock side effects).
 */

import { describe, expect, test } from "bun:test";
import type {
	GitHubReachabilityDeps,
	ProbeResult,
} from "@/domains/health-checks/checkers/github-reachability-checker.js";
import { checkGitHubReachability } from "@/domains/health-checks/checkers/github-reachability-checker.js";

// ---------------------------------------------------------------------------
// Helpers to build minimal fake deps
// ---------------------------------------------------------------------------

function dnsOk(): GitHubReachabilityDeps["dns"] {
	return {
		resolve4: async (_host: string) => ["140.82.112.3"],
		resolve6: async (_host: string) => ["2606:50c0:8000::153"],
	};
}

function dnsFail(): GitHubReachabilityDeps["dns"] {
	return {
		resolve4: async (_host: string) => {
			throw new Error("ENOTFOUND api.github.com");
		},
		resolve6: async (_host: string) => {
			throw new Error("ENOTFOUND api.github.com");
		},
	};
}

function tcpOk(): GitHubReachabilityDeps["tcp"] {
	return {
		connect: (_opts: { host: string; port: number; timeoutMs: number }) =>
			Promise.resolve<ProbeResult>({
				ok: true,
				layer: "tcp",
				detail: "connected",
				latencyMs: 5,
			}),
	};
}

function tcpFail(): GitHubReachabilityDeps["tcp"] {
	return {
		connect: (_opts: { host: string; port: number; timeoutMs: number }) =>
			Promise.resolve<ProbeResult>({
				ok: false,
				layer: "tcp",
				detail: "ECONNREFUSED",
				latencyMs: 10,
			}),
	};
}

function tlsOk(): GitHubReachabilityDeps["tls"] {
	return {
		get: (_url: string, _timeoutMs: number) =>
			Promise.resolve<ProbeResult>({
				ok: true,
				layer: "tls",
				detail: "HTTP 200",
				latencyMs: 80,
			}),
	};
}

function tlsFail(status = 500): GitHubReachabilityDeps["tls"] {
	return {
		get: (_url: string, _timeoutMs: number) =>
			Promise.resolve<ProbeResult>({
				ok: false,
				layer: "tls",
				detail: `HTTP ${status}`,
				latencyMs: 120,
			}),
	};
}

function authOk(): GitHubReachabilityDeps["auth"] {
	return {
		checkKitAccess: async () =>
			Promise.resolve<ProbeResult>({
				ok: true,
				layer: "auth",
				detail: "200 OK",
				latencyMs: 200,
			}),
	};
}

function authFail(statusCode: number, detail: string): GitHubReachabilityDeps["auth"] {
	return {
		checkKitAccess: async () =>
			Promise.resolve<ProbeResult>({
				ok: false,
				layer: "auth",
				detail,
				latencyMs: 100,
				statusCode,
			}),
	};
}

// ---------------------------------------------------------------------------
// Tests — single layer failures
// ---------------------------------------------------------------------------

describe("checkGitHubReachability", () => {
	test("DNS failure → result.layer === dns", async () => {
		const result = await checkGitHubReachability({
			dns: dnsFail(),
			tcp: tcpOk(),
			tls: tlsOk(),
			auth: authOk(),
		});

		expect(result.ok).toBe(false);
		expect(result.failedLayer).toBe("dns");
		expect(result.layers.dns.ok).toBe(false);
		// TCP/TLS/Auth not run when DNS fails
		expect(result.layers.tcp).toBeUndefined();
		expect(result.layers.tls).toBeUndefined();
		expect(result.layers.auth).toBeUndefined();
	});

	test("TCP failure → result.layer === tcp", async () => {
		const result = await checkGitHubReachability({
			dns: dnsOk(),
			tcp: tcpFail(),
			tls: tlsOk(),
			auth: authOk(),
		});

		expect(result.ok).toBe(false);
		expect(result.failedLayer).toBe("tcp");
		expect(result.layers.dns.ok).toBe(true);
		expect(result.layers.tcp?.ok).toBe(false);
		expect(result.layers.tls).toBeUndefined();
	});

	test("TLS failure (HTTP 500) → result.layer === tls", async () => {
		const result = await checkGitHubReachability({
			dns: dnsOk(),
			tcp: tcpOk(),
			tls: tlsFail(500),
			auth: authOk(),
		});

		expect(result.ok).toBe(false);
		expect(result.failedLayer).toBe("tls");
		expect(result.layers.dns.ok).toBe(true);
		expect(result.layers.tcp?.ok).toBe(true);
		expect(result.layers.tls?.ok).toBe(false);
		expect(result.layers.tls?.detail).toContain("500");
		expect(result.layers.auth).toBeUndefined();
	});

	test("Auth failure (401) → result.layer === auth, detail mentions auth", async () => {
		const result = await checkGitHubReachability({
			dns: dnsOk(),
			tcp: tcpOk(),
			tls: tlsOk(),
			auth: authFail(401, "401 Unauthorized — token invalid or missing"),
		});

		expect(result.ok).toBe(false);
		expect(result.failedLayer).toBe("auth");
		expect(result.layers.auth?.ok).toBe(false);
		expect(result.layers.auth?.detail.toLowerCase()).toMatch(/auth|401|token/);
	});

	test("Auth failure (404 no invite) → result.layer === auth", async () => {
		const result = await checkGitHubReachability({
			dns: dnsOk(),
			tcp: tcpOk(),
			tls: tlsOk(),
			auth: authFail(404, "404 — no repository access (invitation pending)"),
		});

		expect(result.ok).toBe(false);
		expect(result.failedLayer).toBe("auth");
		expect(result.layers.auth?.detail).toContain("404");
	});

	test("All layers pass → ok=true with per-layer latencyMs", async () => {
		const result = await checkGitHubReachability({
			dns: dnsOk(),
			tcp: tcpOk(),
			tls: tlsOk(),
			auth: authOk(),
		});

		expect(result.ok).toBe(true);
		expect(result.failedLayer).toBeUndefined();

		// All four layers present
		expect(result.layers.dns).toBeDefined();
		expect(result.layers.tcp).toBeDefined();
		expect(result.layers.tls).toBeDefined();
		expect(result.layers.auth).toBeDefined();

		// latencyMs reported for each
		expect(typeof result.layers.dns.latencyMs).toBe("number");
		expect(typeof result.layers.tcp?.latencyMs).toBe("number");
		expect(typeof result.layers.tls?.latencyMs).toBe("number");
		expect(typeof result.layers.auth?.latencyMs).toBe("number");
	});

	test("DNS resolve4 fail but resolve6 ok → DNS layer passes", async () => {
		const mixedDns: GitHubReachabilityDeps["dns"] = {
			resolve4: async () => {
				throw new Error("ENOTFOUND");
			},
			resolve6: async () => ["2606:50c0:8000::153"],
		};

		const result = await checkGitHubReachability({
			dns: mixedDns,
			tcp: tcpOk(),
			tls: tlsOk(),
			auth: authOk(),
		});

		expect(result.layers.dns.ok).toBe(true);
		expect(result.ok).toBe(true);
	});

	test("Both resolve4 and resolve6 fail → DNS layer fails", async () => {
		const result = await checkGitHubReachability({
			dns: dnsFail(),
			tcp: tcpOk(),
			tls: tlsOk(),
			auth: authOk(),
		});

		expect(result.layers.dns.ok).toBe(false);
		expect(result.failedLayer).toBe("dns");
	});
});

// ---------------------------------------------------------------------------
// CheckResult shape (integration with health-check types)
// ---------------------------------------------------------------------------

describe("GitHubReachabilityChecker class", () => {
	test("run() returns a single CheckResult with id github-reachability", async () => {
		const { GitHubReachabilityChecker } = await import(
			"@/domains/health-checks/checkers/github-reachability-checker.js"
		);

		const checker = new GitHubReachabilityChecker({
			// Inject fast fakes so unit test doesn't hit the network
			deps: {
				dns: dnsOk(),
				tcp: tcpOk(),
				tls: tlsOk(),
				auth: authOk(),
			},
		});

		const results = await checker.run();

		expect(results).toHaveLength(1);
		expect(results[0].id).toBe("github-reachability");
		expect(results[0].group).toBe("network");
		expect(results[0].autoFixable).toBe(false);
		expect(results[0].status).toBe("pass");
	});

	test("run() returns fail status when DNS down", async () => {
		const { GitHubReachabilityChecker } = await import(
			"@/domains/health-checks/checkers/github-reachability-checker.js"
		);

		const checker = new GitHubReachabilityChecker({
			deps: {
				dns: dnsFail(),
				tcp: tcpOk(),
				tls: tlsOk(),
				auth: authOk(),
			},
		});

		const results = await checker.run();

		expect(results[0].status).toBe("fail");
		expect(results[0].message.toLowerCase()).toMatch(/dns/);
	});

	test("auth failure with statusCode 401 → 'gh auth login' suggestion", async () => {
		const { GitHubReachabilityChecker } = await import(
			"@/domains/health-checks/checkers/github-reachability-checker.js"
		);

		const checker = new GitHubReachabilityChecker({
			deps: {
				dns: dnsOk(),
				tcp: tcpOk(),
				tls: tlsOk(),
				auth: authFail(401, "401 Unauthorized — token invalid or missing"),
			},
		});

		const results = await checker.run();

		expect(results[0].status).toBe("fail");
		expect(results[0].suggestion ?? "").toContain("gh auth login");
	});

	test("auth failure with statusCode 404 → 'invitation' suggestion (not gh auth login)", async () => {
		const { GitHubReachabilityChecker } = await import(
			"@/domains/health-checks/checkers/github-reachability-checker.js"
		);

		const checker = new GitHubReachabilityChecker({
			deps: {
				dns: dnsOk(),
				tcp: tcpOk(),
				tls: tlsOk(),
				auth: authFail(404, "404 — no repository access (invitation pending)"),
			},
		});

		const results = await checker.run();

		expect(results[0].status).toBe("fail");
		expect(results[0].suggestion ?? "").toContain("claudekit.cc");
		expect(results[0].suggestion ?? "").not.toContain("gh auth login");
	});
});
