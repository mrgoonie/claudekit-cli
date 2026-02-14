import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
import type { CheckResult } from "../types.js";
import { HOOK_EXTENSIONS } from "./shared.js";

const HOOK_CHECK_TIMEOUT_MS = 5000;
const PYTHON_CHECK_TIMEOUT_MS = 3000;
const MAX_LOG_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Get the hooks directory to check (prefer project, fallback to global)
 */
function getHooksDir(projectDir: string): string | null {
	const projectHooksDir = resolve(projectDir, ".claude", "hooks");
	const globalHooksDir = resolve(PathResolver.getGlobalKitDir(), "hooks");

	if (existsSync(projectHooksDir)) return projectHooksDir;
	if (existsSync(globalHooksDir)) return globalHooksDir;
	return null;
}

/**
 * Validate a file path stays within the expected directory
 */
function isPathWithin(filePath: string, parentDir: string): boolean {
	return resolve(filePath).startsWith(resolve(parentDir));
}

/**
 * Check hook files for syntax errors
 */
export async function checkHookSyntax(projectDir: string): Promise<CheckResult> {
	const hooksDir = getHooksDir(projectDir);

	if (!hooksDir) {
		return {
			id: "hook-syntax",
			name: "Hook Syntax",
			group: "claudekit",
			priority: "critical",
			status: "info",
			message: "No hooks directory",
			autoFixable: false,
		};
	}

	try {
		const files = await readdir(hooksDir);
		const cjsFiles = files.filter((f) => f.endsWith(".cjs"));

		if (cjsFiles.length === 0) {
			return {
				id: "hook-syntax",
				name: "Hook Syntax",
				group: "claudekit",
				priority: "critical",
				status: "info",
				message: "No .cjs hooks found",
				autoFixable: false,
			};
		}

		const errors: string[] = [];
		for (const file of cjsFiles) {
			const filePath = join(hooksDir, file);
			if (!isPathWithin(filePath, hooksDir)) continue;
			const result = spawnSync("node", ["--check", filePath], {
				timeout: HOOK_CHECK_TIMEOUT_MS,
				encoding: "utf-8",
			});

			if (result.status !== 0) {
				errors.push(`${file}: ${result.stderr?.trim() || "syntax error"}`);
			}
		}

		if (errors.length > 0) {
			return {
				id: "hook-syntax",
				name: "Hook Syntax",
				group: "claudekit",
				priority: "critical",
				status: "fail",
				message: `${errors.length} hook(s) with syntax errors`,
				details: errors.join("\n"),
				suggestion: "Run: ck init",
				autoFixable: true,
				fix: {
					id: "fix-hook-syntax",
					description: "Reinstall hooks via ck init",
					execute: async () => ({
						success: false,
						message: "Manual fix required: run 'ck init'",
					}),
				},
			};
		}

		return {
			id: "hook-syntax",
			name: "Hook Syntax",
			group: "claudekit",
			priority: "critical",
			status: "pass",
			message: `${cjsFiles.length} hook(s) valid`,
			autoFixable: false,
		};
	} catch (error) {
		logger.debug(`Hook syntax check failed: ${error}`);
		return {
			id: "hook-syntax",
			name: "Hook Syntax",
			group: "claudekit",
			priority: "critical",
			status: "fail",
			message: "Failed to check hook syntax",
			details: error instanceof Error ? error.message : String(error),
			autoFixable: false,
		};
	}
}

/**
 * Check hook dependencies (require() calls)
 */
export async function checkHookDeps(projectDir: string): Promise<CheckResult> {
	const hooksDir = getHooksDir(projectDir);

	if (!hooksDir) {
		return {
			id: "hook-deps",
			name: "Hook Dependencies",
			group: "claudekit",
			priority: "critical",
			status: "info",
			message: "No hooks directory",
			autoFixable: false,
		};
	}

	try {
		const files = await readdir(hooksDir);
		const cjsFiles = files.filter((f) => f.endsWith(".cjs"));

		if (cjsFiles.length === 0) {
			return {
				id: "hook-deps",
				name: "Hook Dependencies",
				group: "claudekit",
				priority: "critical",
				status: "info",
				message: "No .cjs hooks found",
				autoFixable: false,
			};
		}

		const missingDeps: string[] = [];
		const requireRegex = /require\(['"]([^'"]+)['"]\)/g;

		for (const file of cjsFiles) {
			const filePath = join(hooksDir, file);
			if (!isPathWithin(filePath, hooksDir)) continue;
			const content = readFileSync(filePath, "utf-8");
			for (
				let match = requireRegex.exec(content);
				match !== null;
				match = requireRegex.exec(content)
			) {
				const depPath = match[1];

				// Skip node built-ins
				if (depPath.startsWith("node:") || isNodeBuiltin(depPath)) {
					continue;
				}

				// Resolve relative paths
				if (depPath.startsWith(".")) {
					const resolvedPath = join(hooksDir, depPath);
					const extensions = [".js", ".cjs", ".mjs", ".json"];
					const indexFiles = ["index.js", "index.cjs", "index.mjs"];
					const exists =
						existsSync(resolvedPath) ||
						extensions.some((ext) => existsSync(resolvedPath + ext)) ||
						indexFiles.some((idx) => existsSync(join(resolvedPath, idx)));

					if (!exists) {
						missingDeps.push(`${file}: ${depPath}`);
					}
				}
			}
		}

		if (missingDeps.length > 0) {
			return {
				id: "hook-deps",
				name: "Hook Dependencies",
				group: "claudekit",
				priority: "critical",
				status: "fail",
				message: `${missingDeps.length} missing dependency(ies)`,
				details: missingDeps.join("\n"),
				suggestion: "Run: ck init",
				autoFixable: true,
				fix: {
					id: "fix-hook-deps",
					description: "Reinstall hooks via ck init",
					execute: async () => ({
						success: false,
						message: "Manual fix required: run 'ck init'",
					}),
				},
			};
		}

		return {
			id: "hook-deps",
			name: "Hook Dependencies",
			group: "claudekit",
			priority: "critical",
			status: "pass",
			message: "All dependencies resolved",
			autoFixable: false,
		};
	} catch (error) {
		logger.debug(`Hook deps check failed: ${error}`);
		return {
			id: "hook-deps",
			name: "Hook Dependencies",
			group: "claudekit",
			priority: "critical",
			status: "fail",
			message: "Failed to check dependencies",
			details: error instanceof Error ? error.message : String(error),
			autoFixable: false,
		};
	}
}

/**
 * Check if a module is a Node.js built-in
 */
function isNodeBuiltin(mod: string): boolean {
	try {
		const { builtinModules } = require("node:module");
		return builtinModules.includes(mod);
	} catch {
		// Fallback for older Node versions
		const builtins = [
			"fs",
			"path",
			"os",
			"child_process",
			"util",
			"stream",
			"events",
			"crypto",
			"http",
			"https",
			"net",
			"dns",
			"url",
			"querystring",
			"readline",
			"process",
			"buffer",
			"console",
			"timers",
			"assert",
			"zlib",
			"worker_threads",
			"perf_hooks",
			"v8",
			"vm",
			"tls",
		];
		return builtins.includes(mod);
	}
}

/**
 * Dry-run each hook with synthetic payload
 */
export async function checkHookRuntime(projectDir: string): Promise<CheckResult> {
	const hooksDir = getHooksDir(projectDir);

	if (!hooksDir) {
		return {
			id: "hook-runtime",
			name: "Hook Runtime",
			group: "claudekit",
			priority: "standard",
			status: "info",
			message: "No hooks directory",
			autoFixable: false,
		};
	}

	try {
		const files = await readdir(hooksDir);
		const cjsFiles = files.filter((f) => f.endsWith(".cjs"));

		if (cjsFiles.length === 0) {
			return {
				id: "hook-runtime",
				name: "Hook Runtime",
				group: "claudekit",
				priority: "standard",
				status: "info",
				message: "No .cjs hooks found",
				autoFixable: false,
			};
		}

		const syntheticPayload = JSON.stringify({
			tool_name: "Read",
			tool_input: { file_path: join(tmpdir(), "ck-doctor-test.txt") },
		});

		const failures: string[] = [];
		for (const file of cjsFiles) {
			const filePath = join(hooksDir, file);
			if (!isPathWithin(filePath, hooksDir)) continue;
			const result = spawnSync("node", [filePath], {
				input: syntheticPayload,
				timeout: HOOK_CHECK_TIMEOUT_MS,
				encoding: "utf-8",
			});

			// Exit 0 = allow, exit 2 = intentional block (both are valid)
			if (result.status !== null && result.status !== 0 && result.status !== 2) {
				const error =
					result.error?.message || result.stderr?.trim() || `exit code ${result.status}`;
				failures.push(`${file}: ${error}`);
			} else if (result.status === null && result.error) {
				// Process failed to start or timed out
				const error = result.error.message || "failed to execute";
				failures.push(`${file}: ${error}`);
			}
		}

		if (failures.length > 0) {
			return {
				id: "hook-runtime",
				name: "Hook Runtime",
				group: "claudekit",
				priority: "standard",
				status: "fail",
				message: `${failures.length} hook(s) failed dry-run`,
				details: failures.join("\n"),
				suggestion: "Run: ck init",
				autoFixable: true,
				fix: {
					id: "fix-hook-runtime",
					description: "Reinstall hooks via ck init",
					execute: async () => ({
						success: false,
						message: "Manual fix required: run 'ck init'",
					}),
				},
			};
		}

		return {
			id: "hook-runtime",
			name: "Hook Runtime",
			group: "claudekit",
			priority: "standard",
			status: "pass",
			message: `${cjsFiles.length} hook(s) passed dry-run`,
			autoFixable: false,
		};
	} catch (error) {
		logger.debug(`Hook runtime check failed: ${error}`);
		return {
			id: "hook-runtime",
			name: "Hook Runtime",
			group: "claudekit",
			priority: "standard",
			status: "fail",
			message: "Failed to check hook runtime",
			details: error instanceof Error ? error.message : String(error),
			autoFixable: false,
		};
	}
}

/**
 * Check hook configuration validity
 */
export async function checkHookConfig(projectDir: string): Promise<CheckResult> {
	const projectConfigPath = join(projectDir, ".claude", ".ck.json");
	const globalConfigPath = join(PathResolver.getGlobalKitDir(), ".ck.json");

	// Prefer project config, fallback to global
	const configPath = existsSync(projectConfigPath)
		? projectConfigPath
		: existsSync(globalConfigPath)
			? globalConfigPath
			: null;

	if (!configPath) {
		return {
			id: "hook-config",
			name: "Hook Config",
			group: "claudekit",
			priority: "standard",
			status: "info",
			message: "No .ck.json config",
			autoFixable: false,
		};
	}

	const hooksDir = getHooksDir(projectDir);
	if (!hooksDir) {
		return {
			id: "hook-config",
			name: "Hook Config",
			group: "claudekit",
			priority: "standard",
			status: "info",
			message: "No hooks directory",
			autoFixable: false,
		};
	}

	try {
		const configContent = readFileSync(configPath, "utf-8");
		const config = JSON.parse(configContent);

		if (!config.hooks || typeof config.hooks !== "object") {
			return {
				id: "hook-config",
				name: "Hook Config",
				group: "claudekit",
				priority: "standard",
				status: "pass",
				message: "No hooks configured",
				autoFixable: false,
			};
		}

		const files = await readdir(hooksDir);
		// Config keys are without extension (e.g., "session-init")
		// Files have extensions (e.g., "session-init.cjs")
		const hookBaseNames = new Set(
			files
				.filter((f) => HOOK_EXTENSIONS.some((ext) => f.endsWith(ext)))
				.map((f) => {
					for (const ext of HOOK_EXTENSIONS) {
						if (f.endsWith(ext)) return f.slice(0, -ext.length);
					}
					return f;
				}),
		);
		const orphanedEntries: string[] = [];

		for (const hookName of Object.keys(config.hooks)) {
			if (!hookBaseNames.has(hookName)) {
				orphanedEntries.push(hookName);
			}
		}

		if (orphanedEntries.length > 0) {
			return {
				id: "hook-config",
				name: "Hook Config",
				group: "claudekit",
				priority: "standard",
				status: "warn",
				message: `${orphanedEntries.length} orphaned config entry(ies)`,
				details: orphanedEntries.join(", "),
				suggestion: "Remove orphaned entries from .ck.json",
				autoFixable: true,
				fix: {
					id: "fix-hook-config",
					description: "Remove orphaned entries from .ck.json",
					execute: async () => {
						try {
							for (const entry of orphanedEntries) {
								delete config.hooks[entry];
							}
							const updatedConfig = JSON.stringify(config, null, 2);
							writeFileSync(configPath, updatedConfig, "utf-8");
							return {
								success: true,
								message: `Removed ${orphanedEntries.length} orphaned entry(ies)`,
							};
						} catch (err) {
							return {
								success: false,
								message: `Failed to update .ck.json: ${err}`,
							};
						}
					},
				},
			};
		}

		return {
			id: "hook-config",
			name: "Hook Config",
			group: "claudekit",
			priority: "standard",
			status: "pass",
			message: "All config entries valid",
			autoFixable: false,
		};
	} catch (error) {
		logger.debug(`Hook config check failed: ${error}`);
		return {
			id: "hook-config",
			name: "Hook Config",
			group: "claudekit",
			priority: "standard",
			status: "fail",
			message: "Failed to validate config",
			details: error instanceof Error ? error.message : String(error),
			autoFixable: false,
		};
	}
}

/**
 * Check hook crash logs (last 24h)
 */
export async function checkHookLogs(projectDir: string): Promise<CheckResult> {
	const hooksDir = getHooksDir(projectDir);

	if (!hooksDir) {
		return {
			id: "hook-logs",
			name: "Hook Crash Logs",
			group: "claudekit",
			priority: "standard",
			status: "info",
			message: "No hooks directory",
			autoFixable: false,
		};
	}

	const logPath = join(hooksDir, ".logs", "hook-log.jsonl");

	if (!existsSync(logPath)) {
		return {
			id: "hook-logs",
			name: "Hook Crash Logs",
			group: "claudekit",
			priority: "standard",
			status: "pass",
			message: "No crash logs",
			autoFixable: false,
		};
	}

	try {
		// Guard against excessively large log files
		const logStats = statSync(logPath);
		if (logStats.size > MAX_LOG_FILE_SIZE_BYTES) {
			return {
				id: "hook-logs",
				name: "Hook Crash Logs",
				group: "claudekit",
				priority: "standard",
				status: "warn",
				message: `Log file too large (${Math.round(logStats.size / 1024 / 1024)}MB)`,
				suggestion: "Delete .claude/hooks/.logs/hook-log.jsonl and run: ck init",
				autoFixable: true,
				fix: {
					id: "fix-hook-logs",
					description: "Clear oversized log file",
					execute: async () => {
						try {
							writeFileSync(logPath, "", "utf-8");
							return { success: true, message: "Cleared oversized log file" };
						} catch (err) {
							return { success: false, message: `Failed to clear log: ${err}` };
						}
					},
				},
			};
		}

		const logContent = readFileSync(logPath, "utf-8");
		const lines = logContent.trim().split("\n").filter(Boolean);

		const now = Date.now();
		const oneDayAgo = now - 24 * 60 * 60 * 1000;
		const crashes: Array<{ hook: string; error: string }> = [];

		for (const line of lines) {
			try {
				const entry = JSON.parse(line);
				const timestamp = new Date(entry.ts || entry.timestamp).getTime();

				if (timestamp >= oneDayAgo && entry.status === "crash") {
					crashes.push({
						hook: entry.hook || "unknown",
						error: entry.error || "unknown error",
					});
				}
			} catch {
				// Skip invalid JSON lines
			}
		}

		if (crashes.length === 0) {
			return {
				id: "hook-logs",
				name: "Hook Crash Logs",
				group: "claudekit",
				priority: "standard",
				status: "pass",
				message: "No crashes in last 24h",
				autoFixable: false,
			};
		}

		if (crashes.length <= 5) {
			const hookList = crashes.map((c) => `${c.hook}: ${c.error}`).join("\n");
			return {
				id: "hook-logs",
				name: "Hook Crash Logs",
				group: "claudekit",
				priority: "standard",
				status: "warn",
				message: `${crashes.length} crash(es) in last 24h`,
				details: hookList,
				suggestion: "Run: ck init",
				autoFixable: true,
				fix: {
					id: "fix-hook-logs",
					description: "Clear log file",
					execute: async () => {
						try {
							writeFileSync(logPath, "", "utf-8");
							return {
								success: true,
								message: "Cleared crash log file",
							};
						} catch (err) {
							return {
								success: false,
								message: `Failed to clear log: ${err}`,
							};
						}
					},
				},
			};
		}

		const hookCounts = crashes.reduce(
			(acc, c) => {
				acc[c.hook] = (acc[c.hook] || 0) + 1;
				return acc;
			},
			{} as Record<string, number>,
		);

		const topCrashers = Object.entries(hookCounts)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([hook, count]) => `${hook} (${count}x)`)
			.join(", ");

		return {
			id: "hook-logs",
			name: "Hook Crash Logs",
			group: "claudekit",
			priority: "standard",
			status: "fail",
			message: `${crashes.length} crashes in last 24h`,
			details: `Most frequent: ${topCrashers}`,
			suggestion: "Run: ck init",
			autoFixable: true,
			fix: {
				id: "fix-hook-logs",
				description: "Clear log file and suggest reinstall",
				execute: async () => {
					try {
						writeFileSync(logPath, "", "utf-8");
						return {
							success: true,
							message: "Cleared crash log. Run 'ck init' to reinstall hooks.",
						};
					} catch (err) {
						return {
							success: false,
							message: `Failed to clear log: ${err}`,
						};
					}
				},
			},
		};
	} catch (error) {
		logger.debug(`Hook logs check failed: ${error}`);
		return {
			id: "hook-logs",
			name: "Hook Crash Logs",
			group: "claudekit",
			priority: "standard",
			status: "fail",
			message: "Failed to check crash logs",
			details: error instanceof Error ? error.message : String(error),
			autoFixable: false,
		};
	}
}

/**
 * Check CLI version against npm registry
 */
export async function checkCliVersion(): Promise<CheckResult> {
	try {
		// Try to get installed version from ck -V command
		const versionResult = spawnSync("ck", ["-V"], {
			timeout: HOOK_CHECK_TIMEOUT_MS,
			encoding: "utf-8",
		});

		let installedVersion = "unknown";
		if (versionResult.status === 0 && versionResult.stdout) {
			installedVersion = versionResult.stdout.trim();
		}

		if (installedVersion === "unknown") {
			return {
				id: "cli-version",
				name: "CLI Version",
				group: "claudekit",
				priority: "critical",
				status: "warn",
				message: "Cannot determine installed version",
				autoFixable: false,
			};
		}

		// Get latest version from npm
		const npmResult = spawnSync("npm", ["view", "claudekit-cli", "version"], {
			timeout: HOOK_CHECK_TIMEOUT_MS,
			encoding: "utf-8",
		});

		if (npmResult.status !== 0) {
			return {
				id: "cli-version",
				name: "CLI Version",
				group: "claudekit",
				priority: "critical",
				status: "warn",
				message: `v${installedVersion} (unable to check for updates)`,
				autoFixable: false,
			};
		}

		const latestVersion = npmResult.stdout?.trim() || installedVersion;
		// Strip pre-release suffix (e.g., "3.34.1-dev.4" → "3.34.1") for clean comparison
		const parseVersion = (v: string) => v.replace(/-.*$/, "").split(".").map(Number);
		const [installedMajor, installedMinor] = parseVersion(installedVersion);
		const [latestMajor, latestMinor] = parseVersion(latestVersion);

		// Major version behind
		if (installedMajor < latestMajor) {
			return {
				id: "cli-version",
				name: "CLI Version",
				group: "claudekit",
				priority: "critical",
				status: "fail",
				message: `v${installedVersion} (latest: v${latestVersion})`,
				details: "Major version behind",
				suggestion: "Run: ck update",
				autoFixable: true,
				fix: {
					id: "fix-cli-version",
					description: "Update CLI to latest version",
					execute: async () => ({
						success: false,
						message: "Manual fix required: run 'ck update'",
					}),
				},
			};
		}

		// Minor version behind
		if (installedMajor === latestMajor && installedMinor < latestMinor) {
			return {
				id: "cli-version",
				name: "CLI Version",
				group: "claudekit",
				priority: "critical",
				status: "warn",
				message: `v${installedVersion} (latest: v${latestVersion})`,
				details: "Minor version behind",
				suggestion: "Run: ck update",
				autoFixable: true,
				fix: {
					id: "fix-cli-version",
					description: "Update CLI to latest version",
					execute: async () => ({
						success: false,
						message: "Manual fix required: run 'ck update'",
					}),
				},
			};
		}

		return {
			id: "cli-version",
			name: "CLI Version",
			group: "claudekit",
			priority: "critical",
			status: "pass",
			message: `v${installedVersion} (up to date)`,
			autoFixable: false,
		};
	} catch (error) {
		logger.debug(`CLI version check failed: ${error}`);
		return {
			id: "cli-version",
			name: "CLI Version",
			group: "claudekit",
			priority: "critical",
			status: "warn",
			message: "Failed to check version",
			details: error instanceof Error ? error.message : String(error),
			autoFixable: false,
		};
	}
}

/**
 * Check Python virtual environment in skills
 */
export async function checkPythonVenv(projectDir: string): Promise<CheckResult> {
	// Cross-platform venv paths: Unix uses bin/python3, Windows uses Scripts/python.exe
	const isWindows = process.platform === "win32";
	const venvBin = isWindows ? join("Scripts", "python.exe") : join("bin", "python3");

	const projectVenvPath = join(projectDir, ".claude", "skills", ".venv", venvBin);
	const globalVenvPath = join(PathResolver.getGlobalKitDir(), "skills", ".venv", venvBin);

	const venvPath = existsSync(projectVenvPath)
		? projectVenvPath
		: existsSync(globalVenvPath)
			? globalVenvPath
			: null;

	if (!venvPath) {
		return {
			id: "python-venv",
			name: "Python Venv",
			group: "claudekit",
			priority: "standard",
			status: "warn",
			message: "Virtual environment not found",
			suggestion: "Delete .venv and run install.sh",
			autoFixable: true,
			fix: {
				id: "fix-python-venv",
				description: "Delete .venv and suggest reinstall",
				execute: async () => ({
					success: false,
					message: "Manual fix required: delete .venv and run install.sh",
				}),
			},
		};
	}

	try {
		const result = spawnSync(venvPath, ["--version"], {
			timeout: PYTHON_CHECK_TIMEOUT_MS,
			encoding: "utf-8",
		});

		if (result.status !== 0) {
			return {
				id: "python-venv",
				name: "Python Venv",
				group: "claudekit",
				priority: "standard",
				status: "fail",
				message: "Python venv exists but broken",
				details: result.stderr?.trim() || "Failed to run python3 --version",
				suggestion: "Delete .venv and run install.sh",
				autoFixable: true,
				fix: {
					id: "fix-python-venv",
					description: "Delete .venv",
					execute: async () => ({
						success: false,
						message: "Manual fix required: delete .venv and run install.sh",
					}),
				},
			};
		}

		const version = result.stdout?.trim() || "unknown";
		return {
			id: "python-venv",
			name: "Python Venv",
			group: "claudekit",
			priority: "standard",
			status: "pass",
			message: version,
			autoFixable: false,
		};
	} catch (error) {
		logger.debug(`Python venv check failed: ${error}`);
		return {
			id: "python-venv",
			name: "Python Venv",
			group: "claudekit",
			priority: "standard",
			status: "fail",
			message: "Failed to check venv",
			details: error instanceof Error ? error.message : String(error),
			autoFixable: false,
		};
	}
}
