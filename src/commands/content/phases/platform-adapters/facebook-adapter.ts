/**
 * Facebook platform adapter.
 * Uses native fetch + Facebook Graph API v21.0.
 * Supports text posts, photo posts, and engagement fetching.
 */

import { readFileSync } from "node:fs";
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

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

async function graphGet(path: string, token: string, timeoutMs = 10000): Promise<unknown> {
	const url = `${GRAPH_BASE}${path}${path.includes("?") ? "&" : "?"}access_token=${token}`;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetch(url, { signal: controller.signal });
		return await res.json();
	} finally {
		clearTimeout(timer);
	}
}

async function graphPost(
	path: string,
	body: Record<string, string>,
	token: string,
	timeoutMs = 30000,
): Promise<unknown> {
	const url = `${GRAPH_BASE}${path}`;
	const params = new URLSearchParams({ ...body, access_token: token });
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetch(url, {
			method: "POST",
			body: params,
			signal: controller.signal,
		});
		return await res.json();
	} finally {
		clearTimeout(timer);
	}
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class FacebookAdapter implements PlatformAdapter {
	readonly platform = "facebook" as const;

	constructor(
		private readonly pageId: string,
		private readonly accessToken: string,
	) {}

	async verifyAuth(): Promise<AuthStatus> {
		try {
			const data = (await graphGet("/me", this.accessToken)) as Record<string, unknown>;
			if (typeof data.name === "string") {
				return { authenticated: true, username: data.name };
			}
			const err = data.error as Record<string, unknown> | undefined;
			return {
				authenticated: false,
				error: typeof err?.message === "string" ? err.message : "Unknown auth error",
			};
		} catch (err) {
			return { authenticated: false, error: err instanceof Error ? err.message : String(err) };
		}
	}

	async publishText(text: string, options?: PublishOptions): Promise<PublishResult> {
		if (options?.dryRun) {
			return { success: true, postId: "dry-run", postUrl: "https://facebook.com/dry-run" };
		}
		try {
			const parsed = (await graphPost(
				`/${this.pageId}/feed`,
				{ message: text },
				this.accessToken,
			)) as Record<string, unknown>;
			if (parsed.error) {
				const e = parsed.error as Record<string, unknown>;
				return {
					success: false,
					postId: "",
					postUrl: "",
					error: String(e.message ?? parsed.error),
				};
			}
			const postId = String(parsed.id ?? "");
			return { success: true, postId, postUrl: `https://facebook.com/${postId}` };
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
			return { success: true, postId: "dry-run", postUrl: "https://facebook.com/dry-run" };
		}
		try {
			// Use FormData with file blob for photo upload
			const fileBuffer = readFileSync(mediaPath);
			const blob = new Blob([fileBuffer]);
			const formData = new FormData();
			formData.append("source", blob, "photo.png");
			formData.append("message", text);
			formData.append("access_token", this.accessToken);

			const res = await fetch(`${GRAPH_BASE}/${this.pageId}/photos`, {
				method: "POST",
				body: formData,
			});
			const parsed = (await res.json()) as Record<string, unknown>;
			if (parsed.error) {
				const e = parsed.error as Record<string, unknown>;
				return {
					success: false,
					postId: "",
					postUrl: "",
					error: String(e.message ?? parsed.error),
				};
			}
			const postId = String(parsed.id ?? "");
			return { success: true, postId, postUrl: `https://facebook.com/${postId}` };
		} catch (err) {
			return {
				success: false,
				postId: "",
				postUrl: "",
				error: err instanceof Error ? err.message : String(err),
			};
		}
	}

	async getEngagement(postId: string): Promise<EngagementData> {
		try {
			const fields = "likes.summary(true),shares,comments.summary(true)";
			const data = (await graphGet(`/${postId}?fields=${fields}`, this.accessToken)) as Record<
				string,
				unknown
			>;
			const likes =
				(data.likes as Record<string, Record<string, number>> | undefined)?.summary?.total_count ??
				0;
			const shares = (data.shares as Record<string, number> | undefined)?.count ?? 0;
			const comments =
				(data.comments as Record<string, Record<string, number>> | undefined)?.summary
					?.total_count ?? 0;
			return { likes, shares, comments, impressions: 0 };
		} catch {
			return { likes: 0, shares: 0, comments: 0, impressions: 0 };
		}
	}
}
