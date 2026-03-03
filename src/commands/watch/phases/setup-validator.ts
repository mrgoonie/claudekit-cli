/**
 * Setup validator — validates runtime prerequisites before starting the watch loop
 * Checks: gh CLI auth, repo detection, CK Engineer skills availability
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { logger } from "@/shared/logger.js";

export interface SetupResult {
	repoOwner: string;
	repoName: string;
	skillsAvailable: boolean;
	skillsPath: string | null;
}

/**
 * Validate all prerequisites for ck watch
 * Throws descriptive errors for each failure mode
 */
export async function validateSetup(): Promise<SetupResult> {
	// 1. Check gh CLI is installed
	const ghVersion = spawnSync("gh", ["--version"], { encoding: "utf-8", timeout: 10000 });
	if (ghVersion.status !== 0) {
		throw new Error(
			"GitHub CLI (gh) is not installed or not on PATH.\n" + "Install it: https://cli.github.com/",
		);
	}

	// 2. Check gh is authenticated
	const ghAuth = spawnSync("gh", ["auth", "status"], { encoding: "utf-8", timeout: 10000 });
	if (ghAuth.status !== 0) {
		throw new Error("GitHub CLI is not authenticated.\n" + "Run: gh auth login");
	}

	// 3. Detect repo owner and name
	const ghRepo = spawnSync("gh", ["repo", "view", "--json", "owner,name"], {
		encoding: "utf-8",
		timeout: 10000,
	});
	if (ghRepo.status !== 0) {
		throw new Error(
			"Not in a GitHub repository or repo not found.\n" +
				"Run this command from a directory with a GitHub remote.",
		);
	}

	let repoOwner: string;
	let repoName: string;
	try {
		const repoData = JSON.parse(ghRepo.stdout) as { owner: { login: string }; name: string };
		repoOwner = repoData.owner.login;
		repoName = repoData.name;
	} catch {
		throw new Error("Failed to parse repository information from gh CLI");
	}

	// 4. Check CK Engineer skills availability (brainstorm skill)
	const { available, path } = findBrainstormSkill();
	if (!available) {
		logger.warning(
			"CK Engineer skills not found. Using fallback prompts.\n" +
				"  Install: ck init --kit engineer -g",
		);
	}

	return {
		repoOwner,
		repoName,
		skillsAvailable: available,
		skillsPath: path,
	};
}

/**
 * Locate brainstorm skill in local or global paths
 */
function findBrainstormSkill(): { available: boolean; path: string | null } {
	const localPath = join(process.cwd(), ".claude", "skills", "brainstorm", "SKILL.md");
	if (existsSync(localPath)) {
		return { available: true, path: localPath };
	}

	const globalPath = join(homedir(), ".claude", "skills", "brainstorm", "SKILL.md");
	if (existsSync(globalPath)) {
		return { available: true, path: globalPath };
	}

	return { available: false, path: null };
}
