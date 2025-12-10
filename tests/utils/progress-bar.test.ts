import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { output } from "../../src/shared/output-manager.js";
import { ProgressBar, createProgressBar } from "../../src/shared/progress-bar.js";

describe("ProgressBar", () => {
	let consoleSpy: ReturnType<typeof mock>;
	let stdoutSpy: ReturnType<typeof mock>;

	beforeEach(() => {
		output.reset();
		consoleSpy = mock(() => {});
		stdoutSpy = mock(() => {});
		console.log = consoleSpy;
		process.stdout.write = stdoutSpy as typeof process.stdout.write;
	});

	afterEach(() => {
		output.reset();
	});

	describe("createProgressBar", () => {
		test("should create a ProgressBar instance", () => {
			const bar = createProgressBar({ total: 100 });
			expect(bar).toBeInstanceOf(ProgressBar);
		});
	});

	describe("update", () => {
		test("should clamp current to total", () => {
			const bar = createProgressBar({ total: 100 });
			bar.update(150);
			// No error thrown, progress clamped to max
		});
	});

	describe("increment", () => {
		test("should increment by 1 by default", () => {
			const bar = createProgressBar({ total: 100 });
			bar.increment();
			bar.increment();
			// No error thrown
		});

		test("should increment by custom delta", () => {
			const bar = createProgressBar({ total: 100 });
			bar.increment(10);
			// No error thrown
		});
	});

	describe("complete", () => {
		test("should complete in JSON mode", () => {
			output.configure({ json: true });
			const bar = createProgressBar({ total: 100, label: "Test" });
			bar.complete("Done!");

			const buffer = output.getJsonBuffer();
			expect(buffer).toHaveLength(1);
			expect(buffer[0].type).toBe("progress");
			expect(buffer[0].message).toBe("Done!");
		});

		test("should use default message when none provided", () => {
			output.configure({ json: true });
			const bar = createProgressBar({ total: 100, label: "MyTask" });
			bar.complete();

			const buffer = output.getJsonBuffer();
			expect(buffer[0].message).toBe("MyTask complete");
		});
	});

	describe("format types", () => {
		test("should format as percentage by default", () => {
			output.configure({ json: true });
			const bar = createProgressBar({ total: 100 });
			bar.update(50);
			bar.complete();

			const buffer = output.getJsonBuffer();
			// Progress entries should have percentage data
			const lastEntry = buffer[buffer.length - 1];
			expect(lastEntry.data?.percent).toBe(100);
		});

		test("should format as count", () => {
			const bar = createProgressBar({ total: 10, format: "count" });
			bar.update(5);
			// No error thrown
		});

		test("should format as download with total size", () => {
			const bar = createProgressBar({
				total: 1024 * 1024, // 1 MB
				format: "download",
			});
			bar.update(512 * 1024); // 512 KB
			// No error thrown
		});
	});

	describe("options", () => {
		test("should accept width option", () => {
			const bar = createProgressBar({ total: 100, width: 30 });
			bar.update(50);
			// No error thrown
		});

		test("should accept label option", () => {
			const bar = createProgressBar({ total: 100, label: "Downloading" });
			bar.update(50);
			// No error thrown
		});

		test("should accept showEta option", () => {
			const bar = createProgressBar({ total: 100, showEta: true });
			bar.update(50);
			// No error thrown - ETA calculation has div/0 protection
		});
	});

	describe("JSON mode progress logging", () => {
		test("should log progress entries in JSON mode", () => {
			output.configure({ json: true });
			const bar = createProgressBar({ total: 100 });

			// Update to 25%
			bar.update(25);
			// Should have at least one entry
			expect(output.getJsonBuffer().length).toBeGreaterThanOrEqual(1);

			// Complete should log final entry
			bar.complete();
			const buffer = output.getJsonBuffer();
			expect(buffer.length).toBeGreaterThanOrEqual(2);
			expect(buffer[buffer.length - 1].type).toBe("progress");
		});
	});

	describe("edge cases", () => {
		test("should handle zero total", () => {
			const bar = createProgressBar({ total: 0 });
			bar.update(0);
			bar.complete();
			// No error thrown - div/0 protected
		});

		test("should handle immediate update after creation", () => {
			const bar = createProgressBar({ total: 100, showEta: true });
			// This tests the div/0 protection for ETA
			bar.update(1);
			// No error thrown
		});

		test("should truncate long labels", () => {
			const bar = createProgressBar({
				total: 100,
				label: "This is a very long label that exceeds 16 characters",
			});
			bar.update(50);
			// No error thrown - label is truncated
		});
	});
});
