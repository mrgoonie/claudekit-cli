import { describe, expect, test } from "bun:test";
import { mapWithLimit } from "@/shared/concurrent-file-ops.js";

describe("mapWithLimit", () => {
	describe("basic functionality", () => {
		test("returns empty array for empty input", async () => {
			const result = await mapWithLimit([], async (x) => x);
			expect(result).toEqual([]);
		});

		test("processes single item", async () => {
			const result = await mapWithLimit([1], async (x) => x * 2);
			expect(result).toEqual([2]);
		});

		test("processes multiple items", async () => {
			const result = await mapWithLimit([1, 2, 3], async (x) => x * 2);
			expect(result).toEqual([2, 4, 6]);
		});

		test("preserves order regardless of completion time", async () => {
			const items = [
				{ delay: 30, index: 0 },
				{ delay: 10, index: 1 },
				{ delay: 20, index: 2 },
			];
			const result = await mapWithLimit(items, async ({ delay, index }) => {
				await new Promise((r) => setTimeout(r, delay));
				return index;
			});
			expect(result).toEqual([0, 1, 2]);
		});
	});

	describe("concurrency limiting", () => {
		test("limits concurrent executions to default (50)", async () => {
			let concurrent = 0;
			let maxConcurrent = 0;
			const items = Array.from({ length: 100 }, (_, i) => i);

			await mapWithLimit(items, async (x) => {
				concurrent++;
				maxConcurrent = Math.max(maxConcurrent, concurrent);
				await new Promise((r) => setTimeout(r, 5));
				concurrent--;
				return x;
			});

			expect(maxConcurrent).toBeLessThanOrEqual(50);
			expect(maxConcurrent).toBeGreaterThan(1);
		});

		test("respects custom concurrency limit", async () => {
			let concurrent = 0;
			let maxConcurrent = 0;
			const items = Array.from({ length: 20 }, (_, i) => i);

			await mapWithLimit(
				items,
				async (x) => {
					concurrent++;
					maxConcurrent = Math.max(maxConcurrent, concurrent);
					await new Promise((r) => setTimeout(r, 10));
					concurrent--;
					return x;
				},
				5,
			);

			expect(maxConcurrent).toBeLessThanOrEqual(5);
		});

		test("handles items equal to concurrency limit", async () => {
			let concurrent = 0;
			let maxConcurrent = 0;
			const items = Array.from({ length: 50 }, (_, i) => i);

			await mapWithLimit(items, async (x) => {
				concurrent++;
				maxConcurrent = Math.max(maxConcurrent, concurrent);
				await new Promise((r) => setTimeout(r, 1));
				concurrent--;
				return x;
			});

			expect(maxConcurrent).toBeLessThanOrEqual(50);
		});

		test("concurrency of 1 processes sequentially", async () => {
			let concurrent = 0;
			let maxConcurrent = 0;
			const items = [1, 2, 3, 4, 5];

			await mapWithLimit(
				items,
				async (x) => {
					concurrent++;
					maxConcurrent = Math.max(maxConcurrent, concurrent);
					await new Promise((r) => setTimeout(r, 5));
					concurrent--;
					return x;
				},
				1,
			);

			expect(maxConcurrent).toBe(1);
		});
	});

	describe("error handling", () => {
		test("propagates error from async function", async () => {
			const items = [1, 2, 3];
			await expect(
				mapWithLimit(items, async (x) => {
					if (x === 2) throw new Error("Test error");
					return x;
				}),
			).rejects.toThrow("Test error");
		});

		test("stops processing on first error", async () => {
			const processed: number[] = [];
			const items = [1, 2, 3, 4, 5];

			try {
				await mapWithLimit(
					items,
					async (x) => {
						await new Promise((r) => setTimeout(r, x * 10));
						if (x === 2) throw new Error("Stop");
						processed.push(x);
						return x;
					},
					2,
				);
			} catch {
				// Expected
			}

			// Item 1 should complete before error, items after may vary
			expect(processed).toContain(1);
		});
	});

	describe("type safety", () => {
		test("handles different input and output types", async () => {
			const items = ["a", "bb", "ccc"];
			const result = await mapWithLimit(items, async (s) => s.length);
			expect(result).toEqual([1, 2, 3]);
		});

		test("handles objects", async () => {
			const items = [{ id: 1 }, { id: 2 }];
			const result = await mapWithLimit(items, async (obj) => ({ ...obj, processed: true }));
			expect(result).toEqual([
				{ id: 1, processed: true },
				{ id: 2, processed: true },
			]);
		});
	});

	describe("large scale", () => {
		test("handles 1000+ items without EMFILE-like issues", async () => {
			const items = Array.from({ length: 1000 }, (_, i) => i);
			let maxConcurrent = 0;
			let concurrent = 0;

			const result = await mapWithLimit(items, async (x) => {
				concurrent++;
				maxConcurrent = Math.max(maxConcurrent, concurrent);
				await new Promise((r) => setImmediate(r));
				concurrent--;
				return x * 2;
			});

			expect(result.length).toBe(1000);
			expect(result[0]).toBe(0);
			expect(result[999]).toBe(1998);
			expect(maxConcurrent).toBeLessThanOrEqual(50);
		});
	});
});
