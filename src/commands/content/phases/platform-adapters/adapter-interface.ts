/**
 * Platform adapter interface for the content publishing pipeline.
 * Each social platform implements PlatformAdapter to provide
 * auth verification, text/photo/thread publishing, and engagement fetch.
 */

import type { Platform } from "../../types.js";

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface PublishResult {
	success: boolean;
	postId: string;
	postUrl: string;
	error?: string;
}

export interface EngagementData {
	likes: number;
	shares: number;
	comments: number;
	impressions: number;
}

export interface AuthStatus {
	authenticated: boolean;
	username?: string;
	expiresAt?: string;
	error?: string;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface PublishOptions {
	/** When true, simulate publish without hitting the real API */
	dryRun?: boolean;
}

// ---------------------------------------------------------------------------
// Adapter contract
// ---------------------------------------------------------------------------

export interface PlatformAdapter {
	readonly platform: Platform;

	/** Check whether stored credentials are valid */
	verifyAuth(): Promise<AuthStatus>;

	/** Publish a text-only post */
	publishText(text: string, options?: PublishOptions): Promise<PublishResult>;

	/** Publish a post with an attached image or video */
	publishPhoto(text: string, mediaPath: string, options?: PublishOptions): Promise<PublishResult>;

	/** Publish a multi-part thread (optional — only X supports this) */
	publishThread?(parts: string[], options?: PublishOptions): Promise<PublishResult>;

	/** Fetch engagement metrics for an existing post */
	getEngagement(postId: string): Promise<EngagementData>;
}
