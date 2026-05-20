import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_KIT_LAYOUT } from "@/types";
import { resolveKitLayout } from "./kit-layout.js";

describe("resolveKitLayout", () => {
	const testDir = join(tmpdir(), "claudekit-kit-layout-test");

	beforeAll(() => {
		mkdirSync(testDir, { recursive: true });
	});

	afterAll(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	it("falls back to default layout when package metadata contains traversal", () => {
		const projectDir = join(testDir, "unsafe-layout");
		mkdirSync(projectDir, { recursive: true });
		writeFileSync(
			join(projectDir, "package.json"),
			JSON.stringify({
				claudekit: {
					sourceDir: "claude",
					runtimeDir: "../../escaped/.claude",
				},
			}),
		);

		expect(resolveKitLayout(projectDir)).toEqual(DEFAULT_KIT_LAYOUT);
	});
});
