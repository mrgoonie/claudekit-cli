import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { countMissingHookFileReferencesForClaudeDir } from "@/domains/health-checks/checkers/hook-health-checker.js";

/**
 * Unit tests for countMissingHookFileReferencesForClaudeDir (issue #900).
 * Scoped, install-specific count of registered hook commands whose script file is
 * missing from THIS install's hooks/ dir — drives the init version-skip integrity check.
 */
describe("countMissingHookFileReferencesForClaudeDir", () => {
	let projectRoot: string;
	let claudeDir: string;
	let hooksDir: string;

	beforeEach(async () => {
		projectRoot = await mkdtemp(join(tmpdir(), "ck-missing-refs-"));
		claudeDir = join(projectRoot, ".claude");
		hooksDir = join(claudeDir, "hooks");
		await mkdir(hooksDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(projectRoot, { recursive: true, force: true });
	});

	// Hook command rooted at $CLAUDE_PROJECT_DIR so it resolves under claudeDir/hooks
	// via the helper's default projectRoot (= dirname(claudeDir) = projectRoot).
	const hookCmd = (name: string) => `node "$CLAUDE_PROJECT_DIR/.claude/hooks/${name}.cjs"`;

	async function writeSettings(hooks: Record<string, unknown>, fileName = "settings.json") {
		await writeFile(join(claudeDir, fileName), JSON.stringify({ hooks }, null, 2), "utf-8");
	}

	async function createHookScript(name: string) {
		await writeFile(join(hooksDir, `${name}.cjs`), "// stub\n", "utf-8");
	}

	test("counts a registered hook whose script is missing on disk", async () => {
		await writeSettings({
			SessionStart: [{ hooks: [{ type: "command", command: hookCmd("session-init") }] }],
		});
		// session-init.cjs intentionally not created
		await expect(countMissingHookFileReferencesForClaudeDir(claudeDir)).resolves.toBe(1);
	});

	test("returns 0 when every referenced script exists", async () => {
		await writeSettings({
			SessionStart: [{ hooks: [{ type: "command", command: hookCmd("session-init") }] }],
			Stop: [{ hooks: [{ type: "command", command: hookCmd("session-state") }] }],
		});
		await createHookScript("session-init");
		await createHookScript("session-state");
		await expect(countMissingHookFileReferencesForClaudeDir(claudeDir)).resolves.toBe(0);
	});

	test("counts across multiple events and only the missing ones", async () => {
		await writeSettings({
			SessionStart: [{ hooks: [{ type: "command", command: hookCmd("session-init") }] }],
			Stop: [{ hooks: [{ type: "command", command: hookCmd("session-state") }] }],
			PreToolUse: [{ hooks: [{ type: "command", command: hookCmd("descriptive-name") }] }],
		});
		await createHookScript("session-init"); // present; other two missing
		await expect(countMissingHookFileReferencesForClaudeDir(claudeDir)).resolves.toBe(2);
	});

	test("also scans settings.local.json", async () => {
		await writeSettings(
			{ Stop: [{ hooks: [{ type: "command", command: hookCmd("local-only") }] }] },
			"settings.local.json",
		);
		await expect(countMissingHookFileReferencesForClaudeDir(claudeDir)).resolves.toBe(1);
	});

	test("ignores a missing reference outside the install hooks/ dir", async () => {
		// Points at .claude/custom/* (not hooks/) — a reinstall could not restore it, so it must
		// NOT permanently disable the version-skip optimization.
		await writeSettings({
			Stop: [
				{
					hooks: [{ type: "command", command: 'node "$CLAUDE_PROJECT_DIR/.claude/custom/x.cjs"' }],
				},
			],
		});
		await expect(countMissingHookFileReferencesForClaudeDir(claudeDir)).resolves.toBe(0);
	});

	test("returns 0 when no settings.json exists", async () => {
		await expect(countMissingHookFileReferencesForClaudeDir(claudeDir)).resolves.toBe(0);
	});
});
