/**
 * System API routes - health dashboard, update checks, environment info
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CliVersionChecker, VersionChecker } from "@/domains/versioning/version-checker.js";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
import type { Express, Request, Response } from "express";

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

export function registerSystemRoutes(app: Express): void {
	// GET /api/system/check-updates?target=cli|kit&kit=engineer
	app.get("/api/system/check-updates", async (req: Request, res: Response) => {
		const { target, kit } = req.query;

		if (!target || (target !== "cli" && target !== "kit")) {
			res.status(400).json({ error: "Missing or invalid target param (cli|kit)" });
			return;
		}

		try {
			if (target === "cli") {
				const packageJson = await getPackageJson();
				const currentVersion = packageJson?.version ?? "0.0.0";
				const result = await CliVersionChecker.check(currentVersion);

				const response: UpdateCheckResponse = {
					current: currentVersion,
					latest: result?.latestVersion ?? null,
					updateAvailable: result?.updateAvailable ?? false,
					releaseUrl: result?.updateAvailable
						? "https://www.npmjs.com/package/claudekit"
						: undefined,
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
}

async function getPackageJson(): Promise<{ version: string } | null> {
	try {
		const content = await readFile(join(process.cwd(), "package.json"), "utf-8");
		return JSON.parse(content);
	} catch {
		return null;
	}
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
