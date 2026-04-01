import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CkConfigManager } from "@/domains/config/ck-config-manager.js";

describe("CkConfigManager", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = join(
			tmpdir(),
			`ck-config-manager-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		await mkdir(join(testDir, ".claude"), { recursive: true });
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	test("loads project config files that contain legacy Gemini model ids", async () => {
		await writeFile(
			join(testDir, ".claude", ".ck.json"),
			JSON.stringify({
				gemini: {
					model: "gemini-3.0-flash",
				},
				updatePipeline: {
					autoInitAfterUpdate: true,
				},
			}),
		);

		const config = await CkConfigManager.loadScope("project", testDir);

		expect(config).not.toBeNull();
		expect(config?.gemini?.model).toBe("gemini-3-flash-preview");
		expect(config?.updatePipeline?.autoInitAfterUpdate).toBe(true);
	});

	test("normalizes legacy Gemini ids when loading merged config", async () => {
		await writeFile(
			join(testDir, ".claude", ".ck.json"),
			JSON.stringify({
				gemini: {
					model: "gemini-3.0-pro",
				},
				skills: {
					research: {
						useGemini: false,
					},
				},
			}),
		);

		const result = await CkConfigManager.loadFull(testDir);

		expect(result.config.gemini?.model).toBe("gemini-3-pro-preview");
		expect(result.config.skills?.research?.useGemini).toBe(false);
		expect(result.sources["gemini.model"]).toBe("project");
	});
});
