/**
 * Discover git repositories 1 level deep from a given working directory.
 * Returns metadata needed by the change-detector to run git commands.
 */

import { execSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

export interface RepoInfo {
	path: string;
	name: string;
	remoteUrl: string;
	defaultBranch: string;
}

/**
 * Discover git repos: CWD itself + immediate subdirectories.
 * Skips hidden directories (dot-prefixed names).
 */
export function discoverRepos(cwd: string): RepoInfo[] {
	const repos: RepoInfo[] = [];

	// Check if CWD itself is a git repo
	if (isGitRepoRoot(cwd)) {
		const info = getRepoInfo(cwd);
		if (info) repos.push(info);
	}

	// Scan 1 level deep
	try {
		const entries = readdirSync(cwd, { withFileTypes: true });
		for (const entry of entries) {
			if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
			const dirPath = join(cwd, entry.name);
			if (isGitRepoRoot(dirPath)) {
				const info = getRepoInfo(dirPath);
				if (info) repos.push(info);
			}
		}
	} catch {
		// CWD read error — return what we have
	}

	return repos;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check if dir is the root of a git repo (not just a subdirectory inside one). */
function isGitRepoRoot(dir: string): boolean {
	try {
		const toplevel = execSync("git rev-parse --show-toplevel", {
			cwd: dir,
			stdio: "pipe",
			timeout: 5000,
		})
			.toString()
			.trim();
		// Only true when dir IS the repo root, not a subdirectory
		return toplevel === dir;
	} catch {
		return false;
	}
}

function getRepoInfo(dir: string): RepoInfo | null {
	try {
		const name = dir.split("/").pop() || dir;

		let remoteUrl = "";
		try {
			remoteUrl = execSync("git remote get-url origin", {
				cwd: dir,
				stdio: "pipe",
				timeout: 5000,
			})
				.toString()
				.trim();
		} catch {
			// No remote — still usable for local scanning
		}

		let defaultBranch = "main";
		try {
			const ref = execSync("git symbolic-ref refs/remotes/origin/HEAD", {
				cwd: dir,
				stdio: "pipe",
				timeout: 5000,
			})
				.toString()
				.trim();
			defaultBranch = ref.replace("refs/remotes/origin/", "");
		} catch {
			// Fallback: try local HEAD branch name
			try {
				defaultBranch = execSync("git rev-parse --abbrev-ref HEAD", {
					cwd: dir,
					stdio: "pipe",
					timeout: 5000,
				})
					.toString()
					.trim();
			} catch {
				// Keep "main"
			}
		}

		return { path: dir, name, remoteUrl, defaultBranch };
	} catch {
		return null;
	}
}
