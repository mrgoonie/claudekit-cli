/**
 * Tests for opencode-config-installer.ts
 * Covers: fresh install, existing valid/invalid model, non-interactive fail-fast,
 * interactive rewrite/keep, .ck.json override wins.
 */
import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTaxonomyOverrides } from "@/commands/portable/model-taxonomy.js";
import type { FetchFn, ModelsDevCatalog } from "@/commands/portable/models-dev-cache.js";
import {
	type EnsureOpenCodeModelOptions,
	OpenCodeAuthRequiredError,
	type OpenCodeModelPrompter,
	ensureOpenCodeModel,
} from "@/commands/portable/opencode-config-installer.js";
import { logger } from "@/shared/logger.js";

// ---- Fixtures / Catalog ----

const CATALOG: ModelsDevCatalog = {
	opencode: {
		id: "opencode",
		name: "OpenCode Zen",
		models: {
			"qwen3.5-plus-free": {
				id: "qwen3.5-plus-free",
				tool_call: true,
				release_date: "2025-06-15",
			},
			"glm-4.7-free": {
				id: "glm-4.7-free",
				tool_call: true,
				release_date: "2025-05-01",
			},
		},
	},
	anthropic: {
		id: "anthropic",
		name: "Anthropic",
		models: {
			"claude-sonnet-4-6": {
				id: "claude-sonnet-4-6",
				tool_call: true,
				release_date: "2025-03-01",
			},
		},
	},
};

function makeOkFetcher(catalog: ModelsDevCatalog): FetchFn {
	return async (_input, _init) =>
		new Response(JSON.stringify(catalog), {
			status: 200,
			headers: { "content-type": "application/json" },
		});
}

// ---- Helpers ----

async function makeTmpHome(): Promise<string> {
	return mkdtemp(join(tmpdir(), "ck-installer-test-home-"));
}

async function makeLocalDir(): Promise<string> {
	return mkdtemp(join(tmpdir(), "ck-installer-test-local-"));
}

async function writeAuthJson(homeDir: string, providers: Record<string, unknown>): Promise<void> {
	const authDir = join(homeDir, ".local", "share", "opencode");
	await mkdir(authDir, { recursive: true });
	await writeFile(join(authDir, "auth.json"), JSON.stringify(providers), "utf-8");
}

async function writeOpencodeJson(dir: string, content: Record<string, unknown>): Promise<void> {
	await writeFile(join(dir, "opencode.json"), JSON.stringify(content), "utf-8");
}

const skipPrompter: OpenCodeModelPrompter = async () => ({ action: "skip" });
const acceptPrompter: OpenCodeModelPrompter = async () => ({ action: "accept" });
function customPrompter(value: string): OpenCodeModelPrompter {
	return async () => ({ action: "custom", value });
}
// ---- Tests ----

describe("ensureOpenCodeModel", () => {
	let homeDir: string;
	let localDir: string;
	let cacheDir: string;

	beforeEach(async () => {
		homeDir = await makeTmpHome();
		localDir = await makeLocalDir();
		cacheDir = await mkdtemp(join(tmpdir(), "ck-installer-cache-"));
		// Reset taxonomy overrides
		setTaxonomyOverrides(undefined);
	});

	afterEach(async () => {
		await rm(homeDir, { recursive: true, force: true });
		await rm(localDir, { recursive: true, force: true });
		await rm(cacheDir, { recursive: true, force: true });
		setTaxonomyOverrides(undefined);
	});

	function makeOpts(
		overrides: Partial<EnsureOpenCodeModelOptions> = {},
	): EnsureOpenCodeModelOptions {
		return {
			global: false,
			cwd: localDir,
			homeDir,
			cacheDir,
			fetcher: makeOkFetcher(CATALOG),
			...overrides,
		};
	}

	// ---- Non-interactive fail-fast ----

	it("non-interactive + no auth.json — throws OpenCodeAuthRequiredError", async () => {
		await expect(ensureOpenCodeModel(makeOpts({ interactive: false }))).rejects.toBeInstanceOf(
			OpenCodeAuthRequiredError,
		);
	});

	it("non-interactive + empty auth.json — throws OpenCodeAuthRequiredError", async () => {
		await writeAuthJson(homeDir, {});
		await expect(ensureOpenCodeModel(makeOpts({ interactive: false }))).rejects.toBeInstanceOf(
			OpenCodeAuthRequiredError,
		);
	});

	it("non-interactive + opencode auth'd — writes discovered model", async () => {
		await writeAuthJson(homeDir, { opencode: { token: "tok" } });

		const result = await ensureOpenCodeModel(makeOpts({ interactive: false }));

		expect(result.action).toBeOneOf(["added", "created"]);
		expect(result.model).toStartWith("opencode/");
		// Verify file was written
		const written = JSON.parse(await readFile(join(localDir, "opencode.json"), "utf-8")) as Record<
			string,
			unknown
		>;
		expect(typeof written.model).toBe("string");
	});

	// ---- Existing valid model ----

	it("existing opencode.json with valid model (catalog match) — preserved, action = existing", async () => {
		await writeOpencodeJson(localDir, { model: "opencode/qwen3.5-plus-free" });
		await writeAuthJson(homeDir, { opencode: { token: "tok" } });

		const result = await ensureOpenCodeModel(makeOpts({ interactive: false }));

		expect(result.action).toBe("existing");
		expect(result.model).toBe("opencode/qwen3.5-plus-free");
	});

	it("existing opencode.json with anthropic valid model — preserved", async () => {
		await writeOpencodeJson(localDir, { model: "anthropic/claude-sonnet-4-6" });
		await writeAuthJson(homeDir, { anthropic: { token: "ant" } });

		const result = await ensureOpenCodeModel(makeOpts({ interactive: false }));

		expect(result.action).toBe("existing");
		expect(result.model).toBe("anthropic/claude-sonnet-4-6");
	});

	// ---- Existing INVALID model (no catalog match) ----

	it("existing invalid model + non-interactive — kept as-is + loud warning logged", async () => {
		// Simulates user who had old hardcoded anthropic/claude-sonnet-4-6
		// but now only has opencode auth
		await writeOpencodeJson(localDir, { model: "anthropic/claude-sonnet-4-6" });
		await writeAuthJson(homeDir, { opencode: { token: "tok" } });

		// Catalog only has opencode provider — anthropic not listed
		const catalogWithoutAnthropic: ModelsDevCatalog = {
			opencode: CATALOG.opencode,
		};
		const warnSpy = spyOn(logger, "warning");

		const result = await ensureOpenCodeModel(
			makeOpts({
				interactive: false,
				fetcher: makeOkFetcher(catalogWithoutAnthropic),
			}),
		);

		// Kept as-is
		expect(result.action).toBe("existing");
		expect(result.model).toBe("anthropic/claude-sonnet-4-6");
		expect(warnSpy).toHaveBeenCalled();

		warnSpy.mockRestore();
	});

	it("existing invalid model + interactive + user picks rewrite — overwritten with discovery suggestion", async () => {
		await writeOpencodeJson(localDir, { model: "anthropic/claude-sonnet-4-6" });
		await writeAuthJson(homeDir, { opencode: { token: "tok" } });

		const catalogWithoutAnthropic: ModelsDevCatalog = {
			opencode: CATALOG.opencode,
		};

		// Prompter always accepts suggestion (rewrite)
		const result = await ensureOpenCodeModel(
			makeOpts({
				interactive: true,
				fetcher: makeOkFetcher(catalogWithoutAnthropic),
				prompter: acceptPrompter,
			}),
		);

		expect(result.model).toStartWith("opencode/");
		expect(result.action).toBeOneOf(["added", "created", "existing"]);
		// Verify file was rewritten
		const written = JSON.parse(await readFile(join(localDir, "opencode.json"), "utf-8")) as Record<
			string,
			unknown
		>;
		expect(written.model).toStartWith("opencode/");
	});

	it("existing invalid model + interactive + user picks keep — preserved", async () => {
		await writeOpencodeJson(localDir, { model: "anthropic/claude-sonnet-4-6" });
		await writeAuthJson(homeDir, { opencode: { token: "tok" } });

		const catalogWithoutAnthropic: ModelsDevCatalog = {
			opencode: CATALOG.opencode,
		};

		const result = await ensureOpenCodeModel(
			makeOpts({
				interactive: true,
				fetcher: makeOkFetcher(catalogWithoutAnthropic),
				prompter: skipPrompter,
			}),
		);

		// User skipped — keep existing
		expect(result.model).toBe("anthropic/claude-sonnet-4-6");
	});

	// ---- .ck.json override wins ----

	it(".ck.json override set — wins over discovery, no auth check", async () => {
		// Override is set via taxonomy
		setTaxonomyOverrides({
			opencode: {
				default: { model: "custom/my-override-model" },
			},
		});

		// No auth.json exists — but override should win
		const result = await ensureOpenCodeModel(
			makeOpts({
				interactive: false,
				// No auth needed when override is set
			}),
		);

		expect(result.model).toBe("custom/my-override-model");
		expect(result.action).toBeOneOf(["added", "created"]);
	});

	// ---- Interactive mode — no model, user skips ----

	it("interactive + no model + user skips — returns skipped action", async () => {
		await writeAuthJson(homeDir, { opencode: { token: "tok" } });

		const result = await ensureOpenCodeModel(
			makeOpts({
				interactive: true,
				prompter: skipPrompter,
			}),
		);

		expect(result.action).toBe("skipped");
		expect(result.model).toBe("");
	});

	it("interactive + no model + user enters custom — writes custom model", async () => {
		await writeAuthJson(homeDir, { opencode: { token: "tok" } });

		const result = await ensureOpenCodeModel(
			makeOpts({
				interactive: true,
				prompter: customPrompter("myco/best-model"),
			}),
		);

		expect(result.action).toBeOneOf(["added", "created"]);
		expect(result.model).toBe("myco/best-model");
	});
});
