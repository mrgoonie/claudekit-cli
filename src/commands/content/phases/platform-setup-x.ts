/**
 * X (Twitter) platform setup wizard step.
 * Checks xurl CLI installation, verifies authentication, and captures API tier.
 */

import { execSync } from "node:child_process";
import * as p from "@clack/prompts";
import type { ContentLogger } from "./content-logger.js";

/**
 * Run the X/Twitter setup wizard.
 * Returns true if setup completed successfully, false if user cancelled or failed.
 */
export async function setupXPlatform(contentLogger: ContentLogger): Promise<boolean> {
	p.intro("X (Twitter) Setup");

	// Check xurl installed, auto-install if missing
	if (!isXurlInstalled()) {
		p.log.warning("xurl CLI not found. Attempting auto-install...");
		const installed = await autoInstallXurl(contentLogger);
		if (!installed) return false;
	}
	p.log.success("xurl CLI found.");

	// Check if already authenticated via `xurl auth status`
	if (isXurlAuthenticated()) {
		p.log.success("xurl credentials verified (oauth1/bearer).");
		return await captureApiTier(contentLogger);
	}

	// Prompt user to authenticate
	p.log.warning("xurl is not authenticated.");
	p.log.info("Run `xurl auth oauth1` in a separate terminal, then come back here.");

	const proceed = await p.confirm({ message: "Have you completed xurl auth?" });
	if (p.isCancel(proceed) || !proceed) {
		contentLogger.info("X setup cancelled by user");
		return false;
	}

	// Re-verify
	if (isXurlAuthenticated()) {
		p.log.success("xurl credentials verified.");
		return await captureApiTier(contentLogger);
	}

	p.log.error("X authentication still failed. Run `xurl auth status` to check.");
	contentLogger.error("X authentication verification failed after user confirmation");
	return false;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check if xurl is installed. */
function isXurlInstalled(): boolean {
	try {
		execSync("which xurl", { stdio: "pipe" });
		return true;
	} catch {
		return false;
	}
}

/**
 * Auto-install xurl (Go binary from github.com/xdevplatform/xurl).
 * Strategy: go install > GitHub release binary download.
 */
async function autoInstallXurl(contentLogger: ContentLogger): Promise<boolean> {
	// Try `go install` first (most reliable if Go is available)
	try {
		execSync("which go", { stdio: "pipe" });
		p.log.info("Installing xurl via `go install`...");
		execSync("go install github.com/xdevplatform/xurl@latest", {
			stdio: "inherit",
			timeout: 120000,
		});
		if (isXurlInstalled()) {
			contentLogger.info("xurl installed via go install");
			return true;
		}
	} catch {
		contentLogger.warn("go install failed or Go not available");
	}

	// Fallback: download pre-built binary from GitHub releases
	try {
		const { platform, arch } = process;
		const osMap: Record<string, string> = { darwin: "darwin", linux: "linux", win32: "windows" };
		const archMap: Record<string, string> = { arm64: "arm64", x64: "amd64" };
		const os = osMap[platform];
		const cpu = archMap[arch];
		if (os && cpu) {
			const ext = platform === "win32" ? ".exe" : "";
			const url = `https://github.com/xdevplatform/xurl/releases/latest/download/xurl_${os}_${cpu}${ext}`;
			const dest = platform === "win32" ? "xurl.exe" : "/usr/local/bin/xurl";
			p.log.info(`Downloading xurl binary for ${os}/${cpu}...`);
			execSync(`curl -fsSL "${url}" -o "${dest}" && chmod +x "${dest}"`, {
				stdio: "inherit",
				timeout: 60000,
			});
			if (isXurlInstalled()) {
				contentLogger.info("xurl installed from GitHub release");
				return true;
			}
		}
	} catch {
		// Download failed
	}

	p.log.error("Could not auto-install xurl.");
	p.log.info("Install manually:");
	p.log.info("  Go: go install github.com/xdevplatform/xurl@latest");
	p.log.info("  Binary: https://github.com/xdevplatform/xurl/releases");
	contentLogger.warn("xurl auto-install failed");
	return false;
}

/** Check if xurl has valid credentials (oauth1 or bearer). */
function isXurlAuthenticated(): boolean {
	try {
		const status = execSync("xurl auth status", { stdio: "pipe", timeout: 5000 }).toString();
		// Look for "oauth1: ✓" or "bearer: ✓" in output
		return status.includes("oauth1: ✓") || status.includes("bearer: ✓");
	} catch {
		return false;
	}
}

/** Prompt for API tier and log the resulting post limit. Returns true always (non-cancellable step). */
async function captureApiTier(contentLogger: ContentLogger): Promise<boolean> {
	const tier = await p.select({
		message: "Which X API tier are you on?",
		options: [
			{ value: "free", label: "Free", hint: "1,500 posts/month" },
			{ value: "basic", label: "Basic", hint: "3,000 posts/month" },
			{ value: "pro", label: "Pro", hint: "300,000 posts/month" },
		],
	});
	if (p.isCancel(tier)) return false;

	const maxPerDay = tier === "free" ? 3 : tier === "basic" ? 5 : 20;
	p.log.info(`Max posts per day set to ${maxPerDay} based on ${String(tier)} tier.`);
	contentLogger.info(`X platform configured — tier: ${String(tier)}, maxPerDay: ${maxPerDay}`);
	return true;
}
