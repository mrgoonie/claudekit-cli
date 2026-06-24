import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stagePluginSource } from "@/commands/init/phases/plugin-install-handler.js";
import {
	CodexPluginInstaller,
	installCodexPlugin,
} from "@/domains/installation/plugin/codex-plugin-installer.js";
import { detectInstallMode } from "@/domains/installation/plugin/install-mode-detector.js";
import { migrateLegacyToPlugin } from "@/domains/installation/plugin/migrate-legacy-to-plugin.js";

/**
 * Real end-to-end migration check (#693). Exercises the actual install path:
 * stagePluginSource (synthesized marketplace) -> migrateLegacyToPlugin -> real
 * `claude plugin` against a sandboxed CLAUDE_CONFIG_DIR. No mocks.
 *
 * Gated behind CK_RUN_CLI_INTEGRATION=1 (needs a real `claude` binary + the
 * engineer kit). ENGINEER_KIT_DIR overrides the kit `claude/` source path.
 */
const RUN = process.env.CK_RUN_CLI_INTEGRATION === "1";
const KIT_CLAUDE_DIR =
	process.env.ENGINEER_KIT_DIR ?? "/Users/kaitran/claudekit/claudekit-engineer/claude";

const describeOrSkip =
	RUN &&
	existsSync(join(KIT_CLAUDE_DIR, ".claude-plugin", "plugin.json")) &&
	commandWorks("claude", ["plugin", "--help"], /marketplace/i)
		? describe
		: describe.skip;
const describeCodexOrSkip =
	RUN &&
	existsSync(join(KIT_CLAUDE_DIR, ".codex-plugin", "plugin.json")) &&
	commandWorks("codex", ["plugin", "--help"], /marketplace/i)
		? describe
		: describe.skip;

function commandWorks(command: string, args: string[], match?: RegExp): boolean {
	try {
		const output = execFileSync(command, args, {
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
		});
		return match ? match.test(output) : true;
	} catch {
		return false;
	}
}

describeOrSkip("plugin install e2e (real claude binary, sandboxed)", () => {
	let sandbox: string; // CLAUDE_CONFIG_DIR
	let extractDir: string; // simulated extracted release: <extractDir>/.claude
	let stageDir: string;

	beforeAll(() => {
		const root = join(tmpdir(), `ck-e2e-${Date.now()}`);
		sandbox = join(root, "config");
		extractDir = join(root, "extract");
		stageDir = join(root, "stage");
		mkdirSync(sandbox, { recursive: true });
		// Simulate the release archive layout: extractDir/.claude == the kit payload.
		mkdirSync(join(extractDir, ".claude"), { recursive: true });
		cpSync(KIT_CLAUDE_DIR, join(extractDir, ".claude"), { recursive: true });
	});

	afterAll(() => {
		try {
			rmSync(join(extractDir, ".."), { recursive: true, force: true });
		} catch {}
	});

	test("fresh -> installed-fresh, plugin verified, /ck:* skills load", async () => {
		const pluginSourceDir = stagePluginSource(extractDir, stageDir);
		expect(existsSync(join(pluginSourceDir, ".claude-plugin", "marketplace.json"))).toBe(true);

		const result = await migrateLegacyToPlugin({ pluginSourceDir, claudeDir: sandbox });

		expect(result.action).toBe("installed-fresh");
		expect(result.pluginVerified).toBe(true);

		// Detector now sees a real plugin install in the sandbox.
		const mode = detectInstallMode(sandbox);
		expect(mode.mode).toBe("plugin");
		expect(mode.plugin.installed).toBe(true);
		expect(mode.plugin.enabled).toBe(true);

		// Authoritative: `claude plugin details ck` lists the skills.
		const details = execFileSync("claude", ["plugin", "details", "ck"], {
			env: { ...process.env, CLAUDE_CONFIG_DIR: sandbox },
			encoding: "utf-8",
		});
		expect(details).toMatch(/Skills \(\d{2,}\)/); // dozens of skills
	}, 120_000);
});

describeCodexOrSkip("Codex plugin install e2e (real codex binary, sandboxed)", () => {
	let codexHome: string;
	let extractDir: string;
	let stageDir: string;

	beforeAll(() => {
		const root = join(tmpdir(), `ck-codex-e2e-${Date.now()}`);
		codexHome = join(root, "codex-home");
		extractDir = join(root, "extract");
		stageDir = join(root, "stage");
		mkdirSync(codexHome, { recursive: true });
		mkdirSync(join(extractDir, ".claude"), { recursive: true });
		cpSync(KIT_CLAUDE_DIR, join(extractDir, ".claude"), { recursive: true });
	});

	afterAll(() => {
		try {
			rmSync(join(extractDir, ".."), { recursive: true, force: true });
		} catch {}
	});

	test("installs ck@claudekit from the staged Codex marketplace", async () => {
		const pluginSourceDir = stagePluginSource(extractDir, stageDir);
		expect(existsSync(join(pluginSourceDir, ".agents", "plugins", "marketplace.json"))).toBe(true);

		const result = await installCodexPlugin({ pluginSourceDir, codexHome });

		expect(result).toEqual({ action: "installed", pluginVerified: true });
		await expect(new CodexPluginInstaller(undefined, codexHome).verifyInstalled()).resolves.toBe(
			true,
		);
	}, 120_000);
});
