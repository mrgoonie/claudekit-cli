/**
 * Interactive Auth Prompt
 *
 * Shows authentication options when no auth is detected.
 * Allows users to choose their preferred method.
 */

import { GitCloneManager } from "@/domains/installation/git-clone-manager.js";
import * as p from "@clack/prompts";
import picocolors from "picocolors";
import { AuthManager } from "./github-auth.js";

export interface AuthPromptResult {
	method: "git" | "token" | "gh-cli" | "cancel";
	/** If method is "token", this contains the entered token */
	token?: string;
}

/**
 * Show interactive auth selection prompt
 * Called when no authentication is detected
 */
export async function promptForAuth(): Promise<AuthPromptResult> {
	// Detect available options
	const hasGit = GitCloneManager.isGitInstalled();
	const hasSshKeys = hasGit && GitCloneManager.hasSshKeys();
	const hasGhCli = AuthManager.isGhCliInstalled();

	p.intro(picocolors.yellow("No GitHub authentication found"));

	// Build options based on what's available
	const options: { value: string; label: string; hint?: string }[] = [];

	if (hasGit) {
		const hint = hasSshKeys ? "SSH keys detected" : "Will use HTTPS";
		options.push({
			value: "git",
			label: "Use git clone (--use-git)",
			hint: `${hint} - recommended for security`,
		});
	}

	options.push({
		value: "token",
		label: "Enter GitHub token (GITHUB_TOKEN)",
		hint: "Classic PAT with 'repo' scope",
	});

	if (hasGhCli) {
		options.push({
			value: "gh-cli",
			label: "Use GitHub CLI (gh auth login)",
			hint: "Run 'gh auth login' first",
		});
	} else {
		options.push({
			value: "gh-cli",
			label: "Install GitHub CLI",
			hint: "brew install gh / winget install GitHub.cli",
		});
	}

	const selection = await p.select({
		message: "Choose authentication method:",
		options,
	});

	if (p.isCancel(selection)) {
		return { method: "cancel" };
	}

	// Handle token input
	if (selection === "token") {
		const token = await p.text({
			message: "Enter your GitHub Personal Access Token:",
			placeholder: "ghp_xxxxxxxxxxxxxxxxxxxx",
			validate: (value) => {
				if (!value || value.trim().length < 10) {
					return "Token is too short";
				}
				if (!value.startsWith("ghp_") && !value.startsWith("github_pat_")) {
					return "Token should start with 'ghp_' (Classic) or 'github_pat_' (Fine-grained)";
				}
				return undefined;
			},
		});

		if (p.isCancel(token)) {
			return { method: "cancel" };
		}

		// Show note about fine-grained PAT limitation
		if (typeof token === "string" && token.startsWith("github_pat_")) {
			p.note(
				picocolors.yellow(
					"⚠️  Fine-grained PATs cannot access repos where you're a collaborator.\n" +
						"   If you encounter access issues, use a Classic PAT instead.",
				),
			);
		}

		return { method: "token", token: token as string };
	}

	return { method: selection as "git" | "gh-cli" };
}

/**
 * Show auth options info (non-interactive)
 */
export function showAuthOptions(): void {
	const hasGit = GitCloneManager.isGitInstalled();
	const hasSshKeys = hasGit && GitCloneManager.hasSshKeys();

	console.log(picocolors.yellow("\nAuthentication Options:\n"));

	if (hasGit) {
		const sshStatus = hasSshKeys ? picocolors.green("✓ SSH keys detected") : "HTTPS mode";
		console.log(`  ${picocolors.cyan("--use-git")}     Use git clone (${sshStatus})`);
	}

	console.log(`  ${picocolors.cyan("GITHUB_TOKEN")}  Set environment variable with Classic PAT`);
	console.log(`  ${picocolors.cyan("gh auth login")} Install GitHub CLI and authenticate\n`);
}
