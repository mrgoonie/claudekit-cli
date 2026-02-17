import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildInitCommand, isBetaVersion } from "@/commands/update-cli.js";
import { GitHubClient } from "@/domains/github/github-client.js";
import { NpmRegistryClient } from "@/domains/github/npm-registry.js";
import { PackageManagerDetector } from "@/domains/installation/package-manager-detector.js";
import { VersionChecker } from "@/domains/versioning/version-checker.js";
import {
	CLAUDEKIT_CLI_NPM_PACKAGE_NAME,
	CLAUDEKIT_CLI_NPM_PACKAGE_URL,
} from "@/shared/claudekit-constants.js";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
import type { KitType } from "@/types/index.js";
import { AVAILABLE_KITS } from "@/types/kit.js";
/**
 * System API routes - health dashboard, update checks, environment info
 */
import type { Express, Request, Response } from "express";
import packageInfo from "../../../../package.json" assert { type: "json" };

interface UpdateCheckResponse {
	current: string;
	latest: string | null;
	updateAvailable: boolean;
	releaseUrl?: string;
	error?: string;
}

interface SystemInfoResponse {
	configPath: string;
	nodeVersion: string;
	bunVersion: string | null;
	os: string;
	cliVersion: string;
}

interface VersionInfo {
	version: string;
	publishedAt: string;
	isPrerelease: boolean;
}

interface VersionsResponse {
	versions: VersionInfo[];
	cached: boolean;
}

// Version cache: Map<key, {data, expires}>
const versionCache = new Map<string, { data: VersionInfo[]; expires: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function registerSystemRoutes(app: Express): void {
	// GET /api/system/check-updates?target=cli|kit&kit=engineer&channel=stable|beta
	app.get("/api/system/check-updates", async (req: Request, res: Response) => {
		const { target, kit, channel = "stable" } = req.query;

		if (!target || (target !== "cli" && target !== "kit")) {
			res.status(400).json({ error: "Missing or invalid target param (cli|kit)" });
			return;
		}

		try {
			if (target === "cli") {
				const packageJson = await getPackageJson();
				const currentVersion = packageJson?.version ?? "0.0.0";

				// Use beta/dev version for beta channel
				let latestVersion: string | null = null;
				if (channel === "beta") {
					latestVersion = await NpmRegistryClient.getDevVersion(CLAUDEKIT_CLI_NPM_PACKAGE_NAME);
				} else {
					latestVersion = await NpmRegistryClient.getLatestVersion(CLAUDEKIT_CLI_NPM_PACKAGE_NAME);
				}

				const updateAvailable = latestVersion ? latestVersion !== currentVersion : false;

				const response: UpdateCheckResponse = {
					current: currentVersion,
					latest: latestVersion,
					updateAvailable,
					releaseUrl: updateAvailable ? CLAUDEKIT_CLI_NPM_PACKAGE_URL : undefined,
				};
				res.json(response);
			} else {
				// Kit update check
				const kitName = (kit as string) ?? "engineer";
				const metadata = await getKitMetadata(kitName);
				const currentVersion = metadata?.version ?? "0.0.0";
				const result = await VersionChecker.check(currentVersion);

				const response: UpdateCheckResponse = {
					current: currentVersion,
					latest: result?.latestVersion ?? null,
					updateAvailable: result?.updateAvailable ?? false,
					releaseUrl: result?.updateAvailable
						? `https://github.com/anthropics/claudekit-${kitName}/releases`
						: undefined,
				};
				res.json(response);
			}
		} catch (error) {
			logger.error(`Update check failed: ${error}`);
			res.json({
				current: "unknown",
				latest: null,
				updateAvailable: false,
				error: "Failed to check for updates",
			} satisfies UpdateCheckResponse);
		}
	});

	// GET /api/system/versions?target=cli|kit&kit=engineer - List available versions
	app.get("/api/system/versions", async (req: Request, res: Response) => {
		const { target, kit } = req.query;

		if (!target || (target !== "cli" && target !== "kit")) {
			res.status(400).json({ error: "Missing or invalid target param (cli|kit)" });
			return;
		}

		try {
			const cacheKey = target === "cli" ? "cli" : `kit-${kit}`;
			const cached = versionCache.get(cacheKey);

			// Return cached data if valid
			if (cached && Date.now() < cached.expires) {
				const response: VersionsResponse = { versions: cached.data, cached: true };
				res.json(response);
				return;
			}

			let versions: VersionInfo[] = [];

			if (target === "cli") {
				// Fetch from npm registry
				const packageInfo = await NpmRegistryClient.getPackageInfo(CLAUDEKIT_CLI_NPM_PACKAGE_NAME);
				if (packageInfo) {
					const allVersions = Object.keys(packageInfo.versions);
					const latestStable = packageInfo["dist-tags"]?.latest;

					// Sort by publish time descending
					allVersions.sort((a, b) => {
						const timeA = packageInfo.time?.[a] ? new Date(packageInfo.time[a]).getTime() : 0;
						const timeB = packageInfo.time?.[b] ? new Date(packageInfo.time[b]).getTime() : 0;
						return timeB - timeA;
					});

					// Take max 20 most recent
					versions = allVersions.slice(0, 20).map((ver) => ({
						version: ver,
						publishedAt: packageInfo.time?.[ver] || "",
						isPrerelease: ver !== latestStable && ver.includes("-"),
					}));
				}
			} else {
				// Fetch from GitHub releases
				const kitName = (kit as string) ?? "engineer";
				const kitConfig = AVAILABLE_KITS[kitName as KitType];
				if (kitConfig) {
					const githubClient = new GitHubClient();
					const releases = await githubClient.listReleases(kitConfig, 20);

					versions = releases.map((release) => ({
						version: release.tag_name.replace(/^v/, ""),
						publishedAt: release.published_at ?? "",
						isPrerelease: release.prerelease,
					}));
				}
			}

			// Cache the result
			versionCache.set(cacheKey, { data: versions, expires: Date.now() + CACHE_TTL_MS });

			const response: VersionsResponse = { versions, cached: false };
			res.json(response);
		} catch (error) {
			logger.error(`Versions fetch failed: ${error}`);
			res.status(500).json({ error: "Failed to fetch versions" });
		}
	});

	// GET /api/system/info - environment info for System tab
	app.get("/api/system/info", async (_req: Request, res: Response) => {
		try {
			const packageJson = await getPackageJson();
			const response: SystemInfoResponse = {
				configPath: PathResolver.getGlobalKitDir(),
				nodeVersion: process.version,
				bunVersion: typeof Bun !== "undefined" ? Bun.version : null,
				os: `${process.platform} ${process.arch}`,
				cliVersion: packageJson?.version ?? "unknown",
			};
			res.json(response);
		} catch (error) {
			logger.error(`Failed to get system info: ${error}`);
			res.status(500).json({ error: "Failed to get system info" });
		}
	});

	// POST /api/system/update?target=cli|kit&kit=engineer&version=x.x.x - SSE update stream
	app.post("/api/system/update", async (req: Request, res: Response) => {
		const { target, kit, version } = req.query;

		if (!target || (target !== "cli" && target !== "kit")) {
			res.status(400).json({ error: "Missing or invalid target param (cli|kit)" });
			return;
		}

		if (target === "kit" && !kit) {
			res.status(400).json({ error: "Missing kit param for kit update" });
			return;
		}

		// Set SSE headers
		res.setHeader("Content-Type", "text/event-stream");
		res.setHeader("Cache-Control", "no-cache");
		res.setHeader("Connection", "keep-alive");
		res.flushHeaders();

		// Send start event
		res.write(`data: ${JSON.stringify({ type: "start", message: "Starting update..." })}\n\n`);

		// Determine command using PackageManagerDetector (same as CLI)
		let command: string;
		let args: string[];

		if (target === "cli") {
			// Use detected package manager like CLI does
			const pm = await PackageManagerDetector.detect();
			const targetVersion = (version as string) || "latest";
			const fullCmd = PackageManagerDetector.getUpdateCommand(
				pm,
				CLAUDEKIT_CLI_NPM_PACKAGE_NAME,
				targetVersion,
			);
			// Parse command and args from the full command string
			const parts = fullCmd.split(" ");
			command = parts[0];
			args = parts.slice(1);
			res.write(`data: ${JSON.stringify({ type: "phase", name: "downloading" })}\n\n`);
			logger.debug(`CLI update using ${pm}: ${fullCmd}`);
		} else {
			// Get kit metadata to detect beta channel
			const kitName = kit as KitType;
			const metadata = await getKitMetadata(kitName);
			const isBeta = isBetaVersion(metadata?.version);

			// Use shared buildInitCommand for parity with CLI
			// Note: Dashboard manages global config, so always use global=true
			const initCmd = buildInitCommand(true, kitName, isBeta);
			const parts = initCmd.split(" ");
			command = parts[0];
			args = parts.slice(1);

			logger.debug(`Updating kit ${kitName} (beta: ${isBeta}): ${initCmd}`);
			res.write(`data: ${JSON.stringify({ type: "phase", name: "installing" })}\n\n`);
		}

		logger.debug(`Spawning update command: ${command} ${args.join(" ")}`);

		const childProcess = spawn(command, args, {
			shell: true,
			env: { ...process.env },
		});

		// Stream stdout
		childProcess.stdout?.on("data", (data: Buffer) => {
			const text = data.toString();
			res.write(`data: ${JSON.stringify({ type: "output", stream: "stdout", text })}\n\n`);
		});

		// Stream stderr
		childProcess.stderr?.on("data", (data: Buffer) => {
			const text = data.toString();
			res.write(`data: ${JSON.stringify({ type: "output", stream: "stderr", text })}\n\n`);
		});

		// Handle process completion
		childProcess.on("close", (code: number | null) => {
			if (code === 0) {
				res.write(`data: ${JSON.stringify({ type: "phase", name: "complete" })}\n\n`);
				res.write(`data: ${JSON.stringify({ type: "complete", code: 0 })}\n\n`);
			} else {
				res.write(
					`data: ${JSON.stringify({ type: "error", code: code ?? 1, message: `Process exited with code ${code}` })}\n\n`,
				);
			}
			res.end();
		});

		// Handle process errors
		childProcess.on("error", (error: Error) => {
			logger.error(`Update command error: ${error.message}`);
			res.write(`data: ${JSON.stringify({ type: "error", code: 1, message: error.message })}\n\n`);
			res.end();
		});

		// Kill child process on client disconnect
		req.on("close", () => {
			if (!childProcess.killed) {
				logger.debug("Client disconnected, killing update process");
				childProcess.kill();
			}
		});

		// Heartbeat to prevent proxy timeout (every 30s)
		const heartbeat = setInterval(() => {
			res.write(": heartbeat\n\n");
		}, 30000);

		// Clear heartbeat on response end
		res.on("close", () => {
			clearInterval(heartbeat);
		});
	});
}

async function getPackageJson(): Promise<{ version: string } | null> {
	if (typeof packageInfo?.version === "string" && packageInfo.version.trim()) {
		return { version: packageInfo.version.trim() };
	}

	const envVersion = process.env.npm_package_version?.trim();
	if (envVersion) {
		return { version: envVersion };
	}

	return null;
}

async function getKitMetadata(kitName: string): Promise<{ version: string } | null> {
	try {
		const metadataPath = join(PathResolver.getGlobalKitDir(), "metadata.json");
		if (!existsSync(metadataPath)) return null;
		const content = await readFile(metadataPath, "utf-8");
		const metadata = JSON.parse(content);
		// Multi-kit format
		if (metadata.kits?.[kitName]) {
			return { version: metadata.kits[kitName].version };
		}
		// Legacy format
		if (metadata.version) {
			return { version: metadata.version };
		}
		return null;
	} catch {
		return null;
	}
}
