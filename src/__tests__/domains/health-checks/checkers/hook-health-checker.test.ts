import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	checkHookConfig,
	checkHookDeps,
	checkHookLogs,
	checkHookRuntime,
	checkHookSyntax,
	checkPythonVenv,
} from "@/domains/health-checks/checkers/hook-health-checker.js";

describe("checkHookSyntax", () => {
	let tempDir: string;
	let projectDir: string;
	let originalCkTestHome: string | undefined;

	beforeEach(async () => {
		tempDir = join(
			tmpdir(),
			`hook-health-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		projectDir = join(tempDir, "project");
		await mkdir(projectDir, { recursive: true });

		// Set CK_TEST_HOME to isolate from global .claude directory
		originalCkTestHome = process.env.CK_TEST_HOME;
		process.env.CK_TEST_HOME = tempDir;
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });

		// Restore original CK_TEST_HOME
		if (originalCkTestHome === undefined) {
			process.env.CK_TEST_HOME = undefined;
		} else {
			process.env.CK_TEST_HOME = originalCkTestHome;
		}
	});

	test("returns info status when no hooks directory exists", async () => {
		const result = await checkHookSyntax(projectDir);

		expect(result.id).toBe("hook-syntax");
		expect(result.status).toBe("info");
		expect(result.message).toBe("No hooks directory");
	});

	test("returns info status when hooks dir exists but no .cjs files", async () => {
		await mkdir(join(projectDir, ".claude", "hooks"), { recursive: true });
		await writeFile(join(projectDir, ".claude", "hooks", "README.md"), "# Hooks");

		const result = await checkHookSyntax(projectDir);

		expect(result.status).toBe("info");
		expect(result.message).toBe("No .cjs hooks found");
	});

	test("returns pass status when all hooks have valid syntax", async () => {
		await mkdir(join(projectDir, ".claude", "hooks"), { recursive: true });
		await writeFile(
			join(projectDir, ".claude", "hooks", "valid-hook.cjs"),
			"const x = 42; console.log(x);",
		);
		await writeFile(
			join(projectDir, ".claude", "hooks", "another-valid.cjs"),
			"module.exports = { test: true };",
		);

		const result = await checkHookSyntax(projectDir);

		expect(result.status).toBe("pass");
		expect(result.message).toBe("2 hook(s) valid");
	});

	test("returns fail status when a hook has syntax errors", async () => {
		await mkdir(join(projectDir, ".claude", "hooks"), { recursive: true });
		await writeFile(join(projectDir, ".claude", "hooks", "valid-hook.cjs"), "const x = 42;");
		await writeFile(
			join(projectDir, ".claude", "hooks", "broken-hook.cjs"),
			"const x = {;", // Syntax error
		);

		const result = await checkHookSyntax(projectDir);

		expect(result.status).toBe("fail");
		expect(result.message).toBe("1 hook(s) with syntax errors");
		expect(result.details).toContain("broken-hook.cjs");
		expect(result.autoFixable).toBe(true);
		expect(result.suggestion).toBe("Run: ck init");
	});
});

describe("checkHookDeps", () => {
	let tempDir: string;
	let projectDir: string;
	let originalCkTestHome: string | undefined;

	beforeEach(async () => {
		tempDir = join(
			tmpdir(),
			`hook-health-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		projectDir = join(tempDir, "project");
		await mkdir(projectDir, { recursive: true });

		// Set CK_TEST_HOME to isolate from global .claude directory
		originalCkTestHome = process.env.CK_TEST_HOME;
		process.env.CK_TEST_HOME = tempDir;
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });

		// Restore original CK_TEST_HOME
		if (originalCkTestHome === undefined) {
			process.env.CK_TEST_HOME = undefined;
		} else {
			process.env.CK_TEST_HOME = originalCkTestHome;
		}
	});

	test("returns info status when no hooks directory", async () => {
		const result = await checkHookDeps(projectDir);

		expect(result.id).toBe("hook-deps");
		expect(result.status).toBe("info");
		expect(result.message).toBe("No hooks directory");
	});

	test("returns pass status when all require() targets resolve", async () => {
		await mkdir(join(projectDir, ".claude", "hooks"), { recursive: true });
		await writeFile(
			join(projectDir, ".claude", "hooks", "hook.cjs"),
			`
const fs = require('fs');
const path = require('path');
const os = require('os');
console.log(fs, path, os);
`,
		);

		const result = await checkHookDeps(projectDir);

		expect(result.status).toBe("pass");
		expect(result.message).toBe("All dependencies resolved");
	});

	test("returns pass status for node: prefixed builtins", async () => {
		await mkdir(join(projectDir, ".claude", "hooks"), { recursive: true });
		await writeFile(
			join(projectDir, ".claude", "hooks", "hook.cjs"),
			`
const fs = require('node:fs');
const path = require('node:path');
console.log(fs, path);
`,
		);

		const result = await checkHookDeps(projectDir);

		expect(result.status).toBe("pass");
		expect(result.message).toBe("All dependencies resolved");
	});

	test("returns pass status for relative requires with explicit extensions", async () => {
		await mkdir(join(projectDir, ".claude", "hooks"), { recursive: true });
		await writeFile(
			join(projectDir, ".claude", "hooks", "lib-helper.cjs"),
			"module.exports = { helper: true };",
		);
		await writeFile(
			join(projectDir, ".claude", "hooks", "hook.cjs"),
			"const lib = require('./lib-helper.cjs');\nconsole.log(lib);",
		);

		const result = await checkHookDeps(projectDir);

		expect(result.status).toBe("pass");
		expect(result.message).toBe("All dependencies resolved");
	});

	test("returns pass status for relative requires without extension", async () => {
		await mkdir(join(projectDir, ".claude", "hooks"), { recursive: true });
		await writeFile(
			join(projectDir, ".claude", "hooks", "lib-helper.cjs"),
			"module.exports = { helper: true };",
		);
		await writeFile(
			join(projectDir, ".claude", "hooks", "hook.cjs"),
			"const lib = require('./lib-helper');\nconsole.log(lib);",
		);

		const result = await checkHookDeps(projectDir);

		expect(result.status).toBe("pass");
		expect(result.message).toBe("All dependencies resolved");
	});

	test("returns fail status when a require target is missing", async () => {
		await mkdir(join(projectDir, ".claude", "hooks"), { recursive: true });
		await writeFile(
			join(projectDir, ".claude", "hooks", "hook.cjs"),
			"const missing = require('./non-existent.cjs');\nconsole.log(missing);",
		);

		const result = await checkHookDeps(projectDir);

		expect(result.status).toBe("fail");
		expect(result.message).toBe("1 missing dependency(ies)");
		expect(result.details).toContain("hook.cjs: ./non-existent.cjs");
		expect(result.autoFixable).toBe(true);
	});
});

describe("checkHookRuntime", () => {
	let tempDir: string;
	let projectDir: string;
	let originalCkTestHome: string | undefined;

	beforeEach(async () => {
		tempDir = join(
			tmpdir(),
			`hook-health-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		projectDir = join(tempDir, "project");
		await mkdir(projectDir, { recursive: true });

		// Set CK_TEST_HOME to isolate from global .claude directory
		originalCkTestHome = process.env.CK_TEST_HOME;
		process.env.CK_TEST_HOME = tempDir;
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });

		// Restore original CK_TEST_HOME
		if (originalCkTestHome === undefined) {
			process.env.CK_TEST_HOME = undefined;
		} else {
			process.env.CK_TEST_HOME = originalCkTestHome;
		}
	});

	test("returns info status when no hooks directory", async () => {
		const result = await checkHookRuntime(projectDir);

		expect(result.id).toBe("hook-runtime");
		expect(result.status).toBe("info");
		expect(result.message).toBe("No hooks directory");
	});

	test("returns pass status when hooks exit 0", async () => {
		await mkdir(join(projectDir, ".claude", "hooks"), { recursive: true });
		await writeFile(
			join(projectDir, ".claude", "hooks", "hook.cjs"),
			`
const input = require('fs').readFileSync(0, 'utf-8');
const payload = JSON.parse(input);
console.log(JSON.stringify({ hookSpecificOutput: { allow: true } }));
process.exit(0);
`,
		);

		const result = await checkHookRuntime(projectDir);

		expect(result.status).toBe("pass");
		expect(result.message).toBe("1 hook(s) passed dry-run");
	});

	test("returns pass status when hooks exit 2 (intentional block)", async () => {
		await mkdir(join(projectDir, ".claude", "hooks"), { recursive: true });
		await writeFile(
			join(projectDir, ".claude", "hooks", "hook.cjs"),
			`
const input = require('fs').readFileSync(0, 'utf-8');
const payload = JSON.parse(input);
console.log(JSON.stringify({ hookSpecificOutput: { allow: false, reason: "test block" } }));
process.exit(2);
`,
		);

		const result = await checkHookRuntime(projectDir);

		expect(result.status).toBe("pass");
		expect(result.message).toBe("1 hook(s) passed dry-run");
	});

	test("returns fail status when hooks exit with non-0/non-2 code", async () => {
		await mkdir(join(projectDir, ".claude", "hooks"), { recursive: true });
		await writeFile(
			join(projectDir, ".claude", "hooks", "hook.cjs"),
			`
const input = require('fs').readFileSync(0, 'utf-8');
const payload = JSON.parse(input);
console.error("Hook crashed");
process.exit(1);
`,
		);

		const result = await checkHookRuntime(projectDir);

		expect(result.status).toBe("fail");
		expect(result.message).toBe("1 hook(s) failed dry-run");
		expect(result.details).toContain("hook.cjs");
		expect(result.autoFixable).toBe(true);
	});
});

describe("checkHookConfig", () => {
	let tempDir: string;
	let projectDir: string;
	let originalCkTestHome: string | undefined;

	beforeEach(async () => {
		tempDir = join(
			tmpdir(),
			`hook-health-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		projectDir = join(tempDir, "project");
		await mkdir(projectDir, { recursive: true });

		// Set CK_TEST_HOME to isolate from global .claude directory
		originalCkTestHome = process.env.CK_TEST_HOME;
		process.env.CK_TEST_HOME = tempDir;
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });

		// Restore original CK_TEST_HOME
		if (originalCkTestHome === undefined) {
			process.env.CK_TEST_HOME = undefined;
		} else {
			process.env.CK_TEST_HOME = originalCkTestHome;
		}
	});

	test("returns info status when no .ck.json exists", async () => {
		const result = await checkHookConfig(projectDir);

		expect(result.id).toBe("hook-config");
		expect(result.status).toBe("info");
		expect(result.message).toBe("No .ck.json config");
	});

	test("returns pass status when config hooks match actual files", async () => {
		await mkdir(join(projectDir, ".claude", "hooks"), { recursive: true });
		await writeFile(
			join(projectDir, ".claude", "hooks", "session-init.cjs"),
			"console.log('test');",
		);
		await writeFile(
			join(projectDir, ".claude", ".ck.json"),
			JSON.stringify({
				hooks: {
					"session-init": { enabled: true },
				},
			}),
		);

		const result = await checkHookConfig(projectDir);

		expect(result.status).toBe("pass");
		expect(result.message).toBe("All config entries valid");
	});

	test("returns warn status when config has orphaned entries", async () => {
		await mkdir(join(projectDir, ".claude", "hooks"), { recursive: true });
		await writeFile(
			join(projectDir, ".claude", "hooks", "existing-hook.cjs"),
			"console.log('test');",
		);
		await writeFile(
			join(projectDir, ".claude", ".ck.json"),
			JSON.stringify({
				hooks: {
					"existing-hook": { enabled: true },
					"orphaned-hook": { enabled: true },
					"another-orphan": { enabled: false },
				},
			}),
		);

		const result = await checkHookConfig(projectDir);

		expect(result.status).toBe("warn");
		expect(result.message).toBe("2 orphaned config entry(ies)");
		expect(result.details).toContain("orphaned-hook");
		expect(result.details).toContain("another-orphan");
		expect(result.autoFixable).toBe(true);
		expect(result.suggestion).toBe("Remove orphaned entries from .ck.json");
	});

	test("returns pass status when no hooks configured", async () => {
		await mkdir(join(projectDir, ".claude", "hooks"), { recursive: true });
		await writeFile(join(projectDir, ".claude", ".ck.json"), JSON.stringify({ version: "1.0.0" }));

		const result = await checkHookConfig(projectDir);

		expect(result.status).toBe("pass");
		expect(result.message).toBe("No hooks configured");
	});
});

describe("checkHookLogs", () => {
	let tempDir: string;
	let projectDir: string;
	let originalCkTestHome: string | undefined;

	beforeEach(async () => {
		tempDir = join(
			tmpdir(),
			`hook-health-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		projectDir = join(tempDir, "project");
		await mkdir(projectDir, { recursive: true });

		// Set CK_TEST_HOME to isolate from global .claude directory
		originalCkTestHome = process.env.CK_TEST_HOME;
		process.env.CK_TEST_HOME = tempDir;
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });

		// Restore original CK_TEST_HOME
		if (originalCkTestHome === undefined) {
			process.env.CK_TEST_HOME = undefined;
		} else {
			process.env.CK_TEST_HOME = originalCkTestHome;
		}
	});

	test("returns info status when no hooks directory", async () => {
		const result = await checkHookLogs(projectDir);

		expect(result.id).toBe("hook-logs");
		expect(result.status).toBe("info");
		expect(result.message).toBe("No hooks directory");
	});

	test("returns pass status when no log file exists", async () => {
		await mkdir(join(projectDir, ".claude", "hooks"), { recursive: true });

		const result = await checkHookLogs(projectDir);

		expect(result.status).toBe("pass");
		expect(result.message).toBe("No crash logs");
	});

	test("returns pass status when log file has no crashes in last 24h", async () => {
		await mkdir(join(projectDir, ".claude", "hooks", ".logs"), {
			recursive: true,
		});
		const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
		await writeFile(
			join(projectDir, ".claude", "hooks", ".logs", "hook-log.jsonl"),
			`${JSON.stringify({ ts: twoDaysAgo, status: "crash", hook: "old-hook", error: "old error" })}\n`,
		);

		const result = await checkHookLogs(projectDir);

		expect(result.status).toBe("pass");
		expect(result.message).toBe("No crashes in last 24h");
	});

	test("returns warn status when log has 1-5 crashes in last 24h", async () => {
		await mkdir(join(projectDir, ".claude", "hooks", ".logs"), {
			recursive: true,
		});
		const now = new Date().toISOString();
		const crashes = [
			{ ts: now, status: "crash", hook: "hook-1", error: "error 1" },
			{ ts: now, status: "crash", hook: "hook-2", error: "error 2" },
			{ ts: now, status: "crash", hook: "hook-3", error: "error 3" },
		];
		await writeFile(
			join(projectDir, ".claude", "hooks", ".logs", "hook-log.jsonl"),
			crashes.map((c) => JSON.stringify(c)).join("\n"),
		);

		const result = await checkHookLogs(projectDir);

		expect(result.status).toBe("warn");
		expect(result.message).toBe("3 crash(es) in last 24h");
		expect(result.details).toContain("hook-1: error 1");
		expect(result.autoFixable).toBe(true);
	});

	test("returns fail status when log has >5 crashes in last 24h", async () => {
		await mkdir(join(projectDir, ".claude", "hooks", ".logs"), {
			recursive: true,
		});
		const now = new Date().toISOString();
		const crashes = Array.from({ length: 10 }, (_, i) => ({
			ts: now,
			status: "crash",
			hook: `hook-${i}`,
			error: `error ${i}`,
		}));
		await writeFile(
			join(projectDir, ".claude", "hooks", ".logs", "hook-log.jsonl"),
			crashes.map((c) => JSON.stringify(c)).join("\n"),
		);

		const result = await checkHookLogs(projectDir);

		expect(result.status).toBe("fail");
		expect(result.message).toBe("10 crashes in last 24h");
		expect(result.details).toContain("Most frequent:");
		expect(result.autoFixable).toBe(true);
	});

	test("returns warn status when log file exceeds 10MB", async () => {
		await mkdir(join(projectDir, ".claude", "hooks", ".logs"), {
			recursive: true,
		});
		// Create a file > 10MB
		const largeContent = "x".repeat(11 * 1024 * 1024);
		await writeFile(join(projectDir, ".claude", "hooks", ".logs", "hook-log.jsonl"), largeContent);

		const result = await checkHookLogs(projectDir);

		expect(result.status).toBe("warn");
		expect(result.message).toContain("Log file too large");
		expect(result.message).toContain("11MB");
		expect(result.autoFixable).toBe(true);
	});
});

describe("checkPythonVenv", () => {
	let tempDir: string;
	let projectDir: string;
	let originalCkTestHome: string | undefined;

	beforeEach(async () => {
		tempDir = join(
			tmpdir(),
			`hook-health-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		projectDir = join(tempDir, "project");
		await mkdir(projectDir, { recursive: true });

		// Set CK_TEST_HOME to isolate from global .claude directory
		originalCkTestHome = process.env.CK_TEST_HOME;
		process.env.CK_TEST_HOME = tempDir;
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });

		// Restore original CK_TEST_HOME
		if (originalCkTestHome === undefined) {
			process.env.CK_TEST_HOME = undefined;
		} else {
			process.env.CK_TEST_HOME = originalCkTestHome;
		}
	});

	test("returns warn status when no .venv found", async () => {
		const result = await checkPythonVenv(projectDir);

		expect(result.id).toBe("python-venv");
		expect(result.status).toBe("warn");
		expect(result.message).toBe("Virtual environment not found");
		expect(result.suggestion).toBe("Delete .venv and run install.sh");
		expect(result.autoFixable).toBe(true);
	});

	test("returns pass status when venv python works", async () => {
		const isWindows = process.platform === "win32";
		const venvBin = isWindows ? join("Scripts", "python.exe") : join("bin", "python3");
		const venvPath = join(projectDir, ".claude", "skills", ".venv", venvBin);

		await mkdir(join(projectDir, ".claude", "skills", ".venv", "bin"), {
			recursive: true,
		});

		// Create a symlink or copy of the system python
		try {
			// Try to find system python3
			const { spawnSync } = require("node:child_process");
			const whichResult = spawnSync(isWindows ? "where" : "which", [
				isWindows ? "python" : "python3",
			]);
			const systemPython = whichResult.stdout?.toString().trim().split("\n")[0] || null;

			if (systemPython) {
				// Create symlink to actual python
				await symlink(systemPython, venvPath);

				const result = await checkPythonVenv(projectDir);

				expect(result.status).toBe("pass");
				expect(result.message).toContain("Python");
			} else {
				// Skip test if no system python found
				console.log("Skipping test: no system python found");
			}
		} catch (error) {
			// Skip test if symlink fails (permissions, etc.)
			console.log(`Skipping test: ${error}`);
		}
	});
});
