import { describe, expect, test } from "bun:test";
import {
	ContentConfigSchema,
	ContentStateSchema,
	ContentStatusEnum,
	GitEventTypeEnum,
	PlatformEnum,
} from "@/commands/content/types.js";

describe("Content Command Types", () => {
	describe("ContentStatusEnum", () => {
		test("should validate correct status values", () => {
			const validStatuses = [
				"draft",
				"scheduled",
				"reviewing",
				"approved",
				"publishing",
				"published",
				"failed",
			];
			validStatuses.forEach((status) => {
				expect(() => ContentStatusEnum.parse(status)).not.toThrow();
			});
		});

		test("should reject invalid status values", () => {
			expect(() => ContentStatusEnum.parse("invalid")).toThrow();
			expect(() => ContentStatusEnum.parse("archived")).toThrow();
			expect(() => ContentStatusEnum.parse("")).toThrow();
		});
	});

	describe("GitEventTypeEnum", () => {
		test("should validate correct event types", () => {
			const validTypes = ["commit", "pr_merged", "plan_completed", "tag", "release"];
			validTypes.forEach((type) => {
				expect(() => GitEventTypeEnum.parse(type)).not.toThrow();
			});
		});

		test("should reject invalid event types", () => {
			expect(() => GitEventTypeEnum.parse("issue")).toThrow();
			expect(() => GitEventTypeEnum.parse("fork")).toThrow();
			expect(() => GitEventTypeEnum.parse("")).toThrow();
		});
	});

	describe("PlatformEnum", () => {
		test("should validate correct platforms", () => {
			const validPlatforms = ["x", "x_thread", "facebook"];
			validPlatforms.forEach((platform) => {
				expect(() => PlatformEnum.parse(platform)).not.toThrow();
			});
		});

		test("should reject invalid platforms", () => {
			expect(() => PlatformEnum.parse("twitter")).toThrow();
			expect(() => PlatformEnum.parse("instagram")).toThrow();
			expect(() => PlatformEnum.parse("")).toThrow();
		});
	});

	describe("ContentConfigSchema", () => {
		test("should accept minimal valid config", () => {
			const config = ContentConfigSchema.parse({});
			expect(config.enabled).toBe(false);
			expect(config.pollIntervalMs).toBe(60000);
			expect(config.maxContentPerDay).toBe(10);
			expect(config.reviewMode).toBe("auto");
		});

		test("should apply default values", () => {
			const config = ContentConfigSchema.parse({ enabled: true });
			expect(config.platforms.x.maxPostsPerDay).toBe(5);
			expect(config.platforms.facebook.maxPostsPerDay).toBe(3);
			expect(config.schedule.timezone).toBe("UTC");
			expect(config.schedule.quietHoursStart).toBe("23:00");
			expect(config.schedule.quietHoursEnd).toBe("06:00");
		});

		test("should accept custom values", () => {
			const config = ContentConfigSchema.parse({
				enabled: true,
				pollIntervalMs: 30000,
				maxContentPerDay: 20,
				platforms: {
					x: { enabled: true, maxPostsPerDay: 10, threadMaxParts: 8 },
					facebook: { enabled: true, pageId: "123456", maxPostsPerDay: 5 },
				},
			});
			expect(config.enabled).toBe(true);
			expect(config.pollIntervalMs).toBe(30000);
			expect(config.maxContentPerDay).toBe(20);
			expect(config.platforms.x.maxPostsPerDay).toBe(10);
			expect(config.platforms.facebook.pageId).toBe("123456");
		});

		test("should accept valid positive numbers", () => {
			const config = ContentConfigSchema.parse({
				pollIntervalMs: 30000,
				maxContentPerDay: 5,
			});
			expect(config.pollIntervalMs).toBe(30000);
			expect(config.maxContentPerDay).toBe(5);
		});

		test("should validate reviewMode enum", () => {
			expect(() => ContentConfigSchema.parse({ reviewMode: "auto" })).not.toThrow();
			expect(() => ContentConfigSchema.parse({ reviewMode: "manual" })).not.toThrow();
			expect(() => ContentConfigSchema.parse({ reviewMode: "hybrid" })).not.toThrow();
			expect(() => ContentConfigSchema.parse({ reviewMode: "invalid" })).toThrow();
		});

		test("should handle empty strings in optional fields", () => {
			const config = ContentConfigSchema.parse({
				platforms: {
					facebook: { pageId: "" },
				},
			});
			expect(config.platforms.facebook.pageId).toBe("");
		});
	});

	describe("ContentStateSchema", () => {
		test("should accept minimal valid state", () => {
			const state = ContentStateSchema.parse({});
			expect(state.lastScanAt).toBeNull();
			expect(state.lastEngagementCheckAt).toBeNull();
			expect(state.processedEvents).toEqual([]);
			expect(state.contentQueue).toEqual([]);
			expect(state.currentlyCreating).toBeNull();
			expect(state.dailyPostCounts).toEqual({});
		});

		test("should accept ISO timestamps", () => {
			const now = new Date().toISOString();
			const state = ContentStateSchema.parse({
				lastScanAt: now,
				lastEngagementCheckAt: now,
			});
			expect(state.lastScanAt).toBe(now);
			expect(state.lastEngagementCheckAt).toBe(now);
		});

		test("should accept event IDs in processedEvents", () => {
			const state = ContentStateSchema.parse({
				processedEvents: ["event-1", "event-2", "event-3"],
			});
			expect(state.processedEvents).toEqual(["event-1", "event-2", "event-3"]);
		});

		test("should accept content IDs in contentQueue", () => {
			const state = ContentStateSchema.parse({
				contentQueue: [1, 2, 3, 4, 5],
			});
			expect(state.contentQueue).toEqual([1, 2, 3, 4, 5]);
		});

		test("should accept daily post counts by platform-date key", () => {
			const state = ContentStateSchema.parse({
				dailyPostCounts: {
					"x-2026-03-04": 3,
					"facebook-2026-03-04": 1,
					"x_thread-2026-03-03": 2,
				},
			});
			expect(state.dailyPostCounts["x-2026-03-04"]).toBe(3);
			expect(state.dailyPostCounts["facebook-2026-03-04"]).toBe(1);
		});

		test("should set currentlyCreating to null or number", () => {
			const state1 = ContentStateSchema.parse({ currentlyCreating: null });
			expect(state1.currentlyCreating).toBeNull();

			const state2 = ContentStateSchema.parse({ currentlyCreating: 42 });
			expect(state2.currentlyCreating).toBe(42);
		});
	});
});
