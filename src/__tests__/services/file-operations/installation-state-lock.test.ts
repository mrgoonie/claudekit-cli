import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acquireInstallationStateLock } from "@/services/file-operations/installation-state-lock.js";

describe("installation state lock", () => {
	let rootDir: string;

	beforeEach(async () => {
		rootDir = join(tmpdir(), `installation-lock-${Date.now()}`);
		await mkdir(rootDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(rootDir, { recursive: true, force: true });
	});

	test("canonicalizes symlinked installation paths to the same lock", async () => {
		if (process.platform === "win32") {
			return;
		}

		const actualDir = join(rootDir, "actual");
		const aliasDir = join(rootDir, "alias");
		await mkdir(actualDir, { recursive: true });
		await symlink(actualDir, aliasDir);

		const release = await acquireInstallationStateLock(actualDir);

		try {
			await expect(acquireInstallationStateLock(aliasDir)).rejects.toThrow(
				"Lock file is already being held",
			);
		} finally {
			await release();
		}
	});
});
