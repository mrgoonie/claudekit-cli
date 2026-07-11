import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	handlePluginInstall,
	stagePluginSource,
} from "@/commands/init/phases/plugin-install-handler.js";
import type { InitContext } from "@/commands/init/types.js";
import type {
	CodexPluginInstallResult,
	RemoveCodexPluginResult,
} from "@/domains/installation/plugin/codex-plugin-installer.js";
import type { MigrateResult } from "@/domains/installation/plugin/migrate-legacy-to-plugin.js";
import type { UninstallPluginResult } from "@/domains/installation/plugin/uninstall-plugin.js";

const okResult: MigrateResult = {
	action: "installed-fresh",
	modeBefore: "fresh",
	pluginVerified: true,
	backupDir: null,
	removedPaths: [],
	receiptPath: null,
};
const okCodexResult: CodexPluginInstallResult = {
	action: "installed",
	pluginVerified: true,
};
const failedInstallResult: MigrateResult = {
	action: "install-failed",
	modeBefore: "legacy",
	pluginVerified: false,
	backupDir: null,
	removedPaths: [],
	receiptPath: null,
	error: "plugin did not verify after install",
};

describe("handlePluginInstall (init Phase 7.5)", () => {
	let root: string;
	let extractDir: string;
	let claudeDir: string;
	let stageBase: string;

	beforeEach(async () => {
		root = join(tmpdir(), `ck-pih-${Date.now()}-${Math.round(performance.now())}`);
		extractDir = join(root, "extract");
		claudeDir = join(root, "claude");
		stageBase = join(root, "stage");
		await mkdir(join(extractDir, ".claude", ".claude-plugin"), { recursive: true });
		await mkdir(join(extractDir, ".claude", "skills", "cook"), { recursive: true });
		await writeFile(
			join(extractDir, ".claude", ".claude-plugin", "plugin.json"),
			'{"name":"ck"}',
			"utf-8",
		);
		await mkdir(claudeDir, { recursive: true });
	});
	afterEach(async () => {
		await rm(root, { recursive: true, force: true });
	});

	function ctxOf(
		over: Partial<{ kitType: string; global: boolean; installMode: string }> = {},
	): InitContext {
		return {
			kitType: over.kitType ?? "engineer",
			options: { global: over.global ?? true, installMode: over.installMode ?? "legacy" },
			extractDir,
			claudeDir,
		} as unknown as InitContext;
	}

	test("non-engineer kit: skips (migrate not called)", async () => {
		let called = false;
		await handlePluginInstall(ctxOf({ kitType: "marketing" }), {
			migrate: async () => {
				called = true;
				return okResult;
			},
			stageBaseDir: stageBase,
		});
		expect(called).toBe(false);
	});

	test("local (non-global) install: skips", async () => {
		let called = false;
		await handlePluginInstall(ctxOf({ global: false }), {
			migrate: async () => {
				called = true;
				return okResult;
			},
			stageBaseDir: stageBase,
		});
		expect(called).toBe(false);
	});

	test("engineer + global defaults to normal copied skills and cleans plugin providers", async () => {
		let migrated = false;
		let codexInstalled = false;
		let claudeCleanups = 0;
		let codexCleanups = 0;
		await handlePluginInstall(ctxOf(), {
			migrate: async () => {
				migrated = true;
				return okResult;
			},
			installCodex: async () => {
				codexInstalled = true;
				return okCodexResult;
			},
			uninstallClaudePlugin: async () => {
				claudeCleanups++;
				return { uninstalled: true, staleCacheRemoved: true, pluginStillInstalled: false };
			},
			removeCodexPlugin: async () => {
				codexCleanups++;
				return { removed: true, marketplaceRemoved: true, pluginStillInstalled: false };
			},
			stageBaseDir: stageBase,
		});
		expect(migrated).toBe(false);
		expect(codexInstalled).toBe(false);
		expect(claudeCleanups).toBe(1);
		expect(codexCleanups).toBe(1);
		expect(existsSync(stageBase)).toBe(false);
	});

	test("explicit auto is a normal-mode compatibility input", async () => {
		let pluginInstallAttempted = false;
		await handlePluginInstall(ctxOf({ installMode: "auto" }), {
			migrate: async () => {
				pluginInstallAttempted = true;
				return okResult;
			},
			installCodex: async () => {
				pluginInstallAttempted = true;
				return okCodexResult;
			},
			uninstallClaudePlugin: async () => ({
				uninstalled: false,
				staleCacheRemoved: false,
				pluginStillInstalled: false,
			}),
			removeCodexPlugin: async () => ({ removed: false, marketplaceRemoved: false }),
			stageBaseDir: stageBase,
		});

		expect(pluginInstallAttempted).toBe(false);
		expect(existsSync(stageBase)).toBe(false);
	});

	test("explicit plugin mode stages source and installs Claude and Codex plugins", async () => {
		const calls: string[] = [];
		const codexCalls: string[] = [];
		await handlePluginInstall(ctxOf({ installMode: "plugin" }), {
			migrate: async (o) => {
				calls.push(o.pluginSourceDir);
				return okResult;
			},
			installCodex: async (o) => {
				codexCalls.push(o.pluginSourceDir);
				return okCodexResult;
			},
			persistPreference: async () => {},
			stageBaseDir: stageBase,
		});

		expect(calls).toEqual([stageBase]);
		expect(codexCalls).toEqual([stageBase]);
	});

	test("explicit plugin mode fails instead of silently keeping legacy when migration fails", async () => {
		await expect(
			handlePluginInstall(ctxOf({ installMode: "plugin" }), {
				migrate: async () => failedInstallResult,
				installCodex: async () => okCodexResult,
				persistPreference: async () => {},
				stageBaseDir: stageBase,
			}),
		).rejects.toThrow("Claude plugin install failed");
	});

	test("explicit plugin mode fails clearly when Claude plugins are unsupported", async () => {
		const unsupportedResult: MigrateResult = {
			action: "skipped-cc-unsupported",
			modeBefore: "legacy",
			pluginVerified: false,
			backupDir: null,
			removedPaths: [],
			receiptPath: null,
		};

		await expect(
			handlePluginInstall(ctxOf({ installMode: "plugin" }), {
				migrate: async () => unsupportedResult,
				installCodex: async () => okCodexResult,
				persistPreference: async () => {},
				stageBaseDir: stageBase,
			}),
		).rejects.toThrow("Claude plugin installation is unavailable");
	});

	test("explicit plugin mode fails when supported Codex plugin install cannot verify", async () => {
		const failedCodexResult: CodexPluginInstallResult = {
			action: "install-failed",
			pluginVerified: false,
			error: "codex plugin did not verify after install",
		};

		await expect(
			handlePluginInstall(ctxOf({ installMode: "plugin" }), {
				migrate: async () => okResult,
				installCodex: async () => failedCodexResult,
				persistPreference: async () => {},
				stageBaseDir: stageBase,
			}),
		).rejects.toThrow("Codex plugin install failed");
	});

	test("explicit legacy mode removes plugin state and skips plugin migration", async () => {
		let migrated = false;
		let codexInstalled = false;
		const claudeUninstalls: string[] = [];
		const codexRemovals: string[] = [];
		const uninstallResult: UninstallPluginResult = {
			uninstalled: true,
			staleCacheRemoved: true,
			pluginStillInstalled: false,
		};
		const removeCodexResult: RemoveCodexPluginResult = {
			removed: true,
			marketplaceRemoved: true,
		};

		await handlePluginInstall(ctxOf({ installMode: "legacy" }), {
			migrate: async () => {
				migrated = true;
				return okResult;
			},
			installCodex: async () => {
				codexInstalled = true;
				return okCodexResult;
			},
			uninstallClaudePlugin: async (o) => {
				claudeUninstalls.push(o?.claudeDir ?? "");
				return uninstallResult;
			},
			removeCodexPlugin: async () => {
				codexRemovals.push("codex");
				return removeCodexResult;
			},
			stageBaseDir: stageBase,
		});

		expect(migrated).toBe(false);
		expect(codexInstalled).toBe(false);
		expect(claudeUninstalls).toEqual([claudeDir]);
		expect(codexRemovals).toEqual(["codex"]);
		expect(existsSync(stageBase)).toBe(false);
	});

	test("explicit legacy mode fails when Codex plugin cleanup does not verify", async () => {
		const uninstallResult: UninstallPluginResult = {
			uninstalled: false,
			staleCacheRemoved: false,
			pluginStillInstalled: false,
		};

		await expect(
			handlePluginInstall(ctxOf({ installMode: "legacy" }), {
				uninstallClaudePlugin: async () => uninstallResult,
				removeCodexPlugin: async () => ({
					removed: false,
					marketplaceRemoved: false,
					pluginStillInstalled: true,
					error: "codex plugin still installed after removal",
				}),
				stageBaseDir: stageBase,
			}),
		).rejects.toThrow("Codex plugin cleanup failed");

		expect(existsSync(stageBase)).toBe(false);
	});

	test("explicit legacy mode fails when Claude plugin cleanup does not verify", async () => {
		let codexRemoved = false;
		const uninstallResult: UninstallPluginResult = {
			uninstalled: true,
			staleCacheRemoved: false,
			pluginStillInstalled: true,
			error: "plugin remains registered after cleanup",
		};

		await expect(
			handlePluginInstall(ctxOf({ installMode: "legacy" }), {
				uninstallClaudePlugin: async () => uninstallResult,
				removeCodexPlugin: async () => {
					codexRemoved = true;
					return { removed: true, marketplaceRemoved: true };
				},
				stageBaseDir: stageBase,
			}),
		).rejects.toThrow("Claude plugin cleanup failed");

		expect(codexRemoved).toBe(true);
		expect(existsSync(stageBase)).toBe(false);
	});

	test("partial Claude cleanup still attempts Codex and converges on retry", async () => {
		let attempt = 0;
		let codexCleanups = 0;
		const deps = {
			uninstallClaudePlugin: async (): Promise<UninstallPluginResult> => {
				attempt++;
				return attempt === 1
					? {
							uninstalled: false,
							staleCacheRemoved: false,
							pluginStillInstalled: true,
							error: "Claude plugin remains",
						}
					: { uninstalled: true, staleCacheRemoved: true, pluginStillInstalled: false };
			},
			removeCodexPlugin: async (): Promise<RemoveCodexPluginResult> => {
				codexCleanups++;
				return {
					removed: codexCleanups === 1,
					marketplaceRemoved: true,
					pluginStillInstalled: false,
				};
			},
			stageBaseDir: stageBase,
		};

		await expect(handlePluginInstall(ctxOf(), deps)).rejects.toThrow(
			"Claude plugin cleanup failed",
		);
		await expect(handlePluginInstall(ctxOf(), deps)).resolves.toBeDefined();
		expect(codexCleanups).toBe(2);
		expect(existsSync(stageBase)).toBe(false);
	});

	test("migrate throwing never fails init (legacy copy retained)", async () => {
		const ctx = ctxOf();
		const out = await handlePluginInstall(ctx, {
			migrate: async () => {
				throw new Error("boom");
			},
			stageBaseDir: stageBase,
		});
		expect(out).toBe(ctx); // returns context, no throw
	});
});

describe("stagePluginSource", () => {
	let root: string;
	beforeEach(async () => {
		root = join(tmpdir(), `ck-stage-${Date.now()}-${Math.round(performance.now())}`);
		await mkdir(join(root, "extract", ".claude", ".claude-plugin"), { recursive: true });
		await writeFile(
			join(root, "extract", ".claude", ".claude-plugin", "plugin.json"),
			'{"name":"ck"}',
			"utf-8",
		);
	});
	afterEach(async () => {
		await rm(root, { recursive: true, force: true });
	});

	test("copies .claude payload and writes Claude and Codex marketplace files", () => {
		const base = join(root, "stage");
		const result = stagePluginSource(join(root, "extract"), base);
		expect(result).toBe(base);
		expect(existsSync(join(base, ".claude", ".claude-plugin", "plugin.json"))).toBe(true);
		expect(existsSync(join(base, ".claude", ".codex-plugin", "plugin.json"))).toBe(true);
		const claudeMarketplace = JSON.parse(
			readFileSync(join(base, ".claude-plugin", "marketplace.json"), "utf-8"),
		);
		expect(claudeMarketplace.plugins[0].name).toBe("ck");
		expect(claudeMarketplace.plugins[0].source).toBe("./.claude");
		const codexMarketplace = JSON.parse(
			readFileSync(join(base, ".agents", "plugins", "marketplace.json"), "utf-8"),
		);
		expect(codexMarketplace.plugins[0].name).toBe("ck");
		expect(codexMarketplace.plugins[0].source.path).toBe("./.claude");
		expect(codexMarketplace.plugins[0].policy.installation).toBe("AVAILABLE");
	});

	test("throws when archive has no .claude payload", () => {
		expect(() => stagePluginSource(join(root, "nonexistent"), join(root, "stage2"))).toThrow();
	});
});
