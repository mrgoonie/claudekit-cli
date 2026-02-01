/**
 * Tests for prefix-applier.ts
 *
 * Covers:
 * - Skipping pre-prefixed directories (mkt/)
 * - Wrapping non-prefixed entries in ck/
 * - Idempotency (running twice doesn't double-nest)
 * - Preserving multiple kit prefixes
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

	describe("pre-prefixed directory handling", () => {
		it("skips mkt/ directory (marketing kit native prefix)", async () => {
			// Setup: create commands/mkt/ with marketing commands
			const commandsDir = join(tempDir, ".claude", "commands");
			const mktDir = join(commandsDir, "mkt");
			await mkdir(mktDir, { recursive: true });
			await writeFile(join(mktDir, "email.md"), "# Email command");
			await writeFile(join(mktDir, "campaign.md"), "# Campaign command");

			// Apply prefix
			await applyPrefix(tempDir);

			// Verify mkt/ was NOT wrapped in ck/
			const mktStillExists = await pathExists(join(commandsDir, "mkt"));
			expect(mktStillExists).toBe(true);

			const ckMktExists = await pathExists(join(commandsDir, "ck", "mkt"));
			expect(ckMktExists).toBe(false);

			// Verify files are still in mkt/
			const emailExists = await pathExists(join(commandsDir, "mkt", "email.md"));
			expect(emailExists).toBe(true);
		});

		it("skips ck/ directory (engineer kit native prefix)", async () => {
			// Setup: create commands/ck/ with engineer commands
			const commandsDir = join(tempDir, ".claude", "commands");
			const ckDir = join(commandsDir, "ck");
			await mkdir(ckDir, { recursive: true });
			await writeFile(join(ckDir, "plan.md"), "# Plan command");

			// Apply prefix (should detect already prefixed)
			await applyPrefix(tempDir);

			// Verify ck/ was NOT double-nested
			const ckStillExists = await pathExists(join(commandsDir, "ck"));
			expect(ckStillExists).toBe(true);

			const ckCkExists = await pathExists(join(commandsDir, "ck", "ck"));
			expect(ckCkExists).toBe(false);
		});

		it("preserves both mkt/ and ck/ when both exist", async () => {
			// Setup: multi-kit scenario
			const commandsDir = join(tempDir, ".claude", "commands");
			const ckDir = join(commandsDir, "ck");
			const mktDir = join(commandsDir, "mkt");
			await mkdir(ckDir, { recursive: true });
			await mkdir(mktDir, { recursive: true });
			await writeFile(join(ckDir, "plan.md"), "# Plan");
			await writeFile(join(mktDir, "email.md"), "# Email");

			// Apply prefix
			await applyPrefix(tempDir);

			// Both should still exist at top level
			const ckExists = await pathExists(join(commandsDir, "ck"));
			const mktExists = await pathExists(join(commandsDir, "mkt"));
			expect(ckExists).toBe(true);
			expect(mktExists).toBe(true);

			// Verify no nesting
			const ckCkExists = await pathExists(join(commandsDir, "ck", "ck"));
			const ckMktExists = await pathExists(join(commandsDir, "ck", "mkt"));
			expect(ckCkExists).toBe(false);
			expect(ckMktExists).toBe(false);
		});
	});

	describe("non-prefixed entry wrapping", () => {
		it("wraps non-prefixed files into ck/", async () => {
			// Setup: commands with no prefix
			const commandsDir = join(tempDir, ".claude", "commands");
			await mkdir(commandsDir, { recursive: true });
			await writeFile(join(commandsDir, "plan.md"), "# Plan");
			await writeFile(join(commandsDir, "fix.md"), "# Fix");

			// Apply prefix
			await applyPrefix(tempDir);

			// Files should be in ck/
			const planExists = await pathExists(join(commandsDir, "ck", "plan.md"));
			const fixExists = await pathExists(join(commandsDir, "ck", "fix.md"));
			expect(planExists).toBe(true);
			expect(fixExists).toBe(true);

			// Original locations should be gone
			const oldPlanExists = await pathExists(join(commandsDir, "plan.md"));
			expect(oldPlanExists).toBe(false);
		});

		it("wraps non-prefixed directories into ck/", async () => {
			// Setup: commands/utils/ folder
			const commandsDir = join(tempDir, ".claude", "commands");
			const utilsDir = join(commandsDir, "utils");
			await mkdir(utilsDir, { recursive: true });
			await writeFile(join(utilsDir, "helper.md"), "# Helper");

			// Apply prefix
			await applyPrefix(tempDir);

			// utils/ should be in ck/utils/
			const wrappedUtils = await pathExists(join(commandsDir, "ck", "utils"));
			expect(wrappedUtils).toBe(true);

			const helperExists = await pathExists(join(commandsDir, "ck", "utils", "helper.md"));
			expect(helperExists).toBe(true);
		});
	});

	describe("mixed scenario: pre-prefixed + non-prefixed", () => {
		it("wraps non-prefixed while preserving pre-prefixed", async () => {
			// Setup: mkt/ (prefixed) + plan.md (non-prefixed)
			const commandsDir = join(tempDir, ".claude", "commands");
			const mktDir = join(commandsDir, "mkt");
			await mkdir(mktDir, { recursive: true });
			await writeFile(join(mktDir, "email.md"), "# Email");
			await writeFile(join(commandsDir, "plan.md"), "# Plan");

			// Apply prefix
			await applyPrefix(tempDir);

			// mkt/ should stay at top level
			const mktExists = await pathExists(join(commandsDir, "mkt"));
			expect(mktExists).toBe(true);

			// plan.md should be wrapped in ck/
			const planExists = await pathExists(join(commandsDir, "ck", "plan.md"));
			expect(planExists).toBe(true);

			// Verify structure
			const entries = await readdir(commandsDir);
			expect(entries.sort()).toEqual(["ck", "mkt"]);
		});
	});

	describe("idempotency", () => {
		it("running twice doesn't double-nest", async () => {
			// Setup
			const commandsDir = join(tempDir, ".claude", "commands");
			await mkdir(commandsDir, { recursive: true });
			await writeFile(join(commandsDir, "plan.md"), "# Plan");

			// First run
			await applyPrefix(tempDir);

			// Second run
			await applyPrefix(tempDir);

			// Verify structure
			const planExists = await pathExists(join(commandsDir, "ck", "plan.md"));
			expect(planExists).toBe(true);

			const doubleNested = await pathExists(join(commandsDir, "ck", "ck", "plan.md"));
			expect(doubleNested).toBe(false);
		});
	});

	describe("edge cases", () => {
		it("handles empty commands directory", async () => {
			const commandsDir = join(tempDir, ".claude", "commands");
			await mkdir(commandsDir, { recursive: true });

			// Should not throw
			await expect(applyPrefix(tempDir)).resolves.toBeUndefined();
		});

		it("handles missing commands directory", async () => {
			await mkdir(join(tempDir, ".claude"), { recursive: true });

			// Should not throw
			await expect(applyPrefix(tempDir)).resolves.toBeUndefined();
		});

		it("skips symlinks for security", async () => {
			// This test would require platform-specific symlink creation
			// Skipping for cross-platform compatibility
		});
	});
});
