/**
 * Preflight checks for setup command
 * Validates system dependencies before configuration
 */

import { execSync } from "node:child_process";
import * as clack from "@clack/prompts";
import type { SetupContext } from "../types.js";

/**
 * Check if gh CLI is installed
 */
function isGhInstalled(): boolean {
	try {
		execSync("gh --version", { stdio: "pipe" });
		return true;
	} catch {
		return false;
	}
}

/**
 * Check if gh CLI is authenticated (assumes gh is installed)
 */
function checkGhAuth(): boolean {
	try {
		execSync("gh auth status", { stdio: "pipe" });
		return true;
	} catch {
		return false;
	}
}

/**
 * Check if Node.js is installed and version is acceptable
 */
function checkNodeVersion(): boolean {
	try {
		const version = process.version;
		const major = Number.parseInt(version.slice(1).split(".")[0], 10);
		return major >= 18;
	} catch {
		return false;
	}
}

/**
 * Check if Python is installed
 */
function checkPython(): boolean {
	try {
		execSync("python3 --version", { stdio: "pipe" });
		return true;
	} catch {
		try {
			execSync("python --version", { stdio: "pipe" });
			return true;
		} catch {
			return false;
		}
	}
}

/**
 * Run preflight system checks
 * Returns updated context with cancelled flag if critical checks fail
 */
export async function handlePreflightCheck(ctx: SetupContext): Promise<SetupContext> {
	clack.log.step("Running preflight checks...");

	let hasIssues = false;

	// Check gh CLI installed and authenticated
	if (!isGhInstalled()) {
		clack.log.warning(
			"GitHub CLI not installed. Install from https://cli.github.com/ then run 'gh auth login'.",
		);
		hasIssues = true;
	} else if (!checkGhAuth()) {
		clack.log.warning(
			"GitHub CLI not authenticated. Run 'gh auth login' to authenticate with GitHub.",
		);
		hasIssues = true;
	} else {
		clack.log.success("GitHub CLI: authenticated");
	}

	// Check Node.js
	if (!checkNodeVersion()) {
		clack.log.warning("Node.js 18+ required. Please upgrade Node.js.");
		hasIssues = true;
	} else {
		clack.log.success(`Node.js: ${process.version}`);
	}

	// Check Python (warning only, not critical)
	if (!checkPython()) {
		clack.log.info("Python not found. Some skills may require Python.");
	} else {
		clack.log.success("Python: installed");
	}

	if (hasIssues) {
		const proceed = await clack.confirm({
			message: "Some checks failed. Continue anyway?",
			initialValue: false,
		});

		if (clack.isCancel(proceed) || !proceed) {
			return { ...ctx, cancelled: true };
		}
	}

	return ctx;
}
