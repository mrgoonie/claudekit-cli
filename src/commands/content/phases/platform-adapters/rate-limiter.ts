/**
 * Per-platform rate limiter for the content publishing pipeline.
 * Tracks daily post counts in ContentState and enforces per-platform caps.
 * Also checks the configured quiet-hours window to defer posts.
 */

import type { ContentConfig, ContentState, Platform } from "../../types.js";

export class RateLimiter {
	constructor(
		private readonly state: ContentState,
		private readonly config: ContentConfig,
	) {}

	// -------------------------------------------------------------------------
	// Public API
	// -------------------------------------------------------------------------

	/** Returns true if the platform has not yet reached its daily post cap. */
	canPost(platform: Platform): boolean {
		return this.getTodayCount(platform) < this.getMaxPerDay(platform);
	}

	/** Increment the in-memory daily counter for the platform. */
	recordPost(platform: Platform): void {
		const key = this.dailyKey(platform);
		this.state.dailyPostCounts[key] = (this.state.dailyPostCounts[key] ?? 0) + 1;
	}

	/** How many more posts are allowed today for this platform. */
	getRemainingToday(platform: Platform): number {
		return Math.max(0, this.getMaxPerDay(platform) - this.getTodayCount(platform));
	}

	/**
	 * Returns true when the current local time falls inside the configured
	 * quiet-hours window (quietHoursStart – quietHoursEnd, wraps midnight).
	 */
	isInQuietHours(): boolean {
		const { timezone, quietHoursStart, quietHoursEnd } = this.config.schedule;
		try {
			const formatter = new Intl.DateTimeFormat("en-US", {
				timeZone: timezone,
				hour: "2-digit",
				minute: "2-digit",
				hour12: false,
			});
			const current = formatter.format(new Date());
			// Window wraps midnight when start > end (e.g. 23:00 – 06:00)
			if (quietHoursStart > quietHoursEnd) {
				return current >= quietHoursStart || current < quietHoursEnd;
			}
			return current >= quietHoursStart && current < quietHoursEnd;
		} catch {
			// Unknown timezone or Intl failure — don't block publishing
			return false;
		}
	}

	// -------------------------------------------------------------------------
	// Internal helpers
	// -------------------------------------------------------------------------

	private getMaxPerDay(platform: Platform): number {
		if (platform === "x" || platform === "x_thread") {
			return this.config.platforms.x.maxPostsPerDay;
		}
		if (platform === "facebook") {
			return this.config.platforms.facebook.maxPostsPerDay;
		}
		return this.config.maxContentPerDay;
	}

	private getTodayCount(platform: Platform): number {
		return this.state.dailyPostCounts[this.dailyKey(platform)] ?? 0;
	}

	/** Key format: "<platform>-YYYY-MM-DD" in UTC. */
	private dailyKey(platform: Platform): string {
		return `${platform}-${new Date().toISOString().slice(0, 10)}`;
	}
}
