/**
 * Tests for prefix-applier.ts
 *
 * Covers:
 * - All entries (including mkt/) get wrapped into ck/
 * - Idempotency (running twice doesn't double-nest)
 * - Edge cases (empty dir, missing dir, symlinks)
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyPrefix } from "@/services/transformers/commands-prefix/prefix-applier.js";
import { pathExists, readdir, remove } from "fs-extra";

describe("applyPrefix", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "prefix-applier-test-"));
	});

	afterEach(async () => {
		if (await pathExists(tempDir)) {
			await remove(tempDir);
		}
	});

	describe("wraps all entries into ck/", () => {
		it("wraps flat command files into ck/", async () => {
			const commandsDir = join(tempDir, ".claude", "commands");
			await mkdir(commandsDir, { recursive: true });
			await writeFile(join(commandsDir, "plan.md"), "# Plan");
			await writeFile(join(commandsDir, "fix.md"), "# Fix");

			await applyPrefix(tempDir);

			expect(await pathExists(join(commandsDir, "ck", "plan.md"))).toBe(true);
			expect(await pathExists(join(commandsDir, "ck", "fix.md"))).toBe(true);
			// Originals gone
			expect(await pathExists(join(commandsDir, "plan.md"))).toBe(false);
		});

		it("wraps mkt/ directory into ck/mkt/", async () => {
			// Marketing kit's pre-prefixed mkt/ should end up inside ck/
			const commandsDir = join(tempDir, ".claude", "commands");
			const mktDir = join(commandsDir, "mkt");
			await mkdir(mktDir, { recursive: true });
			await writeFile(join(mktDir, "email.md"), "# Email command");
			await writeFile(join(mktDir, "campaign.md"), "# Campaign command");

			await applyPrefix(tempDir);

			// mkt/ should be inside ck/
			expect(await pathExists(join(commandsDir, "ck", "mkt", "email.md"))).toBe(true);
			expect(await pathExists(join(commandsDir, "ck", "mkt", "campaign.md"))).toBe(true);
			// Top-level mkt/ should be gone
			expect(await pathExists(join(commandsDir, "mkt"))).toBe(false);
		});

		it("wraps subdirectories into ck/", async () => {
			const commandsDir = join(tempDir, ".claude", "commands");
			const bootstrapDir = join(commandsDir, "bootstrap");
			await mkdir(bootstrapDir, { recursive: true });
			await writeFile(join(bootstrapDir, "auto.md"), "# Auto bootstrap");

			await applyPrefix(tempDir);

			expect(await pathExists(join(commandsDir, "ck", "bootstrap", "auto.md"))).toBe(true);
		});

		it("wraps mixed files and mkt/ together under ck/", async () => {
			const commandsDir = join(tempDir, ".claude", "commands");
			const mktDir = join(commandsDir, "mkt");
			await mkdir(mktDir, { recursive: true });
			await writeFile(join(mktDir, "email.md"), "# Email");
			await writeFile(join(commandsDir, "plan.md"), "# Plan");

			await applyPrefix(tempDir);

			// Both under ck/
			expect(await pathExists(join(commandsDir, "ck", "plan.md"))).toBe(true);
			expect(await pathExists(join(commandsDir, "ck", "mkt", "email.md"))).toBe(true);

			// Only ck/ at top level
			const entries = await readdir(commandsDir);
			expect(entries).toEqual(["ck"]);
		});
	});

	describe("idempotency", () => {
		it("running twice doesn't double-nest ck/", async () => {
			const commandsDir = join(tempDir, ".claude", "commands");
			await mkdir(commandsDir, { recursive: true });
			await writeFile(join(commandsDir, "plan.md"), "# Plan");

			await applyPrefix(tempDir);
			await applyPrefix(tempDir);

			expect(await pathExists(join(commandsDir, "ck", "plan.md"))).toBe(true);
			expect(await pathExists(join(commandsDir, "ck", "ck", "plan.md"))).toBe(false);
		});

		it("detects already-prefixed state (only ck/ exists)", async () => {
			const commandsDir = join(tempDir, ".claude", "commands");
			const ckDir = join(commandsDir, "ck");
			await mkdir(ckDir, { recursive: true });
			await writeFile(join(ckDir, "plan.md"), "# Plan");

			// Should be a no-op
			await applyPrefix(tempDir);

			expect(await pathExists(join(commandsDir, "ck", "plan.md"))).toBe(true);
			expect(await pathExists(join(commandsDir, "ck", "ck"))).toBe(false);
		});
	});

	describe("edge cases", () => {
		it("handles empty commands directory", async () => {
			const commandsDir = join(tempDir, ".claude", "commands");
			await mkdir(commandsDir, { recursive: true });

			await expect(applyPrefix(tempDir)).resolves.toBeUndefined();
		});

		it("handles missing commands directory", async () => {
			await mkdir(join(tempDir, ".claude"), { recursive: true });

			await expect(applyPrefix(tempDir)).resolves.toBeUndefined();
		});
	});
});
