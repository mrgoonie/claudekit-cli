/**
 * Facebook platform adapter using fbcli CLI.
 * Wraps `fbcli` (Go binary) for auth, posting, and engagement tracking.
 * Supports text posts, photo posts, and engagement fetching via --json output.
 *
 * @see https://github.com/mrgoonie/fbcli
 */

import { execFileSync } from "node:child_process";
import type {
	AuthStatus,
	EngagementData,
	PlatformAdapter,
	PublishOptions,
	PublishResult,
} from "./adapter-interface.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Run a fbcli command with JSON output. Uses execFileSync to prevent shell injection. */
function runFbcli(args: string[], timeoutMs = 30000): string {
	return execFileSync("fbcli", [...args, "--json"], {
		stdio: "pipe",
		timeout: timeoutMs,
	}).toString();
}

function dryRunResult(): PublishResult {
	return { success: true, postId: "dry-run", postUrl: "https://facebook.com/dry-run" };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class FacebookAdapter implements PlatformAdapter {
	readonly platform = "facebook" as const;

	// -------------------------------------------------------------------------
	// Auth — delegates entirely to fbcli's stored credentials
	// -------------------------------------------------------------------------

	async verifyAuth(): Promise<AuthStatus> {
		try {
			const raw = runFbcli(["auth", "status"], 10000);
			const data = JSON.parse(raw) as Record<string, unknown>;

			// fbcli auth status --json returns { authenticated: bool, page_name: string, ... }
			if (data.authenticated === true || data.page_name) {
				return {
					authenticated: true,
					username: String(data.page_name ?? data.user_name ?? ""),
				};
			}
			return {
				authenticated: false,
				error: String(data.error ?? "Not authenticated. Run 'fbcli auth login'."),
			};
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			if (msg.includes("command not found") || msg.includes("not found")) {
				return {
					authenticated: false,
					error: "fbcli not installed. Run 'go install github.com/mrgoonie/fbcli/cmd/fbcli@latest'",
				};
			}
			return { authenticated: false, error: msg };
		}
	}

	// -------------------------------------------------------------------------
	// Publishing
	// -------------------------------------------------------------------------

	async publishText(text: string, options?: PublishOptions): Promise<PublishResult> {
		if (options?.dryRun) return dryRunResult();

		try {
			// Pass text via stdin to avoid shell injection
			const raw = execFileSync("fbcli", ["post", "--json"], {
				input: text,
				stdio: ["pipe", "pipe", "pipe"],
				timeout: 30000,
			}).toString();

			const parsed = JSON.parse(raw) as Record<string, unknown>;
			if (parsed.error) {
				return { success: false, postId: "", postUrl: "", error: String(parsed.error) };
			}

			const postId = String(parsed.id ?? parsed.post_id ?? "");
			const postUrl = String(
				parsed.url ?? parsed.permalink_url ?? `https://facebook.com/${postId}`,
			);
			return { success: true, postId, postUrl };
		} catch (err) {
			return {
				success: false,
				postId: "",
				postUrl: "",
				error: err instanceof Error ? err.message : String(err),
			};
		}
	}

	async publishPhoto(
		text: string,
		mediaPath: string,
		options?: PublishOptions,
	): Promise<PublishResult> {
		if (options?.dryRun) return dryRunResult();

		try {
			// Use execFileSync with argument array to prevent shell injection on mediaPath
			const raw = execFileSync("fbcli", ["post", "-i", mediaPath, "--json"], {
				input: text,
				stdio: ["pipe", "pipe", "pipe"],
				timeout: 60000,
			}).toString();

			const parsed = JSON.parse(raw) as Record<string, unknown>;
			if (parsed.error) {
				return { success: false, postId: "", postUrl: "", error: String(parsed.error) };
			}

			const postId = String(parsed.id ?? parsed.post_id ?? "");
			const postUrl = String(
				parsed.url ?? parsed.permalink_url ?? `https://facebook.com/${postId}`,
			);
			return { success: true, postId, postUrl };
		} catch (err) {
			return {
				success: false,
				postId: "",
				postUrl: "",
				error: err instanceof Error ? err.message : String(err),
			};
		}
	}

	// -------------------------------------------------------------------------
	// Engagement — uses fbcli read <postId> --json
	// -------------------------------------------------------------------------

	async getEngagement(postId: string): Promise<EngagementData> {
		try {
			const raw = runFbcli(["read", postId], 10000);
			const parsed = JSON.parse(raw) as Record<string, unknown>;

			return {
				likes: Number(parsed.reactions_count ?? parsed.likes ?? 0),
				shares: Number(parsed.shares_count ?? parsed.shares ?? 0),
				comments: Number(parsed.comments_count ?? parsed.comments ?? 0),
				// fbcli doesn't expose impressions
				impressions: 0,
			};
		} catch {
			return { likes: 0, shares: 0, comments: 0, impressions: 0 };
		}
	}
}
