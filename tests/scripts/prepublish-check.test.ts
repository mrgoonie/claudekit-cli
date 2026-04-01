import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertNodeCompatibleBundle } from "../../scripts/prepublish-check.js";

describe("assertNodeCompatibleBundle", () => {
	test("allows Node-safe bundles", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "ck-prepublish-safe-"));
		const bundlePath = join(tempDir, "index.js");

		try {
			writeFileSync(
				bundlePath,
				[
					'if (typeof Bun !== "undefined") {',
					"\tconsole.log(Bun.version);",
					"}",
					'await import("node:fs");',
				].join("\n"),
			);

			expect(() => assertNodeCompatibleBundle(bundlePath)).not.toThrow();
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	test("rejects bun: protocol imports", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "ck-prepublish-bun-import-"));
		const bundlePath = join(tempDir, "index.js");

		try {
			writeFileSync(bundlePath, 'import { Database } from "bun:sqlite";');
			expect(() => assertNodeCompatibleBundle(bundlePath)).toThrow("bun: protocol import");
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	test("rejects Bun.file runtime usage", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "ck-prepublish-bun-file-"));
		const bundlePath = join(tempDir, "index.js");

		try {
			writeFileSync(bundlePath, 'const raw = await Bun.file("settings.json").text();');
			expect(() => assertNodeCompatibleBundle(bundlePath)).toThrow("Bun.file runtime API");
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});
});
