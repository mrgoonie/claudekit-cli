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

	// Guide user through page token setup (per fbcli README)
	p.log.warning("fbcli is not authenticated.");
	p.log.step("To get a Facebook Page Token:");
	p.log.message("  1. Go to https://developers.facebook.com/ → create a Business app");
	p.log.message('  2. Use Cases → Add "Manage Everything on your Page"');
	p.log.message("  3. Customize → add `pages_manage_posts` permission");
	p.log.message("  4. Open https://developers.facebook.com/tools/explorer/");
	p.log.message(
		"  5. Select your app, add permissions: pages_manage_posts, pages_read_engagement, pages_show_list",
	);
	p.log.message('  6. Change "User or Page" to your Facebook Page (not User Token)');
	p.log.message("  7. Click Generate Access Token → approve → copy the token");
	p.log.message("");
	p.log.message("  Full guide: https://github.com/mrgoonie/fbcli#setup");

	const token = await p.text({
		message: "Paste your Facebook Page Token:",
		placeholder: "EAAxxxxxxx...",
		validate: (val) => {
			if (!val || val.trim().length < 10)
				return "Token too short — paste the full token from Graph API Explorer.";
			return undefined;
		},
	});
	if (p.isCancel(token)) {
		contentLogger.info("Facebook setup cancelled by user");
		return false;
	}

	// Authenticate via fbcli auth token
	try {
		execSync(`fbcli auth token "${token.trim()}"`, { stdio: "pipe", timeout: 15000 });
	} catch (err) {
		p.log.error("Failed to set token via `fbcli auth token`. Check the token and try again.");
		contentLogger.error("fbcli auth token command failed");
		return false;
	}

	// Verify
	if (isFbcliAuthenticated()) {
		const pageName = getFbcliPageName();
		p.log.success(`fbcli authenticated${pageName ? ` (page: ${pageName})` : ""}.`);
		contentLogger.info(
			`Facebook platform configured via fbcli${pageName ? ` — page: ${pageName}` : ""}`,
		);
		return true;
	}

	p.log.error(
		"Token set but authentication verification failed. Run `fbcli auth status` to check.",
	);
	contentLogger.error("Facebook authentication verification failed after token set");
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

	// Fallback: download pre-built binary from GitHub releases (with user consent)
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

			// Require explicit user consent before downloading a binary
			p.log.warning(`Will download fbcli binary from: ${url}`);
			p.log.warning(
				"Note: Binary integrity is not verified. Review the source at https://github.com/mrgoonie/fbcli",
			);
			const consent = await p.confirm({ message: `Download and install fbcli to ${dest}?` });
			if (p.isCancel(consent) || !consent) {
				contentLogger.info("User declined fbcli binary download");
				return false;
			}

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
