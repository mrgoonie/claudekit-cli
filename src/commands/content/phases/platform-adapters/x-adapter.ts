/**
 * X (Twitter) platform adapter.
 * Uses the `xurl` CLI (https://github.com/xdevplatform/xurl) for API calls.
 * Supports text posts, photo posts, and multi-part threads.
 */

import { execSync } from "node:child_process";
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

/** Escape single-quotes in a string so it is safe inside a shell single-quoted argument. */
function shellEscape(str: string): string {
	return str.replace(/'/g, "'\\''");
}

function runXurl(args: string, timeoutMs = 30000): string {
	// Cross-platform: use cmd.exe on Windows, /bin/sh on Unix
	const shell = process.platform === "win32" ? "cmd.exe" : "/bin/sh";
	return execSync(`xurl ${args}`, {
		stdio: "pipe",
		timeout: timeoutMs,
		shell,
	}).toString();
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class XAdapter implements PlatformAdapter {
	readonly platform = "x" as const;

	// -------------------------------------------------------------------------
	// Auth
	// -------------------------------------------------------------------------

	async verifyAuth(): Promise<AuthStatus> {
		try {
			const raw = runXurl("GET /2/users/me", 10000);
			const data = JSON.parse(raw);
			if (data.data?.username) {
				return { authenticated: true, username: data.data.username };
			}
			return { authenticated: false, error: "No user data returned" };
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			if (msg.includes("command not found") || msg.includes("not found")) {
				return {
					authenticated: false,
					error: "xurl not installed. Install from https://github.com/xdevplatform/xurl",
				};
			}
			return { authenticated: false, error: msg };
		}
	}

	// -------------------------------------------------------------------------
	// Publishing
	// -------------------------------------------------------------------------

	async publishText(text: string, options?: PublishOptions): Promise<PublishResult> {
		if (options?.dryRun) {
			return { success: true, postId: "dry-run", postUrl: "https://x.com/dry-run" };
		}
		try {
			const body = JSON.stringify({ text });
			const raw = runXurl(`POST /2/tweets --data '${shellEscape(body)}'`);
			const parsed = JSON.parse(raw);
			const postId = parsed.data?.id ?? "";
			return { success: true, postId, postUrl: `https://x.com/i/status/${postId}` };
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
		if (options?.dryRun) {
			return { success: true, postId: "dry-run", postUrl: "https://x.com/dry-run" };
		}
		try {
			// Step 1: Upload media via v1.1 endpoint
			const uploadRaw = runXurl(`POST /1.1/media/upload.json -F "media=@${mediaPath}"`, 60000);
			const uploadParsed = JSON.parse(uploadRaw);
			const mediaId = uploadParsed.media_id_string;

			if (!mediaId) {
				return {
					success: false,
					postId: "",
					postUrl: "",
					error: "Media upload failed: no media_id returned",
				};
			}

			// Step 2: Tweet with media attachment
			const body = JSON.stringify({ text, media: { media_ids: [mediaId] } });
			const raw = runXurl(`POST /2/tweets --data '${shellEscape(body)}'`);
			const parsed = JSON.parse(raw);
			const postId = parsed.data?.id ?? "";
			return { success: true, postId, postUrl: `https://x.com/i/status/${postId}` };
		} catch (err) {
			return {
				success: false,
				postId: "",
				postUrl: "",
				error: err instanceof Error ? err.message : String(err),
			};
		}
	}

	async publishThread(parts: string[], options?: PublishOptions): Promise<PublishResult> {
		if (options?.dryRun) {
			return { success: true, postId: "dry-run", postUrl: "https://x.com/dry-run" };
		}
		if (parts.length === 0) {
			return { success: false, postId: "", postUrl: "", error: "Thread has no parts" };
		}

		const postedIds: string[] = [];
		let previousId: string | undefined;
		let firstId = "";

		try {
			for (const part of parts) {
				const payload: Record<string, unknown> = { text: part };
				if (previousId) {
					payload.reply = { in_reply_to_tweet_id: previousId };
				}
				const raw = runXurl(`POST /2/tweets --data '${shellEscape(JSON.stringify(payload))}'`);
				const parsed = JSON.parse(raw);
				previousId = parsed.data?.id;
				if (previousId) postedIds.push(previousId);
				if (!firstId && previousId) firstId = previousId;
			}

			return { success: true, postId: firstId, postUrl: `https://x.com/i/status/${firstId}` };
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			return {
				success: false,
				postId: postedIds[0] ?? "",
				postUrl: postedIds[0] ? `https://x.com/i/status/${postedIds[0]}` : "",
				error: `Thread failed at part ${postedIds.length + 1}/${parts.length}: ${msg}. Posted IDs: [${postedIds.join(", ")}]`,
			};
		}
	}

	// -------------------------------------------------------------------------
	// Engagement
	// -------------------------------------------------------------------------

	async getEngagement(postId: string): Promise<EngagementData> {
		try {
			const raw = runXurl(`GET "/2/tweets/${postId}?tweet.fields=public_metrics"`, 10000);
			const parsed = JSON.parse(raw);
			const m = parsed.data?.public_metrics ?? {};
			return {
				likes: m.like_count ?? 0,
				shares: m.retweet_count ?? 0,
				comments: m.reply_count ?? 0,
				impressions: m.impression_count ?? 0,
			};
		} catch {
			return { likes: 0, shares: 0, comments: 0, impressions: 0 };
		}
	}
}
