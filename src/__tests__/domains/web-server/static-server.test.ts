import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveUiDistPath } from "@/domains/web-server/static-server.js";

const originalArgv1 = process.argv[1];

describe("resolveUiDistPath", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		process.argv[1] = originalArgv1;
		for (const dir of tempDirs) {
			rmSync(dir, { force: true, recursive: true });
		}
		tempDirs.length = 0;
	});

	function createPackagedUiLayout(): string {
		const packageRoot = mkdtempSync(join(tmpdir(), "ck-static-ui-"));
		tempDirs.push(packageRoot);
		mkdirSync(join(packageRoot, "bin"), { recursive: true });
		mkdirSync(join(packageRoot, "dist", "ui"), { recursive: true });
		writeFileSync(join(packageRoot, "dist", "ui", "index.html"), "<html>dashboard</html>");
		return packageRoot;
	}

	test("resolves dist/ui relative to the invoked dist entrypoint", () => {
		const packageRoot = createPackagedUiLayout();
		process.argv[1] = join(packageRoot, "dist", "index.js");

		expect(resolveUiDistPath()).toBe(join(packageRoot, "dist", "ui"));
	});

	test("resolves dist/ui relative to the bin/ wrapper path", () => {
		const packageRoot = createPackagedUiLayout();
		process.argv[1] = join(packageRoot, "bin", "ck.js");

		expect(resolveUiDistPath()).toBe(join(packageRoot, "dist", "ui"));
	});
});
