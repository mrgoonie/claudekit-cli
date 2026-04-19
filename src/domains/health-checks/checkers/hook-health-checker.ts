import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { type SettingsJson, SettingsMerger } from "@/domains/config/settings-merger.js";
import { CLAUDEKIT_CLI_NPM_PACKAGE_NAME } from "@/shared/claudekit-constants.js";
import { repairClaudeNodeCommandPath } from "@/shared/command-normalizer.js";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
import type { CheckResult } from "../types.js";
import { HOOK_EXTENSIONS } from "./shared.js";

const HOOK_CHECK_TIMEOUT_MS = 5000;
const PYTHON_CHECK_TIMEOUT_MS = 3000;
const MAX_LOG_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

interface ClaudeSettingsFile {
	path: string;
	label: string;
	root: string;
}

interface HookCommandFinding {
	path: string;
	label: string;
	eventName: string;
	matcher?: string;
	command: string;
	expected: string;
	issue: "raw-relative" | "invalid-format";
}

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

function getCanonicalGlobalCommandRoot(): string {
	const configuredGlobalDir = PathResolver.getGlobalKitDir()
		.replace(/\\/g, "/")
		.replace(/\/+$/, "");
	const defaultGlobalDir = join(homedir(), ".claude").replace(/\\/g, "/");
	return configuredGlobalDir === defaultGlobalDir ? "$HOME" : configuredGlobalDir;
}

function getClaudeSettingsFiles(projectDir: string): ClaudeSettingsFile[] {
	const globalClaudeDir = PathResolver.getGlobalKitDir();
	const candidates: ClaudeSettingsFile[] = [
		{
			path: resolve(projectDir, ".claude", "settings.json"),
			label: "project settings.json",
			root: "$CLAUDE_PROJECT_DIR",
		},
		{
			path: resolve(projectDir, ".claude", "settings.local.json"),
			label: "project settings.local.json",
			root: "$CLAUDE_PROJECT_DIR",
		},
		{
			path: resolve(globalClaudeDir, "settings.json"),
			label: "global settings.json",
			root: getCanonicalGlobalCommandRoot(),
		},
		{
			path: resolve(globalClaudeDir, "settings.local.json"),
			label: "global settings.local.json",
			root: getCanonicalGlobalCommandRoot(),
		},
	];

	return candidates.filter((candidate) => existsSync(candidate.path));
}

function collectHookCommandFindings(
	settings: SettingsJson,
	settingsFile: ClaudeSettingsFile,
): HookCommandFinding[] {
	if (!settings.hooks) {
		return [];
	}

	const findings: HookCommandFinding[] = [];
	for (const [eventName, entries] of Object.entries(settings.hooks)) {
		for (const entry of entries) {
			if ("command" in entry && typeof entry.command === "string") {
				const repair = repairClaudeNodeCommandPath(entry.command, settingsFile.root);
				if (repair.changed && repair.issue) {
					findings.push({
						path: settingsFile.path,
						label: settingsFile.label,
						eventName,
						command: entry.command,
						expected: repair.command,
						issue: repair.issue,
					});
				}
			}

			if (!("hooks" in entry) || !entry.hooks) {
				continue;
			}

			for (const hook of entry.hooks) {
				if (!hook.command) {
					continue;
				}

				const repair = repairClaudeNodeCommandPath(hook.command, settingsFile.root);
				if (!repair.changed || !repair.issue) {
					continue;
				}

				findings.push({
					path: settingsFile.path,
					label: settingsFile.label,
					eventName,
					matcher: "matcher" in entry ? entry.matcher : undefined,
					command: hook.command,
					expected: repair.command,
					issue: repair.issue,
				});
			}
		}
	}

	return findings;
}

async function repairHookCommandsInSettingsFile(settingsFile: ClaudeSettingsFile): Promise<number> {
	const settings = await SettingsMerger.readSettingsFile(settingsFile.path);
	if (!settings?.hooks) {
		return 0;
	}

	let repaired = 0;
	for (const entries of Object.values(settings.hooks)) {
		for (const entry of entries) {
			if ("command" in entry && typeof entry.command === "string") {
				const repair = repairClaudeNodeCommandPath(entry.command, settingsFile.root);
				if (repair.changed) {
					entry.command = repair.command;
					repaired++;
				}
			}

			if (!("hooks" in entry) || !entry.hooks) {
				continue;
			}

			for (const hook of entry.hooks) {
				if (!hook.command) {
					continue;
				}

				const repair = repairClaudeNodeCommandPath(hook.command, settingsFile.root);
				if (repair.changed) {
					hook.command = repair.command;
					repaired++;
				}
			}
		}
	}

	if (repaired > 0) {
		await SettingsMerger.writeSettingsFile(settingsFile.path, settings);
	}

	return repaired;
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
 * Validate configured hook commands in Claude settings files.
 * Unlike checkHookRuntime, this inspects the actual command strings Claude executes.
 */
export async function checkHookCommandPaths(projectDir: string): Promise<CheckResult> {
	const settingsFiles = getClaudeSettingsFiles(projectDir);

	if (settingsFiles.length === 0) {
		return {
			id: "hook-command-paths",
			name: "Hook Command Paths",
			group: "claudekit",
			priority: "standard",
			status: "info",
			message: "No Claude settings files",
			autoFixable: false,
		};
	}

	const findings: HookCommandFinding[] = [];
	for (const settingsFile of settingsFiles) {
		const settings = await SettingsMerger.readSettingsFile(settingsFile.path);
		if (!settings) {
			continue;
		}
		findings.push(...collectHookCommandFindings(settings, settingsFile));
	}

	if (findings.length === 0) {
		return {
			id: "hook-command-paths",
			name: "Hook Command Paths",
			group: "claudekit",
			priority: "standard",
			status: "pass",
			message: `${settingsFiles.length} settings file(s) canonical`,
			autoFixable: false,
		};
	}

	const details = findings
		.slice(0, 5)
		.map((finding) => {
			const matcher = finding.matcher ? ` [${finding.matcher}]` : "";
			return `${finding.label} :: ${finding.eventName}${matcher} :: ${finding.issue} :: ${finding.command}`;
		})
		.join("\n");

	return {
		id: "hook-command-paths",
		name: "Hook Command Paths",
		group: "claudekit",
		priority: "standard",
		status: "fail",
		message: `${findings.length} stale hook command path(s)`,
		details,
		suggestion: "Run: ck doctor --fix",
		autoFixable: true,
		fix: {
			id: "fix-hook-command-paths",
			description: "Canonicalize stale .claude hook command paths in settings files",
			execute: async () => {
				try {
					let repaired = 0;
					for (const settingsFile of settingsFiles) {
						repaired += await repairHookCommandsInSettingsFile(settingsFile);
					}
					if (repaired === 0) {
						return {
							success: true,
							message: "No stale hook command paths needed repair",
						};
					}
					return {
						success: true,
						message: `Repaired ${repaired} stale hook command path(s)`,
					};
				} catch (error) {
					return {
						success: false,
						message: `Failed to repair hook command paths: ${error}`,
					};
				}
			},
		},
	};
}

interface MissingHookReference {
	path: string;
	label: string;
	eventName: string;
	matcher?: string;
	command: string;
	scriptPath: string;
	resolvedPath: string;
}

/**
 * Extract a `.cjs` hook script path from a `node`-style hook command.
 * Returns null if the command is not a node-executed `.claude` hook.
 */
function extractHookScriptPath(cmd: string | null | undefined): string | null {
	if (!cmd) return null;
	// Strip all double-quotes: the .cjs anchor terminates the capture before any trailing
	// args, so extra quotes in arg values won't corrupt the extracted path.
	const stripped = cmd.replace(/"/g, "");
	// Match: node <path-ending-in-.cjs> (followed by whitespace or end)
	const match = stripped.match(/\bnode\s+(\S*?\.claude[/\\]\S+?\.cjs)(?:\s|$)/);
	if (!match) return null;
	return match[1];
}

/**
 * Resolve a hook script path token into an absolute filesystem path.
 * Handles $HOME, $CLAUDE_PROJECT_DIR, ~, %USERPROFILE%, %CLAUDE_PROJECT_DIR%,
 * and bare `.claude/...` relative forms.
 */
function resolveHookScriptPath(scriptPath: string, projectDir: string): string {
	let resolved = scriptPath.replace(/\\/g, "/");
	const home = homedir();
	resolved = resolved.replace(/^\$\{?HOME\}?/, home);
	resolved = resolved.replace(/^\$\{?CLAUDE_PROJECT_DIR\}?/, projectDir);
	resolved = resolved.replace(/^%USERPROFILE%/, home);
	resolved = resolved.replace(/^%CLAUDE_PROJECT_DIR%/, projectDir);
	resolved = resolved.replace(/^~\//, `${home}/`);
	if (resolved.startsWith(".claude/") || resolved === ".claude") {
		resolved = join(projectDir, resolved);
	}
	return resolve(resolved);
}

function collectMissingHookReferences(
	settings: SettingsJson,
	settingsFile: ClaudeSettingsFile,
	projectDir: string,
): MissingHookReference[] {
	if (!settings.hooks) return [];

	const findings: MissingHookReference[] = [];
	const seen = new Set<string>();

	const consider = (
		eventName: string,
		command: string | undefined,
		matcher: string | undefined,
	) => {
		if (!command) return;
		const scriptPath = extractHookScriptPath(command);
		if (!scriptPath) return;
		const resolvedPath = resolveHookScriptPath(scriptPath, projectDir);
		if (existsSync(resolvedPath)) return;
		const key = `${settingsFile.path}::${eventName}::${matcher ?? ""}::${scriptPath}`;
		if (seen.has(key)) return;
		seen.add(key);
		findings.push({
			path: settingsFile.path,
			label: settingsFile.label,
			eventName,
			matcher,
			command,
			scriptPath,
			resolvedPath,
		});
	};

	for (const [eventName, entries] of Object.entries(settings.hooks)) {
		for (const entry of entries) {
			if ("command" in entry && typeof entry.command === "string") {
				consider(eventName, entry.command, undefined);
			}
			if ("hooks" in entry && entry.hooks) {
				const matcher = "matcher" in entry ? entry.matcher : undefined;
				for (const hook of entry.hooks) {
					consider(eventName, hook.command, matcher);
				}
			}
		}
	}

	return findings;
}

async function pruneMissingHookReferencesInSettingsFile(
	settingsFile: ClaudeSettingsFile,
	projectDir: string,
): Promise<number> {
	const settings = await SettingsMerger.readSettingsFile(settingsFile.path);
	if (!settings?.hooks) return 0;

	let pruned = 0;

	const hookFileMissing = (command: string | undefined): boolean => {
		if (!command) return false;
		const scriptPath = extractHookScriptPath(command);
		if (!scriptPath) return false;
		return !existsSync(resolveHookScriptPath(scriptPath, projectDir));
	};

	const hooksRecord = settings.hooks as Record<string, unknown[]>;
	for (const [eventName, entries] of Object.entries(hooksRecord)) {
		const filteredEntries: unknown[] = [];
		for (const entry of entries) {
			const e = entry as { command?: string; hooks?: Array<{ command?: string }> };
			// Flat command entry
			if (typeof e.command === "string") {
				if (hookFileMissing(e.command)) {
					pruned++;
					continue;
				}
				filteredEntries.push(entry);
				continue;
			}

			// Matcher entry with nested hooks[]
			if (Array.isArray(e.hooks)) {
				const keptHooks = e.hooks.filter((h) => {
					if (hookFileMissing(h.command)) {
						pruned++;
						return false;
					}
					return true;
				});
				if (keptHooks.length === 0) {
					continue;
				}
				filteredEntries.push({ ...e, hooks: keptHooks });
				continue;
			}

			filteredEntries.push(entry);
		}
		if (filteredEntries.length === 0) {
			delete hooksRecord[eventName];
		} else {
			hooksRecord[eventName] = filteredEntries;
		}
	}

	if (Object.keys(hooksRecord).length === 0) {
		// biome-ignore lint/performance/noDelete: clearer semantics than = undefined for key removal
		delete (settings as Record<string, unknown>).hooks;
	}

	if (pruned > 0) {
		await SettingsMerger.writeSettingsFile(settingsFile.path, settings);
	}

	return pruned;
}

/**
 * Validate that hook commands in Claude settings reference files that exist on disk.
 * Catches stale references that produce MODULE_NOT_FOUND at Claude Code runtime.
 */
export async function checkHookFileReferences(projectDir: string): Promise<CheckResult> {
	const settingsFiles = getClaudeSettingsFiles(projectDir);

	if (settingsFiles.length === 0) {
		return {
			id: "hook-file-references",
			name: "Hook File References",
			group: "claudekit",
			priority: "critical",
			status: "info",
			message: "No Claude settings files",
			autoFixable: false,
		};
	}

	const findings: MissingHookReference[] = [];
	for (const settingsFile of settingsFiles) {
		const settings = await SettingsMerger.readSettingsFile(settingsFile.path);
		if (!settings) continue;
		findings.push(...collectMissingHookReferences(settings, settingsFile, projectDir));
	}

	if (findings.length === 0) {
		return {
			id: "hook-file-references",
			name: "Hook File References",
			group: "claudekit",
			priority: "critical",
			status: "pass",
			message: "All referenced hook files exist",
			autoFixable: false,
		};
	}

	const details = findings
		.slice(0, 8)
		.map((f) => {
			const matcher = f.matcher ? ` [${f.matcher}]` : "";
			return `${f.label} :: ${f.eventName}${matcher} :: missing ${f.scriptPath}`;
		})
		.join("\n");

	return {
		id: "hook-file-references",
		name: "Hook File References",
		group: "claudekit",
		priority: "critical",
		status: "fail",
		message: `${findings.length} settings hook(s) reference missing file(s)`,
		details,
		suggestion: "Run: ck doctor --fix (prunes stale entries), then 'ck init' to restore hooks",
		autoFixable: true,
		fix: {
			id: "fix-hook-file-references",
			description: "Prune stale hook entries whose script files are missing",
			execute: async () => {
				try {
					let pruned = 0;
					for (const settingsFile of settingsFiles) {
						pruned += await pruneMissingHookReferencesInSettingsFile(settingsFile, projectDir);
					}
					if (pruned === 0) {
						return { success: true, message: "No stale hook entries needed pruning" };
					}
					return {
						success: true,
						message: `Pruned ${pruned} stale hook entry(ies). Run 'ck init' to restore hooks if needed.`,
					};
				} catch (error) {
					return {
						success: false,
						message: `Failed to prune stale hook entries: ${error}`,
					};
				}
			},
		},
	};
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
		const npmResult = spawnSync("npm", ["view", CLAUDEKIT_CLI_NPM_PACKAGE_NAME, "version"], {
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
