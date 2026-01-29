import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { access, rm } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";
import { withProcessLock } from "@/shared/process-lock";

const LOCKS_DIR = join(os.homedir(), ".claudekit", "locks");

describe("withProcessLock", () => {
	beforeEach(async () => {
		// Clean locks dir before each test
		await rm(LOCKS_DIR, { recursive: true, force: true });
	});

	afterEach(async () => {
		// Clean up after tests
		await rm(LOCKS_DIR, { recursive: true, force: true });
	});

	it("should execute function and return result", async () => {
		const result = await withProcessLock("test-1", async () => "success");
		expect(result).toBe("success");
	});

	it("should release lock after successful execution", async () => {
		await withProcessLock("test-2", async () => {});
		// Second call should succeed (lock released)
		const result = await withProcessLock("test-2", async () => "second");
		expect(result).toBe("second");
	});

	it("should release lock after error", async () => {
		try {
			await withProcessLock("test-3", async () => {
				throw new Error("test error");
			});
		} catch {}
		// Lock should be released despite error
		const result = await withProcessLock("test-3", async () => "recovered");
		expect(result).toBe("recovered");
	});

	it("should block concurrent execution with clear error", async () => {
		let innerComplete = false;
		const slowFn = async () => {
			await new Promise((r) => setTimeout(r, 100));
			innerComplete = true;
			return "slow";
		};

		// Start slow operation
		const p1 = withProcessLock("test-4", slowFn);
		await new Promise((r) => setTimeout(r, 10)); // Let lock acquire

		// Try concurrent access
		await expect(withProcessLock("test-4", async () => "fast")).rejects.toThrow(
			/Another ClaudeKit process is running/,
		);

		await p1; // Wait for slow to complete
		expect(innerComplete).toBe(true);
	});

	it("should allow different lock names concurrently", async () => {
		const results: string[] = [];
		await Promise.all([
			withProcessLock("lock-a", async () => {
				results.push("a");
			}),
			withProcessLock("lock-b", async () => {
				results.push("b");
			}),
		]);
		expect(results).toContain("a");
		expect(results).toContain("b");
	});

	it("should create locks directory if missing", async () => {
		await rm(LOCKS_DIR, { recursive: true, force: true });
		await withProcessLock("test-dir", async () => {});
		// access() resolves without error if directory exists
		await expect(access(LOCKS_DIR)).resolves.toBeDefined();
	});

	it("should register exit cleanup handler", async () => {
		await withProcessLock("test-handler", async () => {});
		// Verify at least one exit listener exists from process-lock module
		const exitListeners = process.listeners("exit");
		expect(exitListeners.length).toBeGreaterThan(0);
	});

	it("should not leave lock file on disk after error", async () => {
		try {
			await withProcessLock("test-cleanup", async () => {
				throw new Error("simulated crash");
			});
		} catch {}
		// Lock file should not exist — proper-lockfile creates a .lock dir
		const lockPath = join(LOCKS_DIR, "test-cleanup.lock");
		await expect(access(lockPath)).rejects.toThrow();
	});
});
