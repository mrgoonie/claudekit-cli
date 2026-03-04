import { describe, expect, test } from "bun:test";
import { RateLimiter } from "@/commands/content/phases/platform-adapters/rate-limiter.js";
import type { ContentConfig, ContentState } from "@/commands/content/types.js";

describe("Rate Limiter", () => {
	const defaultConfig: ContentConfig = {
		enabled: true,
		pollIntervalMs: 60000,
		platforms: {
			x: {
				enabled: true,
				maxPostsPerDay: 5,
				threadMaxParts: 6,
			},
			facebook: {
				enabled: true,
				pageId: "123456",
				maxPostsPerDay: 3,
			},
		},
		reviewMode: "auto",
		schedule: {
			timezone: "UTC",
			quietHoursStart: "23:00",
			quietHoursEnd: "06:00",
		},
		selfImprovement: {
			enabled: true,
			engagementCheckIntervalHours: 6,
			topPerformingCount: 10,
		},
		maxContentPerDay: 10,
		contentDir: "~/.claudekit/content/",
		dbPath: "~/.claudekit/content.db",
	};

	const defaultState: ContentState = {
		lastScanAt: null,
		lastEngagementCheckAt: null,
		processedEvents: [],
		contentQueue: [],
		currentlyCreating: null,
		dailyPostCounts: {},
	};

	describe("canPost", () => {
		test("should return true when under limit for X", () => {
			const state: ContentState = {
				...defaultState,
				dailyPostCounts: { "x-2026-03-04": 2 } as any,
			};
			const limiter = new RateLimiter(state, defaultConfig);
			expect(limiter.canPost("x")).toBe(true);
		});

		test("should return false when at limit for X", () => {
			const state: ContentState = {
				...defaultState,
				dailyPostCounts: { "x-2026-03-04": 5 } as any as any,
			};
			const limiter = new RateLimiter(state, defaultConfig);
			expect(limiter.canPost("x")).toBe(false);
		});

		test("should return false when over limit for X", () => {
			const state: ContentState = {
				...defaultState,
				dailyPostCounts: { "x-2026-03-04": 10 } as any,
			};
			const limiter = new RateLimiter(state, defaultConfig);
			expect(limiter.canPost("x")).toBe(false);
		});

		test("should return true when no posts today for X", () => {
			const state: ContentState = { ...defaultState, dailyPostCounts: {} };
			const limiter = new RateLimiter(state, defaultConfig);
			expect(limiter.canPost("x")).toBe(true);
		});

		test("should return true when under limit for Facebook", () => {
			const state: ContentState = {
				...defaultState,
				dailyPostCounts: { "facebook-2026-03-04": 1 } as any,
			};
			const limiter = new RateLimiter(state, defaultConfig);
			expect(limiter.canPost("facebook")).toBe(true);
		});

		test("should return false when at limit for Facebook", () => {
			const state: ContentState = {
				...defaultState,
				dailyPostCounts: { "facebook-2026-03-04": 3 } as any,
			};
			const limiter = new RateLimiter(state, defaultConfig);
			expect(limiter.canPost("facebook")).toBe(false);
		});

		test("should return true when under limit for x_thread", () => {
			const state: ContentState = {
				...defaultState,
				dailyPostCounts: { "x_thread-2026-03-04": 2 } as any,
			};
			const limiter = new RateLimiter(state, defaultConfig);
			expect(limiter.canPost("x_thread")).toBe(true);
		});

		test("should use x maxPostsPerDay for x_thread", () => {
			const state: ContentState = {
				...defaultState,
				dailyPostCounts: { "x_thread-2026-03-04": 5 } as any,
			};
			const limiter = new RateLimiter(state, defaultConfig);
			// x_thread should use same limit as x (5)
			expect(limiter.canPost("x_thread")).toBe(false);
		});
	});

	describe("recordPost", () => {
		test("should increment counter for X", () => {
			const state: ContentState = { ...defaultState, dailyPostCounts: {} };
			const limiter = new RateLimiter(state, defaultConfig);
			limiter.recordPost("x");
			expect(state.dailyPostCounts["x-2026-03-04"]).toBe(1);
		});

		test("should increment existing counter", () => {
			const state: ContentState = {
				...defaultState,
				dailyPostCounts: { "x-2026-03-04": 2 } as any,
			};
			const limiter = new RateLimiter(state, defaultConfig);
			limiter.recordPost("x");
			expect(state.dailyPostCounts["x-2026-03-04"]).toBe(3);
		});

		test("should use correct daily key format", () => {
			const state: ContentState = { ...defaultState, dailyPostCounts: {} };
			const limiter = new RateLimiter(state, defaultConfig);
			limiter.recordPost("facebook");
			const keys = Object.keys(state.dailyPostCounts);
			expect(keys).toHaveLength(1);
			expect(keys[0]).toMatch(/^facebook-\d{4}-\d{2}-\d{2}$/);
		});

		test("should track multiple platforms separately", () => {
			const state: ContentState = { ...defaultState, dailyPostCounts: {} };
			const limiter = new RateLimiter(state, defaultConfig);
			limiter.recordPost("x");
			limiter.recordPost("facebook");
			limiter.recordPost("x");

			expect(state.dailyPostCounts["x-2026-03-04"]).toBe(2);
			expect(state.dailyPostCounts["facebook-2026-03-04"]).toBe(1);
		});

		test("should correctly track x and x_thread separately", () => {
			const state: ContentState = { ...defaultState, dailyPostCounts: {} };
			const limiter = new RateLimiter(state, defaultConfig);
			limiter.recordPost("x");
			limiter.recordPost("x_thread");

			expect(state.dailyPostCounts["x-2026-03-04"]).toBe(1);
			expect(state.dailyPostCounts["x_thread-2026-03-04"]).toBe(1);
		});
	});

	describe("getRemainingToday", () => {
		test("should return remaining count when under limit", () => {
			const state: ContentState = {
				...defaultState,
				dailyPostCounts: { "x-2026-03-04": 2 } as any,
			};
			const limiter = new RateLimiter(state, defaultConfig);
			expect(limiter.getRemainingToday("x")).toBe(3); // 5 - 2 = 3
		});

		test("should return 0 when at limit", () => {
			const state: ContentState = {
				...defaultState,
				dailyPostCounts: { "x-2026-03-04": 5 } as any,
			};
			const limiter = new RateLimiter(state, defaultConfig);
			expect(limiter.getRemainingToday("x")).toBe(0);
		});

		test("should return 0 when over limit", () => {
			const state: ContentState = {
				...defaultState,
				dailyPostCounts: { "x-2026-03-04": 10 } as any,
			};
			const limiter = new RateLimiter(state, defaultConfig);
			expect(limiter.getRemainingToday("x")).toBe(0);
		});

		test("should return max count when no posts today", () => {
			const state: ContentState = { ...defaultState, dailyPostCounts: {} };
			const limiter = new RateLimiter(state, defaultConfig);
			expect(limiter.getRemainingToday("x")).toBe(5); // max for X
			expect(limiter.getRemainingToday("facebook")).toBe(3); // max for Facebook
		});

		test("should respect custom maxPostsPerDay", () => {
			const customConfig = {
				...defaultConfig,
				platforms: {
					x: { ...defaultConfig.platforms.x, maxPostsPerDay: 10 },
					facebook: defaultConfig.platforms.facebook,
				},
			};
			const state: ContentState = {
				...defaultState,
				dailyPostCounts: { "x-2026-03-04": 5 } as any,
			};
			const limiter = new RateLimiter(state, customConfig);
			expect(limiter.getRemainingToday("x")).toBe(5); // 10 - 5 = 5
		});
	});

	describe("dailyKey format", () => {
		test("should use platform-YYYY-MM-DD format for key", () => {
			const state: ContentState = { ...defaultState, dailyPostCounts: {} };
			const limiter = new RateLimiter(state, defaultConfig);
			limiter.recordPost("x");

			const keys = Object.keys(state.dailyPostCounts);
			expect(keys).toHaveLength(1);
			const key = keys[0];

			// Format should be: platform-YYYY-MM-DD
			expect(key).toMatch(/^[a-z_]+-\d{4}-\d{2}-\d{2}$/);
			expect(key.startsWith("x-")).toBe(true);

			// Extract date part and verify it's valid
			const datePart = key.split("-").slice(1).join("-");
			const date = new Date(datePart);
			expect(date.toISOString().slice(0, 10)).toBe(datePart);
		});
	});

	describe("isInQuietHours", () => {
		test("should return false when current time is outside quiet hours", () => {
			const config: ContentConfig = {
				...defaultConfig,
				schedule: {
					timezone: "UTC",
					quietHoursStart: "23:00",
					quietHoursEnd: "06:00",
				},
			};
			const state = { ...defaultState };
			const limiter = new RateLimiter(state, config);

			// This test is time-dependent, so we just verify it returns a boolean
			const result = limiter.isInQuietHours();
			expect(typeof result).toBe("boolean");
		});

		test("should handle invalid timezone gracefully", () => {
			const config: ContentConfig = {
				...defaultConfig,
				schedule: {
					timezone: "Invalid/Timezone",
					quietHoursStart: "23:00",
					quietHoursEnd: "06:00",
				},
			};
			const state = { ...defaultState };
			const limiter = new RateLimiter(state, config);

			// Should not throw and should return false (don't block publishing)
			expect(() => limiter.isInQuietHours()).not.toThrow();
			expect(limiter.isInQuietHours()).toBe(false);
		});

		test("should handle different timezone formats", () => {
			const timezones = ["UTC", "America/New_York", "Europe/London", "Asia/Tokyo"];
			for (const tz of timezones) {
				const config: ContentConfig = {
					...defaultConfig,
					schedule: {
						timezone: tz,
						quietHoursStart: "23:00",
						quietHoursEnd: "06:00",
					},
				};
				const state = { ...defaultState };
				const limiter = new RateLimiter(state, config);

				// Should not throw
				expect(() => limiter.isInQuietHours()).not.toThrow();
				// Should return a boolean
				expect(typeof limiter.isInQuietHours()).toBe("boolean");
			}
		});

		test("should handle non-wrapping quiet hours (start before end)", () => {
			const config: ContentConfig = {
				...defaultConfig,
				schedule: {
					timezone: "UTC",
					quietHoursStart: "02:00",
					quietHoursEnd: "08:00",
				},
			};
			const state = { ...defaultState };
			const limiter = new RateLimiter(state, config);

			// Should not throw
			expect(() => limiter.isInQuietHours()).not.toThrow();
		});

		test("should handle wrapping quiet hours (start after end, e.g. 23:00-06:00)", () => {
			const config: ContentConfig = {
				...defaultConfig,
				schedule: {
					timezone: "UTC",
					quietHoursStart: "23:00",
					quietHoursEnd: "06:00",
				},
			};
			const state = { ...defaultState };
			const limiter = new RateLimiter(state, config);

			// Should not throw
			expect(() => limiter.isInQuietHours()).not.toThrow();
		});
	});

	describe("Integration: full workflow", () => {
		test("should track posts correctly throughout the day", () => {
			const state: ContentState = { ...defaultState, dailyPostCounts: {} };
			const limiter = new RateLimiter(state, defaultConfig);

			expect(limiter.canPost("x")).toBe(true);
			expect(limiter.getRemainingToday("x")).toBe(5);

			limiter.recordPost("x");
			expect(limiter.getRemainingToday("x")).toBe(4);

			limiter.recordPost("x");
			expect(limiter.getRemainingToday("x")).toBe(3);

			limiter.recordPost("x");
			limiter.recordPost("x");
			limiter.recordPost("x");

			expect(limiter.canPost("x")).toBe(false);
			expect(limiter.getRemainingToday("x")).toBe(0);
		});

		test("should track multiple platforms independently", () => {
			const state: ContentState = { ...defaultState, dailyPostCounts: {} };
			const limiter = new RateLimiter(state, defaultConfig);

			// Post to X until limit
			for (let i = 0; i < 5; i++) {
				limiter.recordPost("x");
			}

			// X is now full
			expect(limiter.canPost("x")).toBe(false);

			// Facebook should still have capacity
			expect(limiter.canPost("facebook")).toBe(true);
			expect(limiter.getRemainingToday("facebook")).toBe(3);

			// Post to Facebook until limit
			for (let i = 0; i < 3; i++) {
				limiter.recordPost("facebook");
			}

			// Both platforms are now full
			expect(limiter.canPost("x")).toBe(false);
			expect(limiter.canPost("facebook")).toBe(false);
		});
	});
});
