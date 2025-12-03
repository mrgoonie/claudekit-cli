import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ClaudeKitSetup } from "../../types.js";
import { getClaudeKitSetup } from "../../utils/claudekit-scanner.js";
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
		const setup = await getClaudeKitSetup(this.projectDir);
		const results: CheckResult[] = [];

		results.push(this.checkGlobalInstall(setup));
		results.push(this.checkProjectInstall(setup));
		results.push(...this.checkSkillsScripts(setup));
		results.push(this.checkComponentCounts(setup));

		return results;
	}

	private checkGlobalInstall(setup: ClaudeKitSetup): CheckResult {
		const hasGlobal = !!setup.global.path;
		const version = setup.global.metadata?.version;

		return {
			id: "ck-global-install",
			name: "Global ClaudeKit",
			group: "claudekit",
			status: hasGlobal ? "pass" : "warn",
			message: hasGlobal ? (version ? `v${version}` : "Installed") : "Not installed",
			details: hasGlobal ? setup.global.path : undefined,
			suggestion: !hasGlobal ? "Install globally: ck init --global" : undefined,
			autoFixable: false, // Manual: ck init --global
		};
	}

	private checkProjectInstall(setup: ClaudeKitSetup): CheckResult {
		const hasProject = !!setup.project.path;
		const version = setup.project.metadata?.version;

		return {
			id: "ck-project-install",
			name: "Project ClaudeKit",
			group: "claudekit",
			status: hasProject ? "pass" : "info",
			message: hasProject ? (version ? `v${version}` : "Installed") : "Not in a ClaudeKit project",
			details: hasProject ? setup.project.path : undefined,
			suggestion: !hasProject ? "Initialize: ck new or ck init" : undefined,
			autoFixable: false, // Requires user choice
		};
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

		// Check project skills
		if (setup.project.path) {
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
