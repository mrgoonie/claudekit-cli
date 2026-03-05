/**
 * Repo scanner — discovers git repositories in subdirectories
 * Used by multi-repo watch mode when CWD is not itself a git repo
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "@/shared/logger.js";

export interface ScannedRepo {
	dir: string;
	owner: string;
	name: string;
}

/**
 * Scan immediate subdirectories for git repositories
 * Returns repos with owner/name from `gh repo view`
 * Skips dirs without .git or without a GitHub remote
 */
export async function scanForRepos(parentDir: string): Promise<ScannedRepo[]> {
	const repos: ScannedRepo[] = [];
	const entries = await readdir(parentDir);

	for (const entry of entries) {
		if (entry.startsWith(".")) continue;
		const fullPath = join(parentDir, entry);
		const entryStat = await stat(fullPath);
		if (!entryStat.isDirectory()) continue;

		const gitDir = join(fullPath, ".git");
		if (!existsSync(gitDir)) continue;

		const result = spawnSync("gh", ["repo", "view", "--json", "owner,name"], {
			encoding: "utf-8",
			timeout: 10000,
			cwd: fullPath,
		});

		if (result.status !== 0) {
			logger.warning(`Skipping ${entry}: not a GitHub repo or no remote`);
			continue;
		}

		try {
			const data = JSON.parse(result.stdout) as { owner: { login: string }; name: string };
			repos.push({ dir: fullPath, owner: data.owner.login, name: data.name });
		} catch {
			logger.warning(`Skipping ${entry}: failed to parse repo info`);
		}
	}

	return repos;
}
