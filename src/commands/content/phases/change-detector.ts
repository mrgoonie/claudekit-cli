/**
 * Detect git changes (commits, merged PRs, tags, completed plans) since a given ISO timestamp.
 * Each detector is independent and fails gracefully — missing tools return empty arrays.
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { isNoiseCommit } from "./noise-filter.js";
import type { RepoInfo } from "./repo-discoverer.js";

export interface RawGitEvent {
	repoPath: string;
	repoName: string;
	eventType: "commit" | "pr_merged" | "plan_completed" | "tag" | "release";
	ref: string;
	title: string;
	body: string;
	author: string;
	createdAt: string;
}

// ---------------------------------------------------------------------------
// Commit detection
// ---------------------------------------------------------------------------

/**
 * Detect non-merge commits on the default branch since `since` (ISO string).
 * Caps at 50 results and filters noise commits.
 */
export function detectCommits(repo: RepoInfo, since: string): RawGitEvent[] {
	try {
		execSync(`git -C "${repo.path}" fetch origin ${repo.defaultBranch} --quiet`, {
			stdio: "pipe",
			timeout: 10000,
		});

		const output = execSync(
			`git -C "${repo.path}" log origin/${repo.defaultBranch} --since="${since}" --format="%H%x00%s%x00%an%x00%aI" --no-merges`,
			{ stdio: "pipe", timeout: 10000 },
		)
			.toString()
			.trim();

		if (!output) return [];

		return output
			.split("\n")
			.slice(0, 50)
			.map((line) => {
				const [hash, subject, author, date] = line.split("\0");
				return {
					repoPath: repo.path,
					repoName: repo.name,
					eventType: "commit" as const,
					ref: hash ?? "",
					title: subject ?? "",
					body: "",
					author: author ?? "",
					createdAt: date ?? new Date().toISOString(),
				};
			})
			.filter((e) => !isNoiseCommit(e.title, e.author));
	} catch (err) {
		// Log to stderr for debugging; caller won't see unless --verbose
		const msg = err instanceof Error ? err.message : String(err);
		process.stderr.write(`[content] detectCommits(${repo.name}): ${msg}\n`);
		return [];
	}
}

// ---------------------------------------------------------------------------
// Pull request detection (requires gh CLI)
// ---------------------------------------------------------------------------

interface GhPrRow {
	number: number;
	title: string;
	body: string;
	author: { login: string };
	mergedAt: string;
}

/**
 * Detect merged PRs via the `gh` CLI since `since` (ISO string).
 * Returns empty array when gh is unavailable or repo has no GitHub remote.
 */
export function detectMergedPRs(repo: RepoInfo, since: string): RawGitEvent[] {
	try {
		const match = repo.remoteUrl.match(/github\.com[/:](.+?)\/(.+?)(?:\.git)?$/);
		if (!match) return [];
		const [, owner, repoName] = match;

		const output = execSync(
			`gh pr list --repo ${owner}/${repoName} --state merged --json number,title,body,author,mergedAt --limit 20`,
			{ stdio: "pipe", timeout: 15000 },
		)
			.toString()
			.trim();

		if (!output) return [];
		const prs = JSON.parse(output) as GhPrRow[];

		return prs
			.filter((pr) => pr.mergedAt > since)
			.map((pr) => ({
				repoPath: repo.path,
				repoName: repo.name,
				eventType: "pr_merged" as const,
				ref: String(pr.number),
				title: pr.title,
				body: (pr.body || "").slice(0, 500),
				author: pr.author?.login ?? "",
				createdAt: pr.mergedAt,
			}));
	} catch {
		return [];
	}
}

// ---------------------------------------------------------------------------
// Tag detection
// ---------------------------------------------------------------------------

/** Detect new annotated/lightweight tags created after `since` (ISO string). */
export function detectTags(repo: RepoInfo, since: string): RawGitEvent[] {
	try {
		const output = execSync(
			`git -C "${repo.path}" tag --sort=-creatordate --format='%(refname:short)%00%(creatordate:iso-strict)%00%(subject)' 2>/dev/null | head -5`,
			{ stdio: "pipe", timeout: 5000, shell: "/bin/sh" },
		)
			.toString()
			.trim();

		if (!output) return [];

		return output
			.split("\n")
			.map((line) => {
				const [tag, date, subject] = line.split("\0");
				return {
					repoPath: repo.path,
					repoName: repo.name,
					eventType: "tag" as const,
					ref: tag ?? "",
					title: subject || tag || "",
					body: "",
					author: "",
					createdAt: date ?? "",
				};
			})
			.filter((e) => e.createdAt > since && e.ref !== "");
	} catch {
		return [];
	}
}

// ---------------------------------------------------------------------------
// Completed plan detection
// ---------------------------------------------------------------------------

/**
 * Detect plans with `status: completed` in their frontmatter.
 * Looks in `<repo>/plans/<plan-dir>/plan.md`.
 */
export function detectCompletedPlans(repo: RepoInfo, _since: string): RawGitEvent[] {
	const plansDir = join(repo.path, "plans");
	if (!existsSync(plansDir)) return [];

	const events: RawGitEvent[] = [];
	try {
		const entries = readdirSync(plansDir, { withFileTypes: true });
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			const planFile = join(plansDir, entry.name, "plan.md");
			if (!existsSync(planFile)) continue;

			try {
				const content = readFileSync(planFile, "utf-8");
				const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
				if (!frontmatterMatch) continue;
				if (!frontmatterMatch[1].includes("status: completed")) continue;

				events.push({
					repoPath: repo.path,
					repoName: repo.name,
					eventType: "plan_completed",
					ref: entry.name,
					title: `Plan completed: ${entry.name}`,
					body: "",
					author: "",
					createdAt: new Date().toISOString(),
				});
			} catch {
				// Skip unreadable plan files
			}
		}
	} catch {
		// Skip unreadable plans directory
	}

	return events;
}
