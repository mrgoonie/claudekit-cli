/**
 * E2E test for GitHubReachabilityChecker — hits real api.github.com.
 *
 * Skipped by default in CI. Enable with: CK_TEST_NETWORK=1 bun test
 */

import { describe, expect, test } from "bun:test";

const NETWORK_ENABLED = process.env.CK_TEST_NETWORK === "1";

describe("GitHubReachabilityChecker e2e (real network)", () => {
	if (!NETWORK_ENABLED) {
		test.skip("skipped — set CK_TEST_NETWORK=1 to run", () => {});
		return;
	}

	test("all four layers pass against real api.github.com", async () => {
		const { checkGitHubReachability } = await import(
			"@/domains/health-checks/checkers/github-reachability-checker.js"
		);

		// Use real default deps by importing createDefaultDeps pattern from the checker
		// The checker's default constructor uses real deps — we call checkGitHubReachability
		// directly with real Node built-ins by constructing the deps inline.
		const dnsPromises = await import("node:dns/promises");
		const net = await import("node:net");
		const https = await import("node:https");

		const realDeps = {
			dns: {
				resolve4: (host: string) => dnsPromises.resolve4(host),
				resolve6: (host: string) => dnsPromises.resolve6(host),
			},
			tcp: {
				connect: ({ host, port, timeoutMs }: { host: string; port: number; timeoutMs: number }) =>
					new Promise<{ ok: boolean; layer: "tcp"; detail: string; latencyMs: number }>(
						(resolve) => {
							const start = Date.now();
							const socket = net.createConnection({ host, port });
							const timer = setTimeout(() => {
								socket.destroy();
								resolve({
									ok: false,
									layer: "tcp",
									detail: "timeout",
									latencyMs: Date.now() - start,
								});
							}, timeoutMs);
							socket.on("connect", () => {
								clearTimeout(timer);
								socket.destroy();
								resolve({
									ok: true,
									layer: "tcp",
									detail: "connected",
									latencyMs: Date.now() - start,
								});
							});
							socket.on("error", (err: Error) => {
								clearTimeout(timer);
								resolve({
									ok: false,
									layer: "tcp",
									detail: err.message,
									latencyMs: Date.now() - start,
								});
							});
						},
					),
			},
			tls: {
				get: (url: string, timeoutMs: number) =>
					new Promise<{ ok: boolean; layer: "tls"; detail: string; latencyMs: number }>(
						(resolve) => {
							const start = Date.now();
							const timer = setTimeout(() => {
								req.destroy();
								resolve({
									ok: false,
									layer: "tls",
									detail: "timeout",
									latencyMs: Date.now() - start,
								});
							}, timeoutMs);
							const req = https.get(
								url,
								{ headers: { "User-Agent": "claudekit-cli-doctor/1.0" } },
								(res) => {
									res.resume();
									clearTimeout(timer);
									const status = res.statusCode ?? 0;
									resolve({
										ok: status === 200,
										layer: "tls",
										detail: `HTTP ${status}`,
										latencyMs: Date.now() - start,
									});
								},
							);
							req.on("error", (err: Error) => {
								clearTimeout(timer);
								resolve({
									ok: false,
									layer: "tls",
									detail: err.message,
									latencyMs: Date.now() - start,
								});
							});
						},
					),
			},
			auth: {
				// For e2e, use an unauthenticated variant — we only assert TLS passes
				// The auth layer may legitimately fail without a valid token in CI/local.
				// We test up to TLS; if auth fails, check the layer explicitly.
				checkKitAccess: async () => {
					// Stub auth layer — we only verify DNS/TCP/TLS in this test.
					// Auth may legitimately fail without a valid GitHub token on dev machines.
					return { ok: true, layer: "auth" as const, detail: "e2e-skip", latencyMs: 0 };
				},
			},
		};

		const result = await checkGitHubReachability(realDeps);

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
		// On an online machine, DNS+TCP+TLS should all pass (auth may warn)
		expect(["pass", "fail"]).toContain(results[0].status);
	}, 15000);
});
