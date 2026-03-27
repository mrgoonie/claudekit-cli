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
 * @param cwd — directory to check for repo (defaults to process.cwd())
 */
export async function validateSetup(cwd?: string): Promise<SetupResult> {
	const workDir = cwd ?? process.cwd();

	// 1. Check gh CLI is installed
	const ghVersion = spawnSync("gh", ["--version"], { encoding: "utf-8", timeout: 10000 });
	if (ghVersion.status !== 0) {
		throw new Error(
			"GitHub CLI (gh) is not installed or not on PATH.\nInstall it: https://cli.github.com/",
		);
	}

	// 2. Check gh is authenticated
	const ghAuth = spawnSync("gh", ["auth", "status"], { encoding: "utf-8", timeout: 10000 });
	if (ghAuth.status !== 0) {
		throw new Error("GitHub CLI is not authenticated.\nRun: gh auth login");
	}

	// 3. Detect repo owner and name (run in the specified directory)
	const ghRepo = spawnSync("gh", ["repo", "view", "--json", "owner,name"], {
		encoding: "utf-8",
		timeout: 10000,
		cwd: workDir,
	});
	if (ghRepo.status !== 0) {
		throw new Error(
			`Not in a GitHub repository or repo not found in ${workDir}.\nRun this command from a directory with a GitHub remote.`,
		);
	}

	let repoOwner: string;
	let repoName: string;
	try {
		const repoData = JSON.parse(ghRepo.stdout) as { owner: { login: string }; name: string };
		repoOwner = repoData.owner.login;
		repoName = repoData.name;
	} catch {
		throw new Error(`Failed to parse repository info: ${ghRepo.stdout}`);
	}

	// 4. Check CK Engineer skills are available
	const skillsPath = join(homedir(), ".claude", "skills");
	const skillsAvailable = existsSync(skillsPath);

	if (!skillsAvailable) {
		logger.warning(`ClaudeKit Engineer skills not found at ${skillsPath}`);
	}

	return {
		repoOwner,
		repoName,
		skillsAvailable,
		skillsPath: skillsAvailable ? skillsPath : null,
	};
}
