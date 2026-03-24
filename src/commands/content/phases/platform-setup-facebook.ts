/**
 * Facebook Pages platform setup wizard step.
 * Uses fbcli CLI for authentication — no manual token/pageId collection needed.
 * Auto-installs fbcli if missing (via go install or GitHub release binary).
 */

import { execSync } from "node:child_process";
import * as p from "@clack/prompts";
import type { ContentLogger } from "./content-logger.js";

/**
 * Run the Facebook Pages setup wizard using fbcli.
 * Returns true on success, false if user cancelled or verification failed.
 */
export async function setupFacebookPlatform(contentLogger: ContentLogger): Promise<boolean> {
	p.intro("Facebook Pages Setup");

	// Check fbcli installed, auto-install if missing
	if (!isFbcliInstalled()) {
		p.log.warning("fbcli CLI not found. Attempting auto-install...");
		const installed = await autoInstallFbcli(contentLogger);
		if (!installed) return false;
	}
	p.log.success("fbcli CLI found.");

	// Check if already authenticated
	if (isFbcliAuthenticated()) {
		const pageName = getFbcliPageName();
		p.log.success(`fbcli authenticated${pageName ? ` (page: ${pageName})` : ""}.`);
		return true;
	}

	// Prompt user to authenticate
	p.log.warning("fbcli is not authenticated.");
	p.log.info("Run `fbcli auth login` in a separate terminal, then come back here.");
	p.log.info("This will open your browser for Facebook OAuth authorization.");

	const proceed = await p.confirm({ message: "Have you completed fbcli auth login?" });
	if (p.isCancel(proceed) || !proceed) {
		contentLogger.info("Facebook setup cancelled by user");
		return false;
	}

	// Re-verify
	if (isFbcliAuthenticated()) {
		const pageName = getFbcliPageName();
		p.log.success(`fbcli authenticated${pageName ? ` (page: ${pageName})` : ""}.`);
		contentLogger.info(
			`Facebook platform configured via fbcli${pageName ? ` — page: ${pageName}` : ""}`,
		);
		return true;
	}

	p.log.error("Facebook authentication still failed. Run `fbcli auth status` to check.");
	contentLogger.error("Facebook authentication verification failed after user confirmation");
	return false;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check if fbcli is installed and accessible in PATH. */
function isFbcliInstalled(): boolean {
	try {
		execSync("which fbcli", { stdio: "pipe" });
		return true;
	} catch {
		return false;
	}
}

/** Check if fbcli has valid stored credentials. */
function isFbcliAuthenticated(): boolean {
	try {
		const raw = execSync("fbcli auth status --json", { stdio: "pipe", timeout: 10000 }).toString();
		const data = JSON.parse(raw) as Record<string, unknown>;
		return data.authenticated === true || Boolean(data.page_name);
	} catch {
		return false;
	}
}

/** Get the authenticated page name from fbcli, or empty string. */
function getFbcliPageName(): string {
	try {
		const raw = execSync("fbcli auth status --json", { stdio: "pipe", timeout: 10000 }).toString();
		const data = JSON.parse(raw) as Record<string, unknown>;
		return String(data.page_name ?? "");
	} catch {
		return "";
	}
}

/**
 * Auto-install fbcli.
 * Strategy: go install > GitHub release binary download.
 */
async function autoInstallFbcli(contentLogger: ContentLogger): Promise<boolean> {
	// Try `go install` first (most reliable if Go is available)
	try {
		execSync("which go", { stdio: "pipe" });
		p.log.info("Installing fbcli via `go install`...");
		execSync("go install github.com/mrgoonie/fbcli/cmd/fbcli@latest", {
			stdio: "inherit",
			timeout: 120000,
		});
		if (isFbcliInstalled()) {
			contentLogger.info("fbcli installed via go install");
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
			const url = `https://github.com/mrgoonie/fbcli/releases/latest/download/fbcli_${os}_${cpu}${ext}`;
			const dest = platform === "win32" ? "fbcli.exe" : "/usr/local/bin/fbcli";
			p.log.info(`Downloading fbcli binary for ${os}/${cpu}...`);
			execSync(`curl -fsSL "${url}" -o "${dest}" && chmod +x "${dest}"`, {
				stdio: "inherit",
				timeout: 60000,
			});
			if (isFbcliInstalled()) {
				contentLogger.info("fbcli installed from GitHub release");
				return true;
			}
		}
	} catch {
		// Download failed
	}

	p.log.error("Could not auto-install fbcli.");
	p.log.info("Install manually:");
	p.log.info("  Go: go install github.com/mrgoonie/fbcli/cmd/fbcli@latest");
	p.log.info("  Binary: https://github.com/mrgoonie/fbcli/releases");
	contentLogger.warn("fbcli auto-install failed");
	return false;
}
