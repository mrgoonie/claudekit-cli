import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { ClaudeKitSetup } from "../../types.js";
import { getClaudeKitSetup } from "../../utils/claudekit-scanner.js";
import { logger } from "../../utils/logger.js";
import { PackageManagerDetector } from "../package-manager-detector.js";
import type { CheckResult, Checker } from "./types.js";

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
				status: "pass",
				message: targetPath,
				autoFixable: false,
			};
		} catch {
			return {
				id: "ck-active-plan",
				name: "Active Plan",
				group: "claudekit",
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
			status: totalComponents > 0 ? "info" : "warn",
			message:
				totalComponents > 0
					? `${totalAgents} agents, ${totalCommands} commands, ${totalWorkflows} workflows, ${totalSkills} skills`
					: "No components found",
			suggestion: totalComponents === 0 ? "Install ClaudeKit: ck new --kit engineer" : undefined,
			autoFixable: false,
		};
	}
}
