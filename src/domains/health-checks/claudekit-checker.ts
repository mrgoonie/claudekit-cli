import { existsSync, readFileSync, statSync } from "node:fs";
import { constants, access, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, normalize, resolve } from "node:path";
import { getClaudeKitSetup } from "../../services/file-operations/claudekit-scanner.js";
import { logger } from "../../shared/logger.js";
import { PathResolver } from "../../shared/path-resolver.js";
import type { ClaudeKitSetup } from "../../types/index.js";
import { PackageManagerDetector } from "../installation/package-manager-detector.js";
import type { CheckResult, Checker } from "./types.js";

// Hook file extensions that are recognized
const HOOK_EXTENSIONS = [".js", ".cjs", ".mjs", ".ts", ".sh", ".ps1"];

/**
 * ClaudekitChecker validates ClaudeKit installations (global + project)
 */
export class ClaudekitChecker implements Checker {
	readonly group = "claudekit" as const;
	private projectDir: string;

	constructor(projectDir: string = process.cwd()) {
		this.projectDir = projectDir;
	}

	async run(): Promise<CheckResult[]> {
		logger.verbose("ClaudekitChecker: Scanning ClaudeKit setup", {
			projectDir: this.projectDir,
		});
		const setup = await getClaudeKitSetup(this.projectDir);
		logger.verbose("ClaudekitChecker: Setup scan complete");
		const results: CheckResult[] = [];

		// Existing checks
		logger.verbose("ClaudekitChecker: Checking CLI install method");
		results.push(await this.checkCliInstallMethod());
		logger.verbose("ClaudekitChecker: Checking global install");
		results.push(this.checkGlobalInstall(setup));
		logger.verbose("ClaudekitChecker: Checking project install");
		results.push(this.checkProjectInstall(setup));
		logger.verbose("ClaudekitChecker: Checking CLAUDE.md files");
		results.push(...this.checkClaudeMd(setup));
		logger.verbose("ClaudekitChecker: Checking active plan");
		results.push(this.checkActivePlan());
		logger.verbose("ClaudekitChecker: Checking skills scripts");
		results.push(...this.checkSkillsScripts(setup));
		logger.verbose("ClaudekitChecker: Checking component counts");
		results.push(this.checkComponentCounts(setup));

		// New checks
		logger.verbose("ClaudekitChecker: Checking global dir readability");
		results.push(await this.checkGlobalDirReadable());
		logger.verbose("ClaudekitChecker: Checking global dir writability");
		results.push(await this.checkGlobalDirWritable());
		logger.verbose("ClaudekitChecker: Checking hooks directory");
		results.push(await this.checkHooksExist());
		logger.verbose("ClaudekitChecker: Checking settings.json validity");
		results.push(await this.checkSettingsValid());
		logger.verbose("ClaudekitChecker: Checking path references");
		results.push(await this.checkPathRefsValid());
		logger.verbose("ClaudekitChecker: Checking project config completeness");
		results.push(await this.checkProjectConfigCompleteness(setup));

		logger.verbose("ClaudekitChecker: All checks complete");
		return results;
	}

	/** Check how the CLI was installed (npm, bun, yarn, pnpm) */
	private async checkCliInstallMethod(): Promise<CheckResult> {
		// Skip external command execution in test environment to prevent hangs
		if (process.env.NODE_ENV === "test") {
			logger.verbose("ClaudekitChecker: Skipping PM detection in test mode");
			return {
				id: "ck-cli-install-method",
				name: "CLI Installed Via",
				group: "claudekit",
				priority: "standard",
				status: "pass",
				message: "Test Mode (skipped)",
				autoFixable: false,
			};
		}

		const pm = await PackageManagerDetector.detect();
		const pmVersion = await PackageManagerDetector.getVersion(pm);
		const displayName = PackageManagerDetector.getDisplayName(pm);

		return {
			id: "ck-cli-install-method",
			name: "CLI Installed Via",
			group: "claudekit",
			priority: "standard",
			status: pm !== "unknown" ? "pass" : "warn",
			message: pmVersion ? `${displayName} (v${pmVersion})` : displayName,
			suggestion: pm === "unknown" ? "Run: npm install -g claudekit-cli" : undefined,
			autoFixable: false,
		};
	}

	private checkGlobalInstall(setup: ClaudeKitSetup): CheckResult {
		const hasGlobal = !!setup.global.path;
		const metadata = setup.global.metadata;
		const kitName = metadata?.name || "ClaudeKit";
		const version = this.formatVersion(metadata?.version);

		return {
			id: "ck-global-install",
			name: "Global CK",
			group: "claudekit",
			priority: "critical",
			status: hasGlobal ? "pass" : "warn",
			message: hasGlobal ? `${kitName} ${version}` : "Not installed",
			details: hasGlobal ? setup.global.path : undefined,
			suggestion: !hasGlobal ? "Install globally: ck init --global" : undefined,
			autoFixable: false, // Manual: ck init --global
		};
	}

	private checkProjectInstall(setup: ClaudeKitSetup): CheckResult {
		const metadata = setup.project.metadata;
		// A real ClaudeKit project requires metadata.json (not just .claude dir)
		const hasProject = !!metadata;
		const kitName = metadata?.name || "ClaudeKit";
		const version = this.formatVersion(metadata?.version);

		return {
			id: "ck-project-install",
			name: "Project CK",
			group: "claudekit",
			priority: "standard",
			status: hasProject ? "pass" : "info",
			message: hasProject ? `${kitName} ${version}` : "Not a ClaudeKit project",
			details: hasProject ? setup.project.path : undefined,
			suggestion: !hasProject ? "Initialize: ck new or ck init" : undefined,
			autoFixable: false, // Requires user choice
		};
	}

	/** Format version string - ensure single 'v' prefix */
	private formatVersion(version: string | undefined): string {
		if (!version) return "";
		// Remove leading 'v' if present, then add it back consistently
		return `v${version.replace(/^v/, "")}`;
	}

	/** Check CLAUDE.md existence and health (global + project) */
	private checkClaudeMd(setup: ClaudeKitSetup): CheckResult[] {
		const results: CheckResult[] = [];

		// Global CLAUDE.md
		if (setup.global.path) {
			const globalClaudeMd = join(setup.global.path, "CLAUDE.md");
			results.push(
				this.checkClaudeMdFile(globalClaudeMd, "Global CLAUDE.md", "ck-global-claude-md"),
			);
		}

		// Project CLAUDE.md - check in .claude directory
		const projectClaudeMd = join(this.projectDir, ".claude", "CLAUDE.md");
		results.push(
			this.checkClaudeMdFile(projectClaudeMd, "Project CLAUDE.md", "ck-project-claude-md"),
		);

		return results;
	}

	/** Helper to check a single CLAUDE.md file */
	private checkClaudeMdFile(path: string, name: string, id: string): CheckResult {
		if (!existsSync(path)) {
			return {
				id,
				name,
				group: "claudekit",
				priority: "standard",
				status: "warn",
				message: "Missing",
				suggestion: "Create CLAUDE.md with project instructions",
				autoFixable: false,
			};
		}

		try {
			const stat = statSync(path);
			const sizeKB = (stat.size / 1024).toFixed(1);

			if (stat.size === 0) {
				return {
					id,
					name,
					group: "claudekit",
					priority: "standard",
					status: "warn",
					message: "Empty (0 bytes)",
					details: path,
					suggestion: "Add project instructions to CLAUDE.md",
					autoFixable: false,
				};
			}

			return {
				id,
				name,
				group: "claudekit",
				priority: "standard",
				status: "pass",
				message: `Found (${sizeKB}KB)`,
				details: path,
				autoFixable: false,
			};
		} catch {
			return {
				id,
				name,
				group: "claudekit",
				priority: "standard",
				status: "warn",
				message: "Unreadable",
				details: path,
				suggestion: "Check file permissions",
				autoFixable: false,
			};
		}
	}

	/** Check active-plan file points to valid plan */
	private checkActivePlan(): CheckResult {
		const activePlanPath = join(this.projectDir, ".claude", "active-plan");

		if (!existsSync(activePlanPath)) {
			return {
				id: "ck-active-plan",
				name: "Active Plan",
				group: "claudekit",
				priority: "standard",
				status: "info",
				message: "None",
				autoFixable: false,
			};
		}

		try {
			const targetPath = readFileSync(activePlanPath, "utf-8").trim();
			const fullPath = join(this.projectDir, targetPath);

			if (!existsSync(fullPath)) {
				return {
					id: "ck-active-plan",
					name: "Active Plan",
					group: "claudekit",
					priority: "standard",
					status: "warn",
					message: "Orphaned (target missing)",
					details: targetPath,
					suggestion: "Run: rm .claude/active-plan",
					autoFixable: false,
				};
			}

			return {
				id: "ck-active-plan",
				name: "Active Plan",
				group: "claudekit",
				priority: "standard",
				status: "pass",
				message: targetPath,
				autoFixable: false,
			};
		} catch {
			return {
				id: "ck-active-plan",
				name: "Active Plan",
				group: "claudekit",
				priority: "standard",
				status: "warn",
				message: "Unreadable",
				details: activePlanPath,
				autoFixable: false,
			};
		}
	}

	private checkSkillsScripts(setup: ClaudeKitSetup): CheckResult[] {
		const results: CheckResult[] = [];
		const platform = process.platform;
		const scriptName = platform === "win32" ? "install.ps1" : "install.sh";

		// Check global skills
		if (setup.global.path) {
			const globalScriptPath = join(setup.global.path, "skills", scriptName);
			const hasGlobalScript = existsSync(globalScriptPath);

			results.push({
				id: "ck-global-skills-script",
				name: "Global Skills Script",
				group: "claudekit",
				priority: "standard",
				status: hasGlobalScript ? "pass" : "info",
				message: hasGlobalScript ? "Available" : "Not found",
				details: hasGlobalScript ? globalScriptPath : undefined,
				suggestion: !hasGlobalScript ? "Run: ck init --global --install-skills" : undefined,
				autoFixable: false,
			});
		}

		// Check project skills - only if it's a real ClaudeKit project (has metadata)
		if (setup.project.metadata) {
			const projectScriptPath = join(setup.project.path, "skills", scriptName);
			const hasProjectScript = existsSync(projectScriptPath);

			results.push({
				id: "ck-project-skills-script",
				name: "Project Skills Script",
				group: "claudekit",
				priority: "standard",
				status: hasProjectScript ? "pass" : "info",
				message: hasProjectScript ? "Available" : "Not found",
				details: hasProjectScript ? projectScriptPath : undefined,
				suggestion: !hasProjectScript ? "Run: ck init --install-skills" : undefined,
				autoFixable: false,
			});
		}

		return results;
	}

	private checkComponentCounts(setup: ClaudeKitSetup): CheckResult {
		const global = setup.global.components;
		const project = setup.project.components;

		const totalAgents = global.agents + project.agents;
		const totalCommands = global.commands + project.commands;
		const totalWorkflows = global.workflows + project.workflows;
		const totalSkills = global.skills + project.skills;
		const totalComponents = totalAgents + totalCommands + totalWorkflows + totalSkills;

		return {
			id: "ck-component-counts",
			name: "ClaudeKit Components",
			group: "claudekit",
			priority: "standard",
			status: totalComponents > 0 ? "info" : "warn",
			message:
				totalComponents > 0
					? `${totalAgents} agents, ${totalCommands} commands, ${totalWorkflows} workflows, ${totalSkills} skills`
					: "No components found",
			suggestion: totalComponents === 0 ? "Install ClaudeKit: ck new --kit engineer" : undefined,
			autoFixable: false,
		};
	}

	/** Check if global directory is readable */
	private async checkGlobalDirReadable(): Promise<CheckResult> {
		const globalDir = PathResolver.getGlobalKitDir();

		try {
			// Use access() to check read permission - more efficient than reading file contents
			await access(globalDir, constants.R_OK);

			return {
				id: "ck-global-dir-readable",
				name: "Global Dir Readable",
				group: "claudekit",
				priority: "standard",
				status: "pass",
				message: "Read access OK",
				details: globalDir,
				autoFixable: false,
			};
		} catch (error) {
			return {
				id: "ck-global-dir-readable",
				name: "Global Dir Readable",
				group: "claudekit",
				priority: "standard",
				status: "fail",
				message: "Read access denied",
				details: globalDir,
				suggestion: "Check file permissions on ~/.claude/",
				autoFixable: false,
			};
		}
	}

	/** Check if global directory is writable */
	private async checkGlobalDirWritable(): Promise<CheckResult> {
		const globalDir = PathResolver.getGlobalKitDir();
		// Generate unique filename to avoid race conditions
		const timestamp = Date.now();
		const random = Math.random().toString(36).substring(2);
		const testFile = join(globalDir, `.ck-write-test-${timestamp}-${random}`);

		try {
			// Use atomic writeFile with 'wx' flag to fail if file exists
			// This prevents race conditions between concurrent tests
			await writeFile(testFile, "test", { encoding: "utf-8", flag: "wx" });
		} catch (error) {
			// If write fails, directory is not writable or file already exists
			return {
				id: "ck-global-dir-writable",
				name: "Global Dir Writable",
				group: "claudekit",
				priority: "standard",
				status: "fail",
				message: "Write access denied",
				details: globalDir,
				suggestion: "Check file permissions on ~/.claude/",
				autoFixable: false,
			};
		}

		// Try to clean up the test file, but don't fail if cleanup fails
		try {
			await unlink(testFile);
		} catch (_error) {
			// Cleanup failed, but directory is still writable
			logger.verbose("Failed to cleanup write test file", { testFile });
		}

		// Write succeeded, directory is writable
		return {
			id: "ck-global-dir-writable",
			name: "Global Dir Writable",
			group: "claudekit",
			priority: "standard",
			status: "pass",
			message: "Write access OK",
			details: globalDir,
			autoFixable: false,
		};
	}

	/**
	 * Normalize path for case-insensitive filesystem comparison.
	 * On Windows/macOS, paths with different casing refer to the same file.
	 */
	private normalizePath(filePath: string): string {
		// First normalize path separators and resolve path structure
		const normalized = normalize(filePath);

		// Normalize to lowercase on case-insensitive filesystems (Windows, macOS)
		const isCaseInsensitive = process.platform === "win32" || process.platform === "darwin";
		return isCaseInsensitive ? normalized.toLowerCase() : normalized;
	}

	/** Check if hooks directory exists and contains hooks */
	private async checkHooksExist(): Promise<CheckResult> {
		const globalHooksDir = join(PathResolver.getGlobalKitDir(), "hooks");
		const projectHooksDir = join(this.projectDir, ".claude", "hooks");

		const globalExists = existsSync(globalHooksDir);
		const projectExists = existsSync(projectHooksDir);

		let hookCount = 0;
		const checkedFiles = new Set<string>();

		// Check global hooks directory
		if (globalExists) {
			const files = await readdir(globalHooksDir, { withFileTypes: false });
			const hooks = files.filter((f) => HOOK_EXTENSIONS.some((ext) => f.endsWith(ext)));

			// Add unique hooks with normalized path to avoid double-counting on case-insensitive FS
			hooks.forEach((hook) => {
				const fullPath = join(globalHooksDir, hook);
				checkedFiles.add(this.normalizePath(fullPath));
			});
		}

		// Check project hooks directory only if it's different from global (case-insensitive comparison)
		const normalizedGlobal = this.normalizePath(globalHooksDir);
		const normalizedProject = this.normalizePath(projectHooksDir);

		if (projectExists && normalizedProject !== normalizedGlobal) {
			const files = await readdir(projectHooksDir, { withFileTypes: false });
			const hooks = files.filter((f) => HOOK_EXTENSIONS.some((ext) => f.endsWith(ext)));

			// Add unique hooks with normalized path
			hooks.forEach((hook) => {
				const fullPath = join(projectHooksDir, hook);
				checkedFiles.add(this.normalizePath(fullPath));
			});
		}

		hookCount = checkedFiles.size;

		if (!globalExists && !projectExists) {
			return {
				id: "ck-hooks-exist",
				name: "Hooks Directory",
				group: "claudekit",
				priority: "standard",
				status: "info",
				message: "No hooks directory",
				autoFixable: false,
			};
		}

		return {
			id: "ck-hooks-exist",
			name: "Hooks Directory",
			group: "claudekit",
			priority: "standard",
			status: "pass",
			message: `${hookCount} hook(s) found`,
			details: globalExists ? globalHooksDir : projectHooksDir,
			autoFixable: false,
		};
	}

	/** Check if settings.json has valid JSON structure */
	private async checkSettingsValid(): Promise<CheckResult> {
		const globalSettings = join(PathResolver.getGlobalKitDir(), "settings.json");
		const projectSettings = join(this.projectDir, ".claude", "settings.json");

		// Check global first, then project
		const settingsPath = existsSync(globalSettings)
			? globalSettings
			: existsSync(projectSettings)
				? projectSettings
				: null;

		if (!settingsPath) {
			return {
				id: "ck-settings-valid",
				name: "Settings.json",
				group: "claudekit",
				priority: "extended",
				status: "info",
				message: "No settings.json found",
				autoFixable: false,
			};
		}

		try {
			const content = await readFile(settingsPath, "utf-8");
			JSON.parse(content); // Validate JSON

			return {
				id: "ck-settings-valid",
				name: "Settings.json",
				group: "claudekit",
				priority: "extended",
				status: "pass",
				message: "Valid JSON",
				details: settingsPath,
				autoFixable: false,
			};
		} catch (error) {
			// Distinguish between different error types for better debugging
			let message = "Invalid JSON";
			let suggestion = "Fix JSON syntax in settings.json";
			let details = settingsPath;

			if (error instanceof SyntaxError) {
				message = "JSON syntax error";
				details = `${settingsPath}: ${error.message}`;
				logger.verbose("Settings.json syntax error", {
					path: settingsPath,
					error: error.message,
				});
			} else if (error instanceof Error) {
				if (error.message.includes("EACCES") || error.message.includes("EPERM")) {
					message = "Permission denied";
					suggestion = "Check file permissions on settings.json";
				} else if (error.message.includes("ENOENT")) {
					message = "File not found";
					suggestion = "Ensure settings.json exists at the expected location";
				} else {
					message = `Read error: ${error.message}`;
					suggestion = "Check file system and permissions";
				}
				logger.verbose("Settings.json read error", {
					path: settingsPath,
					error: error.message,
					code: (error as any).code,
				});
			}

			return {
				id: "ck-settings-valid",
				name: "Settings.json",
				group: "claudekit",
				priority: "extended",
				status: "fail",
				message,
				details,
				suggestion,
				autoFixable: false,
			};
		}
	}

	/** Check if path references in CLAUDE.md are valid */
	private async checkPathRefsValid(): Promise<CheckResult> {
		const globalClaudeMd = join(PathResolver.getGlobalKitDir(), "CLAUDE.md");
		const projectClaudeMd = join(this.projectDir, ".claude", "CLAUDE.md");

		const claudeMdPath = existsSync(globalClaudeMd)
			? globalClaudeMd
			: existsSync(projectClaudeMd)
				? projectClaudeMd
				: null;

		if (!claudeMdPath) {
			return {
				id: "ck-path-refs-valid",
				name: "Path References",
				group: "claudekit",
				priority: "extended",
				status: "info",
				message: "No CLAUDE.md found",
				autoFixable: false,
			};
		}

		try {
			const content = await readFile(claudeMdPath, "utf-8");

			// Find @path references (e.g., @.claude/workflows/foo.md)
			const refPattern = /@([^\s\)]+)/g;
			const refs = [...content.matchAll(refPattern)].map((m) => m[1]);

			if (refs.length === 0) {
				return {
					id: "ck-path-refs-valid",
					name: "Path References",
					group: "claudekit",
					priority: "extended",
					status: "info",
					message: "No @path references found",
					autoFixable: false,
				};
			}

			// Check each reference
			const baseDir = dirname(claudeMdPath);
			const home = homedir();
			const broken: string[] = [];

			for (const ref of refs) {
				// Resolve relative to CLAUDE.md location
				let refPath: string;
				if (ref.startsWith("$HOME") || ref.startsWith("%USERPROFILE%")) {
					// Handle home directory variables - normalize to prevent traversal
					refPath = normalize(ref.replace("$HOME", home).replace("%USERPROFILE%", home));
				} else if (ref.startsWith("/")) {
					// Absolute paths (Unix)
					refPath = normalize(ref);
				} else if (ref.includes(":") && ref.startsWith("\\")) {
					// Absolute paths (Windows)
					refPath = normalize(ref);
				} else {
					// Relative paths - resolve relative to CLAUDE.md directory
					refPath = resolve(baseDir, ref);
				}

				// Validate resolved path stays within expected boundaries
				// For home-relative paths, must stay within home directory
				// For relative paths, must stay within baseDir or be a valid resolved path
				const normalizedPath = normalize(refPath);
				const isWithinHome = normalizedPath.startsWith(home);
				const isWithinBase = normalizedPath.startsWith(normalize(baseDir));
				const isAbsoluteAllowed =
					ref.startsWith("/") || (ref.includes(":") && ref.startsWith("\\"));

				// Skip paths that escape expected boundaries (potential path traversal)
				if (!isWithinHome && !isWithinBase && !isAbsoluteAllowed) {
					logger.verbose("Skipping potentially unsafe path reference", { ref, refPath });
					continue;
				}

				if (!existsSync(normalizedPath)) {
					broken.push(ref);
				}
			}

			if (broken.length > 0) {
				return {
					id: "ck-path-refs-valid",
					name: "Path References",
					group: "claudekit",
					priority: "extended",
					status: "warn",
					message: `${broken.length}/${refs.length} broken`,
					details: broken.slice(0, 3).join(", "),
					suggestion: "Some @path references point to missing files",
					autoFixable: false,
				};
			}

			return {
				id: "ck-path-refs-valid",
				name: "Path References",
				group: "claudekit",
				priority: "extended",
				status: "pass",
				message: `${refs.length} valid`,
				autoFixable: false,
			};
		} catch (error) {
			return {
				id: "ck-path-refs-valid",
				name: "Path References",
				group: "claudekit",
				priority: "extended",
				status: "info",
				message: "Could not parse CLAUDE.md",
				autoFixable: false,
			};
		}
	}

	/** Check if project configuration is complete (not just CLAUDE.md) */
	private async checkProjectConfigCompleteness(setup: ClaudeKitSetup): Promise<CheckResult> {
		// Only check if we're in a project directory
		if (setup.project.path === setup.global.path) {
			return {
				id: "ck-project-config-complete",
				name: "Project Config Completeness",
				group: "claudekit",
				priority: "standard",
				status: "info",
				message: "Not in a project directory",
				autoFixable: false,
			};
		}

		const projectDir = join(this.projectDir, ".claude");
		const requiredDirs = ["agents", "commands", "workflows", "skills"];
		const missingDirs: string[] = [];

		// Check if required directories exist
		for (const dir of requiredDirs) {
			const dirPath = join(projectDir, dir);
			if (!existsSync(dirPath)) {
				missingDirs.push(dir);
			}
		}

		// Check if only CLAUDE.md exists (minimal config)
		const files = await readdir(projectDir).catch(() => []);
		const hasOnlyClaudeMd = files.length === 1 && (files as string[]).includes("CLAUDE.md");

		if (hasOnlyClaudeMd || missingDirs.length === requiredDirs.length) {
			return {
				id: "ck-project-config-complete",
				name: "Project Config Completeness",
				group: "claudekit",
				priority: "standard",
				status: "fail",
				message: "Incomplete configuration",
				details: "Only CLAUDE.md found - missing agents, commands, workflows, skills",
				suggestion: "Run 'ck init' to install complete ClaudeKit in project",
				autoFixable: false,
			};
		}

		if (missingDirs.length > 0) {
			return {
				id: "ck-project-config-complete",
				name: "Project Config Completeness",
				group: "claudekit",
				priority: "standard",
				status: "warn",
				message: `Missing ${missingDirs.length} directories`,
				details: `Missing: ${missingDirs.join(", ")}`,
				suggestion: "Run 'ck init' to update project configuration",
				autoFixable: false,
			};
		}

		return {
			id: "ck-project-config-complete",
			name: "Project Config Completeness",
			group: "claudekit",
			priority: "standard",
			status: "pass",
			message: "Complete configuration",
			details: projectDir,
			autoFixable: false,
		};
	}
}
