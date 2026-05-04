/**
 * GitHub Reachability Checker — layered network probe for `ck doctor`
 *
 * Runs four sequential probes. First failure stops the chain and is returned
 * as the root-cause layer. All layers pass → overall ok.
 *
 * Layers:
 *   1. DNS  — resolve4 OR resolve6 must succeed for api.github.com
 *   2. TCP  — connect to api.github.com:443
 *   3. TLS  — HTTPS GET /zen expects HTTP 200
 *   4. Auth — authenticated repos.get for a known kit (401 vs 404 vs other)
 *
 * Designed for testability: all I/O is injected via `GitHubReachabilityDeps`.
 * Real probes live in `createDefaultDeps()` and use Node built-ins only.
 */

import * as dnsPromises from "node:dns/promises";
import * as https from "node:https";
import * as net from "node:net";
import { logger } from "@/shared/logger.js";
import { AVAILABLE_KITS } from "@/types";
import type { CheckResult, Checker } from "../types.js";

// ---------------------------------------------------------------------------
// Public types (exported so tests can import without depending on impl detail)
// ---------------------------------------------------------------------------

export interface ProbeResult {
	ok: boolean;
	layer: "dns" | "tcp" | "tls" | "auth";
	detail: string;
	latencyMs: number;
}

export interface ReachabilityResult {
	ok: boolean;
	/** Set to the first failing layer name, undefined when all pass */
	failedLayer?: "dns" | "tcp" | "tls" | "auth";
	layers: {
		dns: ProbeResult;
		tcp?: ProbeResult;
		tls?: ProbeResult;
		auth?: ProbeResult;
	};
}

// ---------------------------------------------------------------------------
// Dependency interfaces (stable contract for injection)
// ---------------------------------------------------------------------------

export interface GitHubReachabilityDeps {
	dns: {
		resolve4: (host: string) => Promise<string[]>;
		resolve6: (host: string) => Promise<string[]>;
	};
	tcp: {
		connect: (opts: { host: string; port: number; timeoutMs: number }) => Promise<ProbeResult>;
	};
	tls: {
		get: (url: string, timeoutMs: number) => Promise<ProbeResult>;
	};
	auth: {
		checkKitAccess: () => Promise<ProbeResult>;
	};
}

// ---------------------------------------------------------------------------
// Default (real) implementations — use Node built-ins, zero runtime deps
// ---------------------------------------------------------------------------

/** Timeout for DNS resolution */
const DNS_TIMEOUT_MS = 200;
/** Timeout for TCP connect */
const TCP_TIMEOUT_MS = 1000;
/** Timeout for TLS + unauthenticated GET */
const TLS_TIMEOUT_MS = 3000;
/** Timeout for authenticated repos.get */
const AUTH_TIMEOUT_MS = 5000;

const API_HOST = "api.github.com";
const ZEN_URL = `https://${API_HOST}/zen`;

function createDefaultDns(): GitHubReachabilityDeps["dns"] {
	return {
		resolve4: (host) => dnsPromises.resolve4(host),
		resolve6: (host) => dnsPromises.resolve6(host),
	};
}

function createDefaultTcp(): GitHubReachabilityDeps["tcp"] {
	return {
		connect: ({ host, port, timeoutMs }) =>
			new Promise<ProbeResult>((resolve) => {
				const start = Date.now();
				const socket = net.createConnection({ host, port });
				const timer = setTimeout(() => {
					socket.destroy();
					resolve({ ok: false, layer: "tcp", detail: "timeout", latencyMs: Date.now() - start });
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

				socket.on("error", (err) => {
					clearTimeout(timer);
					resolve({
						ok: false,
						layer: "tcp",
						detail: err.message,
						latencyMs: Date.now() - start,
					});
				});
			}),
	};
}

function createDefaultTls(): GitHubReachabilityDeps["tls"] {
	return {
		get: (url, timeoutMs) =>
			new Promise<ProbeResult>((resolve) => {
				const start = Date.now();
				const timer = setTimeout(() => {
					req.destroy();
					resolve({ ok: false, layer: "tls", detail: "timeout", latencyMs: Date.now() - start });
				}, timeoutMs);

				const req = https.get(
					url,
					{
						headers: {
							"User-Agent": "claudekit-cli-doctor/1.0",
						},
					},
					(res) => {
						// Drain body to avoid socket hang
						res.resume();
						clearTimeout(timer);
						const status = res.statusCode ?? 0;
						const latencyMs = Date.now() - start;
						if (status === 200) {
							resolve({ ok: true, layer: "tls", detail: `HTTP ${status}`, latencyMs });
						} else {
							resolve({ ok: false, layer: "tls", detail: `HTTP ${status}`, latencyMs });
						}
					},
				);

				req.on("error", (err) => {
					clearTimeout(timer);
					resolve({
						ok: false,
						layer: "tls",
						detail: err.message,
						latencyMs: Date.now() - start,
					});
				});
			}),
	};
}

function createDefaultAuth(): GitHubReachabilityDeps["auth"] {
	return {
		checkKitAccess: async () => {
			const start = Date.now();
			// Dynamically import to avoid loading Octokit when running in test with fake deps
			const { getAuthenticatedClient } = await import("@/domains/github/client/index.js");

			// Use the first available kit as the probe target
			const kitEntries = Object.values(AVAILABLE_KITS);
			if (kitEntries.length === 0) {
				return {
					ok: false,
					layer: "auth" as const,
					detail: "No kit configured",
					latencyMs: Date.now() - start,
				};
			}
			const kit = kitEntries[0];

			try {
				const client = await getAuthenticatedClient();
				await client.repos.get({ owner: kit.owner, repo: kit.repo });
				return {
					ok: true,
					layer: "auth" as const,
					detail: "200 OK",
					latencyMs: Date.now() - start,
				};
			} catch (err: unknown) {
				const latencyMs = Date.now() - start;
				const status = (err as { status?: number })?.status;
				const message = err instanceof Error ? err.message : String(err);

				if (status === 401) {
					return {
						ok: false,
						layer: "auth" as const,
						detail: `401 Unauthorized — token invalid or missing. ${message}`,
						latencyMs,
					};
				}
				if (status === 404) {
					return {
						ok: false,
						layer: "auth" as const,
						detail: `404 — no repository access (invitation pending). ${message}`,
						latencyMs,
					};
				}
				return {
					ok: false,
					layer: "auth" as const,
					detail: `${status ?? "?"} — ${message}`,
					latencyMs,
				};
			}
		},
	};
}

// ---------------------------------------------------------------------------
// Core probe function (pure except for injected deps)
// ---------------------------------------------------------------------------

/**
 * Run the four-layer probe chain.
 * Stops at the first failing layer; each layer's result is included up to
 * the failure point.
 */
export async function checkGitHubReachability(
	deps: GitHubReachabilityDeps,
): Promise<ReachabilityResult> {
	// ── Layer 1: DNS ──────────────────────────────────────────────────────────
	const dnsStart = Date.now();
	let dnsResult: ProbeResult;
	try {
		const [r4, r6] = await Promise.allSettled([
			raceTimeout(deps.dns.resolve4(API_HOST), DNS_TIMEOUT_MS),
			raceTimeout(deps.dns.resolve6(API_HOST), DNS_TIMEOUT_MS),
		]);
		const ok = r4.status === "fulfilled" || r6.status === "fulfilled";
		let detail: string;
		if (ok) {
			if (r4.status === "fulfilled") {
				detail = `resolved: ${r4.value[0]}`;
			} else if (r6.status === "fulfilled") {
				detail = `resolved (IPv6): ${r6.value[0]}`;
			} else {
				detail = "resolved";
			}
		} else {
			detail = "NXDOMAIN / timeout";
		}
		dnsResult = { ok, layer: "dns", detail, latencyMs: Date.now() - dnsStart };
	} catch {
		dnsResult = {
			ok: false,
			layer: "dns",
			detail: "DNS resolution failed",
			latencyMs: Date.now() - dnsStart,
		};
	}

	if (!dnsResult.ok) {
		return { ok: false, failedLayer: "dns", layers: { dns: dnsResult } };
	}

	// ── Layer 2: TCP ──────────────────────────────────────────────────────────
	const tcpResult = await deps.tcp.connect({
		host: API_HOST,
		port: 443,
		timeoutMs: TCP_TIMEOUT_MS,
	});

	if (!tcpResult.ok) {
		return { ok: false, failedLayer: "tcp", layers: { dns: dnsResult, tcp: tcpResult } };
	}

	// ── Layer 3: TLS + unauthenticated GET /zen ───────────────────────────────
	const tlsResult = await deps.tls.get(ZEN_URL, TLS_TIMEOUT_MS);

	if (!tlsResult.ok) {
		return {
			ok: false,
			failedLayer: "tls",
			layers: { dns: dnsResult, tcp: tcpResult, tls: tlsResult },
		};
	}

	// ── Layer 4: Authenticated repos.get ─────────────────────────────────────
	const authResult = await deps.auth.checkKitAccess();

	if (!authResult.ok) {
		return {
			ok: false,
			failedLayer: "auth",
			layers: { dns: dnsResult, tcp: tcpResult, tls: tlsResult, auth: authResult },
		};
	}

	return {
		ok: true,
		layers: { dns: dnsResult, tcp: tcpResult, tls: tlsResult, auth: authResult },
	};
}

/** Race a promise against a timeout reject */
function raceTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
		promise.then(
			(v) => {
				clearTimeout(timer);
				resolve(v);
			},
			(e) => {
				clearTimeout(timer);
				reject(e);
			},
		);
	});
}

// ---------------------------------------------------------------------------
// Checker class — conforms to health-check Checker interface
// ---------------------------------------------------------------------------

export interface GitHubReachabilityCheckerOptions {
	/** Override deps for testing. Production uses default real implementations. */
	deps?: GitHubReachabilityDeps;
}

export class GitHubReachabilityChecker implements Checker {
	readonly group = "network" as const;
	private deps: GitHubReachabilityDeps;

	constructor(options: GitHubReachabilityCheckerOptions = {}) {
		this.deps = options.deps ?? {
			dns: createDefaultDns(),
			tcp: createDefaultTcp(),
			tls: createDefaultTls(),
			auth: createDefaultAuth(),
		};
	}

	async run(): Promise<CheckResult[]> {
		logger.verbose("GitHubReachabilityChecker: running layered probe");

		let result: ReachabilityResult;
		try {
			result = await raceTimeout(
				checkGitHubReachability(this.deps),
				AUTH_TIMEOUT_MS + TLS_TIMEOUT_MS + TCP_TIMEOUT_MS + DNS_TIMEOUT_MS + 500,
			);
		} catch (err) {
			return [
				{
					id: "github-reachability",
					name: "GitHub Reachability",
					group: "network",
					priority: "standard",
					status: "fail",
					message: "Probe timed out",
					details: err instanceof Error ? err.message : String(err),
					suggestion: "Check internet connection and proxy settings",
					autoFixable: false,
				},
			];
		}

		logger.verbose("GitHubReachabilityChecker: probe complete", { result });
		return [buildCheckResult(result)];
	}
}

// ---------------------------------------------------------------------------
// CheckResult builder
// ---------------------------------------------------------------------------

function buildCheckResult(result: ReachabilityResult): CheckResult {
	if (result.ok) {
		const { dns, tcp, tls, auth } = result.layers;
		const details = [
			`DNS: ${dns.latencyMs}ms`,
			tcp ? `TCP: ${tcp.latencyMs}ms` : null,
			tls ? `TLS/GET: ${tls.latencyMs}ms` : null,
			auth ? `Auth: ${auth.latencyMs}ms` : null,
		]
			.filter(Boolean)
			.join(", ");

		return {
			id: "github-reachability",
			name: "GitHub Reachability",
			group: "network",
			priority: "standard",
			status: "pass",
			message: "All layers reachable",
			details,
			autoFixable: false,
		};
	}

	const { failedLayer, layers } = result;
	const failedProbe = layers[failedLayer as keyof typeof layers];
	const detail = failedProbe?.detail ?? "unknown";

	const suggestions: Record<string, string> = {
		dns: "DNS resolution failed — check /etc/resolv.conf or system DNS settings",
		tcp: "TCP connect to api.github.com:443 failed — check firewall or proxy blocking port 443",
		tls: "HTTPS GET /zen returned unexpected status — possible TLS interception or GitHub outage. Check https://githubstatus.com",
		auth: detail.includes("401")
			? "GitHub token invalid or missing — run: gh auth login"
			: "No repository access — check GitHub invitation email or purchase at https://claudekit.cc",
	};

	return {
		id: "github-reachability",
		name: "GitHub Reachability",
		group: "network",
		priority: "standard",
		status: "fail",
		message: `GitHub unreachable at ${failedLayer?.toUpperCase()} layer`,
		details: detail,
		suggestion: suggestions[failedLayer ?? ""] ?? "Run: ck doctor for full diagnostics",
		autoFixable: false,
	};
}
