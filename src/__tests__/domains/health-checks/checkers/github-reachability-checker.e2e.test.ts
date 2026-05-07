/**
 * E2E test for GitHubReachabilityChecker — hits real api.github.com.
 *
 * Skipped by default in CI. Enable with: CK_TEST_NETWORK=1 bun test
 *
 * Uses `createDefaultDeps()` from the production module so the e2e exercises
 * the same DNS/TCP/TLS implementations the prod path uses (auth is stubbed
 * because dev machines may not always have a valid token).
 */

import { describe, expect, test } from "bun:test";

const NETWORK_ENABLED = process.env.CK_TEST_NETWORK === "1";

describe("GitHubReachabilityChecker e2e (real network)", () => {
	if (!NETWORK_ENABLED) {
		test.skip("skipped — set CK_TEST_NETWORK=1 to run", () => {});
		return;
	}

	test("DNS, TCP, and TLS layers pass against real api.github.com (auth stubbed)", async () => {
		const { checkGitHubReachability, createDefaultDeps } = await import(
			"@/domains/health-checks/checkers/github-reachability-checker.js"
		);

		// Use the production deps for real probes — DO NOT re-implement them here.
		// Auth is stubbed because dev machines may not have a valid GitHub token,
		// and this test is only validating the transport layers (DNS/TCP/TLS).
		const deps = createDefaultDeps();
		deps.auth = {
			checkKitAccess: async () => ({
				ok: true,
				layer: "auth" as const,
				detail: "e2e-skip",
				latencyMs: 0,
			}),
		};

		const result = await checkGitHubReachability(deps);

		// DNS, TCP, TLS MUST pass on a machine with internet access
		expect(result.layers.dns.ok).toBe(true);
		expect(result.layers.tcp?.ok).toBe(true);
		expect(result.layers.tls?.ok).toBe(true);

		// Each passing layer reports latency
		expect(result.layers.dns.latencyMs).toBeGreaterThan(0);
		if (result.layers.tcp) expect(result.layers.tcp.latencyMs).toBeGreaterThan(0);
		if (result.layers.tls) expect(result.layers.tls.latencyMs).toBeGreaterThan(0);
	}, 15000);

	test("GitHubReachabilityChecker.run() returns CheckResult with id github-reachability", async () => {
		const { GitHubReachabilityChecker } = await import(
			"@/domains/health-checks/checkers/github-reachability-checker.js"
		);

		const checker = new GitHubReachabilityChecker();
		const results = await checker.run();

		expect(results).toHaveLength(1);
		expect(results[0].id).toBe("github-reachability");
		expect(results[0].group).toBe("network");
		expect(results[0].autoFixable).toBe(false);
		// In CI/test env this returns status "info" via the skip guard; on a real
		// online dev machine with CK_TEST_NETWORK=1 set explicitly outside CI, it
		// should be pass or fail depending on auth state.
		expect(["pass", "fail", "info"]).toContain(results[0].status);
	}, 15000);
});
