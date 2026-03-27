/**
 * Unit tests for maintainer-resolver
 * Mocks child_process.spawn to avoid real gh CLI calls
 */
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

// Capture the spawn mock reference so individual tests can control it
let spawnImpl: (...args: unknown[]) => unknown;

mock.module("node:child_process", () => ({
	spawn: (...args: unknown[]) => spawnImpl(...args),
}));

// Import after mock is set up
const { resolveMaintainers, clearMaintainerCache } = await import(
	"../../../commands/watch/phases/maintainer-resolver.js"
);

/**
 * Build a fake child_process EventEmitter that returns the given stdout
 */
function makeSpawnMock(stdout: string, exitCode = 0) {
	return () => {
		const stdoutListeners: Array<(chunk: Buffer) => void> = [];
		const stderrListeners: Array<(chunk: Buffer) => void> = [];
		const closeListeners: Array<(code: number) => void> = [];
		const errorListeners: Array<(err: Error) => void> = [];

		const child = {
			stdout: {
				on(event: string, fn: (chunk: Buffer) => void) {
					if (event === "data") stdoutListeners.push(fn);
				},
			},
			stderr: {
				on(event: string, fn: (chunk: Buffer) => void) {
					if (event === "data") stderrListeners.push(fn);
				},
			},
			on(event: string, fn: (...a: unknown[]) => void) {
				if (event === "close") closeListeners.push(fn as (code: number) => void);
				if (event === "error") errorListeners.push(fn as (err: Error) => void);
			},
		};

		// Emit data asynchronously so listeners are registered first
		Promise.resolve().then(() => {
			for (const fn of stdoutListeners) fn(Buffer.from(stdout));
			for (const fn of closeListeners) fn(exitCode);
		});

		return child;
	};
}

describe("resolveMaintainers", () => {
	beforeEach(() => {
		clearMaintainerCache();
	});

	afterEach(() => {
		clearMaintainerCache();
	});

	test("returns collaborators + excludeAuthors merged, lowercased, deduped", async () => {
		spawnImpl = makeSpawnMock(JSON.stringify(["Alice", "Bob"]));

		const result = await resolveMaintainers("owner", "repo", ["bob", "carol"], true);

		expect(result.disabled).toBe(false);
		expect(result.users).toContain("alice");
		expect(result.users).toContain("bob"); // deduped
		expect(result.users).toContain("carol");
		// bob appears in both — should appear once
		expect(result.users.filter((u) => u === "bob").length).toBe(1);
	});

	test("returns cached result within TTL (no second spawn call)", async () => {
		let callCount = 0;
		spawnImpl = () => {
			callCount++;
			return makeSpawnMock(JSON.stringify(["Alice"]))();
		};

		await resolveMaintainers("owner", "repo", [], true);
		const second = await resolveMaintainers("owner", "repo", [], true);

		expect(callCount).toBe(1); // second call hits cache
		expect(second.disabled).toBe(false);
		expect(second.users).toContain("alice");
	});

	test("returns { users: [], disabled: true } on API error", async () => {
		spawnImpl = makeSpawnMock("", 1); // non-zero exit code

		const result = await resolveMaintainers("owner", "repo", [], true);

		expect(result.disabled).toBe(true);
		expect(result.users).toEqual([]);
	});

	test("clearMaintainerCache resets cache", async () => {
		let callCount = 0;
		spawnImpl = () => {
			callCount++;
			return makeSpawnMock(JSON.stringify(["Alice"]))();
		};

		await resolveMaintainers("owner", "repo", [], true);
		clearMaintainerCache();
		await resolveMaintainers("owner", "repo", [], true);

		expect(callCount).toBe(2); // cache was cleared, spawned again
	});

	test("autoDetect=false returns only excludeAuthors, no spawn", async () => {
		let callCount = 0;
		spawnImpl = () => {
			callCount++;
			return makeSpawnMock(JSON.stringify([]))();
		};

		const result = await resolveMaintainers("owner", "repo", ["Maintainer1", "MAINTAINER2"], false);

		expect(callCount).toBe(0);
		expect(result.disabled).toBe(false);
		expect(result.users).toContain("maintainer1");
		expect(result.users).toContain("maintainer2");
	});

	test("different owner/repo keys have separate cache entries", async () => {
		let callCount = 0;
		spawnImpl = () => {
			callCount++;
			return makeSpawnMock(JSON.stringify(["dev"]))();
		};

		await resolveMaintainers("owner1", "repo1", [], true);
		await resolveMaintainers("owner2", "repo2", [], true);
		// Both are first-time calls for their respective keys
		expect(callCount).toBe(2);

		// Third call for owner1/repo1 should use cache
		await resolveMaintainers("owner1", "repo1", [], true);
		expect(callCount).toBe(2);
	});
});
