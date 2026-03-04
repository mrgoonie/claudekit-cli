/**
 * Facebook Pages platform setup wizard step.
 * Collects Page ID and access token, then verifies credentials via Graph API.
 */

import { execSync } from "node:child_process";
import * as p from "@clack/prompts";
import type { ContentLogger } from "./content-logger.js";

export interface FacebookCredentials {
	pageId: string;
	accessToken: string;
}

/**
 * Run the Facebook Pages setup wizard.
 * Returns credentials on success, null if user cancelled or verification failed.
 */
export async function setupFacebookPlatform(
	contentLogger: ContentLogger,
): Promise<FacebookCredentials | null> {
	p.intro("Facebook Pages Setup");

	p.log.info("To use Facebook Pages, you need:");
	p.log.info("1. A Meta Developer App: https://developers.facebook.com/apps/");
	p.log.info("2. Permissions: pages_manage_posts, pages_read_engagement");
	p.log.info("3. A Page Access Token (long-lived)");
	p.log.info("");

	// Collect Page ID
	const pageId = await p.text({
		message: "Enter your Facebook Page ID:",
		placeholder: "e.g., 123456789012345",
		validate: (value) => {
			if (!value || value.trim().length === 0) return "Page ID is required";
			if (!/^\d+$/.test(value.trim())) return "Page ID should be numeric";
			return undefined;
		},
	});
	if (p.isCancel(pageId)) {
		contentLogger.info("Facebook setup cancelled by user");
		return null;
	}

	// Collect access token (masked input)
	const accessToken = await p.password({
		message: "Enter your Page Access Token:",
		validate: (value) => {
			if (!value || value.trim().length < 10) return "Access token is required";
			return undefined;
		},
	});
	if (p.isCancel(accessToken)) {
		contentLogger.info("Facebook setup cancelled by user");
		return null;
	}

	const trimmedPageId = String(pageId).trim();
	const trimmedToken = String(accessToken).trim();

	// Verify credentials against Graph API
	p.log.info("Verifying credentials...");
	const pageName = verifyFacebookCredentials(trimmedPageId, trimmedToken, contentLogger);

	if (pageName === null) {
		p.log.error("Facebook credential verification failed. Check your Page ID and token.");
		return null;
	}

	p.log.success(`Connected to page: ${pageName}`);
	contentLogger.info(`Facebook platform configured — page: ${pageName} (${trimmedPageId})`);

	return { pageId: trimmedPageId, accessToken: trimmedToken };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Call the Facebook Graph API to verify the page credentials.
 * Returns the page name on success, null on any error.
 *
 * Note: token is passed as a URL parameter — Graph API requirement.
 * The token is not logged or stored by this function.
 */
function verifyFacebookCredentials(
	pageId: string,
	accessToken: string,
	contentLogger: ContentLogger,
): string | null {
	try {
		const url = `https://graph.facebook.com/v21.0/${pageId}?access_token=${accessToken}`;
		const result = execSync(`curl -s "${url}"`, { stdio: "pipe", timeout: 10000 }).toString();
		const data = JSON.parse(result) as {
			name?: string;
			error?: { message: string; code: number };
		};

		if (data.name) return data.name;

		if (data.error) {
			contentLogger.error(`Facebook API error: ${data.error.message} (code ${data.error.code})`);
		}
		return null;
	} catch (err) {
		contentLogger.error(
			`Facebook setup error: ${err instanceof Error ? err.message : String(err)}`,
		);
		return null;
	}
}
