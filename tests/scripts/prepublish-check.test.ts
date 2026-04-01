import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertNodeCompatibleBundle } from "../../scripts/prepublish-check.js";
import { synchronizePackageJsonVersion } from "../../scripts/rebuild-after-version-bump.js";

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

	test("reliably detects forbidden patterns across repeated invocations", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "ck-prepublish-repeat-"));
		const bundlePath = join(tempDir, "index.js");

		try {
			writeFileSync(bundlePath, 'import { Database } from "bun:sqlite";');
			expect(() => assertNodeCompatibleBundle(bundlePath)).toThrow("bun: protocol import");
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

	test("rejects Bun.write runtime usage", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "ck-prepublish-bun-write-"));
		const bundlePath = join(tempDir, "index.js");

		try {
			writeFileSync(bundlePath, 'await Bun.write("out.json", data);');
			expect(() => assertNodeCompatibleBundle(bundlePath)).toThrow("Bun.write runtime API");
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});
});

describe("synchronizePackageJsonVersion", () => {
	test("updates package.json before the rebuild step when semantic-release has not yet done it", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "ck-rebuild-version-sync-"));
		const packageJsonPath = join(tempDir, "package.json");

		try {
			writeFileSync(
				packageJsonPath,
				`${JSON.stringify({ name: "claudekit-cli", version: "3.40.1-dev.1" }, null, "\t")}\n`,
			);

			expect(synchronizePackageJsonVersion("3.40.2", packageJsonPath)).toBe(true);
			expect(JSON.parse(readFileSync(packageJsonPath, "utf8")).version).toBe("3.40.2");
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	test("is a no-op when package.json already matches the target release version", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "ck-rebuild-version-noop-"));
		const packageJsonPath = join(tempDir, "package.json");

		try {
			writeFileSync(
				packageJsonPath,
				`${JSON.stringify({ name: "claudekit-cli", version: "3.40.2" }, null, "\t")}\n`,
			);

			expect(synchronizePackageJsonVersion("3.40.2", packageJsonPath)).toBe(false);
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});
});
