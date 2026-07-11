import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFile, readdir } from "node:fs/promises";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handleInstallModeSelection } from "@/commands/init/phases/install-mode-selection-handler.js";
import type { InitContext } from "@/commands/init/types.js";
import type { InstallModeSelection } from "@/domains/ui/prompts/install-mode-prompts.js";

describe("Engineer install mode selection", () => {
	let root: string;
	let claudeDir: string;

	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), "ck-install-mode-selection-"));
		claudeDir = join(root, ".claude");
		await mkdir(claudeDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(root, { recursive: true, force: true });
	});

	function context(options: {
		selected?: InstallModeSelection;
		installMode?: "auto" | "legacy" | "plugin";
		explicit?: boolean;
		nonInteractive?: boolean;
	}) {
		let selections = 0;
		const notes: Array<{ message: string; title?: string }> = [];
		const ctx = {
			options: {
				global: true,
				installMode: options.installMode ?? "legacy",
				installModeExplicit: options.explicit ?? false,
				installModeTransitionRequired: false,
			},
			isNonInteractive: options.nonInteractive ?? false,
			cancelled: false,
			prompts: {
				note(message: string, title?: string) {
					notes.push({ message, title });
				},
				async selectEngineerInstallMode() {
					selections++;
					return options.selected ?? "legacy";
				},
			},
		} as unknown as InitContext;
		return { ctx, notes, selections: () => selections };
	}

	async function writePreference(preference: unknown, targetDir = claudeDir) {
		await mkdir(targetDir, { recursive: true });
		await writeFile(
			join(targetDir, "metadata.json"),
			JSON.stringify({
				kits: {
					engineer: {
						version: "1.0.0",
						installedAt: "2026-07-11T00:00:00.000Z",
						installModePreference: preference,
					},
				},
			}),
		);
	}

	test.each(["legacy", "plugin"] as const)(
		"fresh interactive choice %s becomes the effective mode",
		async (selected) => {
			const state = context({ selected });
			const out = await handleInstallModeSelection(state.ctx, { kitType: "engineer", claudeDir });

			expect(out.cancelled).toBe(false);
			expect(out.options.installMode).toBe(selected);
			expect(state.selections()).toBe(1);
			expect(state.notes[0]?.message).toContain("~/.claude/skills");
		},
	);

	test("fresh cancellation happens before install-side mutation", async () => {
		const state = context({ selected: "cancel" });
		const before = await readdir(claudeDir);

		const out = await handleInstallModeSelection(state.ctx, { kitType: "engineer", claudeDir });

		expect(out.cancelled).toBe(true);
		expect(await readdir(claudeDir)).toEqual(before);
		expect(out.options.installMode).toBe("legacy");
	});

	test("fresh non-interactive install chooses normal without prompting", async () => {
		const state = context({ selected: "plugin", nonInteractive: true });
		const out = await handleInstallModeSelection(state.ctx, { kitType: "engineer", claudeDir });

		expect(out.options.installMode).toBe("legacy");
		expect(state.selections()).toBe(0);
	});

	test("persisted plugin consent is preserved without a redundant prompt", async () => {
		await writePreference("plugin");
		const state = context({ selected: "legacy" });
		const out = await handleInstallModeSelection(state.ctx, { kitType: "engineer", claudeDir });

		expect(out.options.installMode).toBe("plugin");
		expect(out.options.installModeTransitionRequired).toBe(true);
		expect(state.selections()).toBe(0);
		expect(state.notes.some((entry) => entry.title === "Plugin preference preserved")).toBe(true);
	});

	test("secondary Engineer selection preserves persisted plugin consent", async () => {
		await writePreference("plugin");
		const state = context({ selected: "legacy" });

		const out = await handleInstallModeSelection(state.ctx, { kitType: "engineer", claudeDir });

		expect(out.options.installMode).toBe("plugin");
		expect(state.selections()).toBe(0);
	});

	test("fresh non-interactive secondary Engineer selection defaults to normal", async () => {
		const state = context({ selected: "plugin", nonInteractive: true });

		const out = await handleInstallModeSelection(state.ctx, { kitType: "engineer", claudeDir });

		expect(out.options.installMode).toBe("legacy");
		expect(state.selections()).toBe(0);
	});

	test("multi-kit orchestration resolves secondary Engineer consent before download", async () => {
		const source = await readFile(new URL("../../init-command.ts", import.meta.url), "utf-8");
		const start = source.indexOf("async function installAdditionalKit");
		const end = source.indexOf("\n/**", start);
		const additionalKitBlock = source.slice(start, end);
		const selectionIndex = additionalKitBlock.indexOf("handleInstallModeSelection");
		const downloadIndex = additionalKitBlock.indexOf("handleDownload");

		expect(selectionIndex).toBeGreaterThan(-1);
		expect(downloadIndex).toBeGreaterThan(selectionIndex);
	});

	test("canonical normal preference beats a stale Windows legacy plugin candidate", async () => {
		const legacyDir = join(root, "legacy-windows-candidate");
		await writePreference("legacy");
		await writePreference("plugin", legacyDir);
		const state = context({ selected: "plugin" });

		const out = await handleInstallModeSelection(state.ctx, {
			kitType: "engineer",
			claudeDir,
			legacyCandidateDirs: [legacyDir],
		});

		expect(out.options.installMode).toBe("legacy");
		expect(state.selections()).toBe(0);
	});

	test.each(["absent", "unreadable"] as const)(
		"Windows legacy plugin candidate is used when canonical preference is %s",
		async (canonicalState) => {
			const legacyDir = join(root, "legacy-windows-candidate");
			if (canonicalState === "unreadable") {
				await writeFile(join(claudeDir, "metadata.json"), "{not-json");
			}
			await writePreference("plugin", legacyDir);
			const state = context({ selected: "legacy" });

			const out = await handleInstallModeSelection(state.ctx, {
				kitType: "engineer",
				claudeDir,
				legacyCandidateDirs: [legacyDir],
			});

			expect(out.options.installMode).toBe("plugin");
			expect(state.selections()).toBe(0);
		},
	);

	test.each([undefined, "unexpected"])(
		"canonical metadata with preference %p does not inherit stale candidate plugin consent",
		async (canonicalPreference) => {
			const legacyDir = join(root, "legacy-windows-candidate");
			await writePreference(canonicalPreference);
			await writePreference("plugin", legacyDir);
			const state = context({ selected: "plugin" });

			const out = await handleInstallModeSelection(state.ctx, {
				kitType: "engineer",
				claudeDir,
				legacyCandidateDirs: [legacyDir],
			});

			expect(out.options.installMode).toBe("legacy");
			expect(state.selections()).toBe(0);
		},
	);

	test("persisted plugin consent remains effective with a disabled Claude registration", async () => {
		await writePreference("plugin");
		await writeFile(
			join(claudeDir, "settings.json"),
			JSON.stringify({ enabledPlugins: { "ck@claudekit": false } }),
		);
		await mkdir(join(claudeDir, "plugins", "cache", "claudekit", "ck", "1.0.0"), {
			recursive: true,
		});
		const state = context({ selected: "legacy" });

		const out = await handleInstallModeSelection(state.ctx, { kitType: "engineer", claudeDir });

		expect(out.options.installMode).toBe("plugin");
		// Direct global Engineer init conservatively bypasses the version skip and
		// reaches provider convergence even when this selection-only flag is false.
		expect(out.options.installModeTransitionRequired).toBe(false);
	});

	test("empty legacy candidate does not force a valid plugin install to transition", async () => {
		await writePreference("plugin");
		await writeFile(
			join(claudeDir, "settings.json"),
			JSON.stringify({ enabledPlugins: { "ck@claudekit": true } }),
		);
		await mkdir(join(claudeDir, "plugins", "cache", "claudekit", "ck", "1.0.0"), {
			recursive: true,
		});
		const emptyLegacyDir = join(root, "legacy-empty");
		await mkdir(emptyLegacyDir);
		const state = context({ selected: "legacy" });

		const out = await handleInstallModeSelection(state.ctx, {
			kitType: "engineer",
			claudeDir,
			legacyCandidateDirs: [emptyLegacyDir],
		});

		expect(out.options.installMode).toBe("plugin");
		expect(out.options.installModeTransitionRequired).toBe(false);
	});

	test.each(["auto", "legacy"] as const)(
		"explicit %s overrides persisted plugin consent to normal",
		async (installMode) => {
			await writePreference("plugin");
			const state = context({ installMode, explicit: true });
			const out = await handleInstallModeSelection(state.ctx, { kitType: "engineer", claudeDir });

			expect(out.options.installMode).toBe("legacy");
			expect(state.selections()).toBe(0);
		},
	);

	test.each([undefined, "auto", "legacy", "unexpected"])(
		"explicit plugin overrides stored normal state %p",
		async (stored) => {
			if (stored !== undefined) await writePreference(stored);
			const state = context({ installMode: "plugin", explicit: true });
			const out = await handleInstallModeSelection(state.ctx, { kitType: "engineer", claudeDir });

			expect(out.options.installMode).toBe("plugin");
			expect(state.selections()).toBe(0);
		},
	);

	test.each([undefined, "auto", "legacy", "unexpected"])(
		"stored non-consent %p resolves normal without prompting for an existing install",
		async (stored) => {
			await writePreference(stored);
			const state = context({ selected: "plugin" });
			const out = await handleInstallModeSelection(state.ctx, { kitType: "engineer", claudeDir });

			expect(out.options.installMode).toBe("legacy");
			expect(state.selections()).toBe(0);
		},
	);

	test("local and non-Engineer installs do not own the global Engineer prompt", async () => {
		const local = context({ selected: "plugin" });
		local.ctx.options.global = false;
		const localOut = await handleInstallModeSelection(local.ctx, {
			kitType: "engineer",
			claudeDir,
		});
		const marketing = context({ selected: "plugin" });
		const marketingOut = await handleInstallModeSelection(marketing.ctx, {
			kitType: "marketing",
			claudeDir,
		});

		expect(localOut).toBe(local.ctx);
		expect(marketingOut).toBe(marketing.ctx);
		expect(local.selections()).toBe(0);
		expect(marketing.selections()).toBe(0);
	});
});
