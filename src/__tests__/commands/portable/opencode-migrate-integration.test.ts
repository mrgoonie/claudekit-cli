/**
 * Migration integration tests for opencode default model (Issue #771).
 * Fixture-based: simulates fresh-install and upgrade-from-prior-bad-default scenarios.
 * Required by CLAUDE.md Migration Test Requirement (touches ensureOpenCodeModel).
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

// ---- Fixtures ----

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

// Catalog that does NOT include anthropic — simulates users who only have opencode auth
const CATALOG_OPENCODE_ONLY: ModelsDevCatalog = {
	opencode: CATALOG.opencode,
};

function makeOkFetcher(catalog: ModelsDevCatalog): FetchFn {
	return async (_input, _init) =>
		new Response(JSON.stringify(catalog), {
			status: 200,
			headers: { "content-type": "application/json" },
		});
}

// ---- Helpers ----

async function makeTmpEnv(): Promise<{ homeDir: string; localDir: string; cacheDir: string }> {
	const homeDir = await mkdtemp(join(tmpdir(), "ck-migrate-integ-home-"));
	const localDir = await mkdtemp(join(tmpdir(), "ck-migrate-integ-local-"));
	const cacheDir = await mkdtemp(join(tmpdir(), "ck-migrate-integ-cache-"));
	return { homeDir, localDir, cacheDir };
}

async function writeAuthJson(homeDir: string, providers: Record<string, unknown>): Promise<void> {
	const authDir = join(homeDir, ".local", "share", "opencode");
	await mkdir(authDir, { recursive: true });
	await writeFile(join(authDir, "auth.json"), JSON.stringify(providers), "utf-8");
}

async function writeOpencodeJson(dir: string, content: Record<string, unknown>): Promise<void> {
	await writeFile(join(dir, "opencode.json"), JSON.stringify(content), "utf-8");
}

async function readOpencodeJson(dir: string): Promise<Record<string, unknown>> {
	const raw = await readFile(join(dir, "opencode.json"), "utf-8");
	return JSON.parse(raw) as Record<string, unknown>;
}

const acceptPrompter: OpenCodeModelPrompter = async () => ({ action: "accept" });
const keepPrompter: OpenCodeModelPrompter = async () => ({ action: "skip" });

// ---- Scenario 1: Fresh install ----

describe("Migration integration: fresh install", () => {
	let env: { homeDir: string; localDir: string; cacheDir: string };

	beforeEach(async () => {
		env = await makeTmpEnv();
		setTaxonomyOverrides(undefined);
	});

	afterEach(async () => {
		await rm(env.homeDir, { recursive: true, force: true });
		await rm(env.localDir, { recursive: true, force: true });
		await rm(env.cacheDir, { recursive: true, force: true });
		setTaxonomyOverrides(undefined);
	});

	it("fresh install with opencode auth — writes valid opencode/<free-model>", async () => {
		// Simulate: user has only opencode auth, no existing opencode.json
		await writeAuthJson(env.homeDir, { opencode: { token: "zen-token" } });

		const opts: EnsureOpenCodeModelOptions = {
			global: false,
			cwd: env.localDir,
			homeDir: env.homeDir,
			cacheDir: env.cacheDir,
			fetcher: makeOkFetcher(CATALOG_OPENCODE_ONLY),
			interactive: false,
		};

		const result = await ensureOpenCodeModel(opts);

		expect(result.action).toBe("created");
		expect(result.model).toStartWith("opencode/");
		expect(result.model).toContain("-free");

		// Verify the written file is valid opencode format
		const written = await readOpencodeJson(env.localDir);
		expect(typeof written.model).toBe("string");
		expect((written.model as string).includes("/")).toBe(true);
	});

	it("fresh install with no auth — throws OpenCodeAuthRequiredError (non-interactive)", async () => {
		// No auth.json — non-interactive should fail-fast
		const opts: EnsureOpenCodeModelOptions = {
			global: false,
			cwd: env.localDir,
			homeDir: env.homeDir,
			cacheDir: env.cacheDir,
			fetcher: makeOkFetcher(CATALOG),
			interactive: false,
		};

		await expect(ensureOpenCodeModel(opts)).rejects.toBeInstanceOf(OpenCodeAuthRequiredError);
	});

	it("fresh install with anthropic auth — writes valid anthropic/<model>", async () => {
		await writeAuthJson(env.homeDir, { anthropic: { token: "ant-token" } });

		const opts: EnsureOpenCodeModelOptions = {
			global: false,
			cwd: env.localDir,
			homeDir: env.homeDir,
			cacheDir: env.cacheDir,
			fetcher: makeOkFetcher(CATALOG),
			interactive: false,
		};

		const result = await ensureOpenCodeModel(opts);

		expect(result.action).toBe("created");
		expect(result.model).toStartWith("anthropic/");
	});
});

// ---- Scenario 2: Upgrade from prior bad default ----

describe("Migration integration: upgrade from prior bad default (anthropic/claude-sonnet-4-6)", () => {
	let env: { homeDir: string; localDir: string; cacheDir: string };

	beforeEach(async () => {
		env = await makeTmpEnv();
		setTaxonomyOverrides(undefined);
	});

	afterEach(async () => {
		await rm(env.homeDir, { recursive: true, force: true });
		await rm(env.localDir, { recursive: true, force: true });
		await rm(env.cacheDir, { recursive: true, force: true });
		setTaxonomyOverrides(undefined);
	});

	/**
	 * Simulates the primary Discord-reported failure case:
	 * - opencode.json has the old hardcoded anthropic/claude-sonnet-4-6
	 * - User only has opencode provider auth'd (not anthropic)
	 * - Catalog does NOT list anthropic
	 * => Non-interactive: keep existing + loud warning
	 */
	it("old bad default + only opencode auth + non-interactive — keeps model, logs warning", async () => {
		await writeOpencodeJson(env.localDir, { model: "anthropic/claude-sonnet-4-6" });
		await writeAuthJson(env.homeDir, { opencode: { token: "zen-token" } });

		const warnSpy = spyOn(logger, "warning");

		const opts: EnsureOpenCodeModelOptions = {
			global: false,
			cwd: env.localDir,
			homeDir: env.homeDir,
			cacheDir: env.cacheDir,
			fetcher: makeOkFetcher(CATALOG_OPENCODE_ONLY),
			interactive: false,
		};

		const result = await ensureOpenCodeModel(opts);

		// Must keep existing — do NOT silently overwrite in non-interactive mode
		expect(result.action).toBe("existing");
		expect(result.model).toBe("anthropic/claude-sonnet-4-6");
		// Must warn the user
		expect(warnSpy).toHaveBeenCalled();

		// File should be unchanged
		const written = await readOpencodeJson(env.localDir);
		expect(written.model).toBe("anthropic/claude-sonnet-4-6");

		warnSpy.mockRestore();
	});

	/**
	 * Interactive upgrade: user picks "rewrite" (accept the suggestion).
	 * => opencode.json is overwritten with the discovery suggestion.
	 */
	it("old bad default + only opencode auth + interactive + user picks rewrite — overwrites model", async () => {
		await writeOpencodeJson(env.localDir, { model: "anthropic/claude-sonnet-4-6" });
		await writeAuthJson(env.homeDir, { opencode: { token: "zen-token" } });

		const opts: EnsureOpenCodeModelOptions = {
			global: false,
			cwd: env.localDir,
			homeDir: env.homeDir,
			cacheDir: env.cacheDir,
			fetcher: makeOkFetcher(CATALOG_OPENCODE_ONLY),
			interactive: true,
			prompter: acceptPrompter,
		};

		const result = await ensureOpenCodeModel(opts);

		expect(result.model).toStartWith("opencode/");

		// File should be rewritten
		const written = await readOpencodeJson(env.localDir);
		expect((written.model as string).startsWith("opencode/")).toBe(true);
	});

	/**
	 * Interactive upgrade: user picks "keep".
	 * => opencode.json is preserved as-is.
	 */
	it("old bad default + only opencode auth + interactive + user picks keep — preserved", async () => {
		await writeOpencodeJson(env.localDir, { model: "anthropic/claude-sonnet-4-6" });
		await writeAuthJson(env.homeDir, { opencode: { token: "zen-token" } });

		const opts: EnsureOpenCodeModelOptions = {
			global: false,
			cwd: env.localDir,
			homeDir: env.homeDir,
			cacheDir: env.cacheDir,
			fetcher: makeOkFetcher(CATALOG_OPENCODE_ONLY),
			interactive: true,
			prompter: keepPrompter,
		};

		const result = await ensureOpenCodeModel(opts);

		expect(result.model).toBe("anthropic/claude-sonnet-4-6");

		// File should be unchanged
		const written = await readOpencodeJson(env.localDir);
		expect(written.model).toBe("anthropic/claude-sonnet-4-6");
	});

	/**
	 * Existing model IS valid against catalog — should be left completely untouched
	 * even if it's anthropic, as long as anthropic is in the catalog.
	 */
	it("existing valid anthropic model when anthropic in catalog — preserved without warning", async () => {
		await writeOpencodeJson(env.localDir, { model: "anthropic/claude-sonnet-4-6" });
		await writeAuthJson(env.homeDir, {
			opencode: { token: "tok" },
			anthropic: { token: "ant" },
		});

		const warnSpy = spyOn(logger, "warning");

		const opts: EnsureOpenCodeModelOptions = {
			global: false,
			cwd: env.localDir,
			homeDir: env.homeDir,
			cacheDir: env.cacheDir,
			fetcher: makeOkFetcher(CATALOG), // CATALOG has anthropic
			interactive: false,
		};

		const result = await ensureOpenCodeModel(opts);

		expect(result.action).toBe("existing");
		expect(result.model).toBe("anthropic/claude-sonnet-4-6");
		expect(warnSpy).not.toHaveBeenCalled();

		warnSpy.mockRestore();
	});
});
