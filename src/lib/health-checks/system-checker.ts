import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { DependencyName, DependencyStatus } from "../../types.js";
import { checkAllDependencies } from "../../utils/dependency-checker.js";
import {
	detectOS,
	getInstallerMethods,
	installDependency,
} from "../../utils/dependency-installer.js";
import type { CheckResult, Checker, FixAction, FixResult } from "./types.js";

const execAsync = promisify(exec);

/** SystemChecker validates system dependencies (Node.js, npm, Python, pip, Claude CLI, git, gh) */
export class SystemChecker implements Checker {
	readonly group = "system" as const;

	async run(): Promise<CheckResult[]> {
		const deps = await checkAllDependencies();
		const results: CheckResult[] = [];

		// Map dependency status to check results
		for (const dep of deps) {
			results.push(await this.mapDependencyToCheck(dep));
		}

		// Add git and gh checks
		results.push(await this.checkGit());
		results.push(await this.checkGitHubCli());

		return results;
	}

	private async mapDependencyToCheck(dep: DependencyStatus): Promise<CheckResult> {
		const isInstalled = dep.installed && dep.meetsRequirements;
		const name = this.formatDependencyName(dep.name);

		return {
			id: `${dep.name}-version`,
			name,
			group: "system",
			status: isInstalled ? "pass" : dep.installed ? "warn" : "fail",
			message: this.buildMessage(dep),
			details: dep.path,
			suggestion: !isInstalled ? this.getSuggestion(dep.name as DependencyName) : undefined,
			autoFixable: this.isAutoFixable(dep.name as DependencyName),
			fix: !isInstalled ? this.createInstallFix(dep.name as DependencyName) : undefined,
		};
	}

	private formatDependencyName(name: string): string {
		const nameMap: Record<string, string> = {
			nodejs: "Node.js",
			npm: "npm",
			python: "Python",
			pip: "pip",
			claude: "Claude CLI",
		};
		return nameMap[name] || name.charAt(0).toUpperCase() + name.slice(1);
	}

	private buildMessage(dep: DependencyStatus): string {
		if (!dep.installed) return "Not installed";
		if (!dep.meetsRequirements && dep.minVersion) {
			return `v${dep.version} (requires >=${dep.minVersion})`;
		}
		return dep.version ? `v${dep.version}` : "Installed";
	}

	private getSuggestion(name: DependencyName): string {
		const suggestions: Record<string, string> = {
			nodejs: "Install Node.js 16+ from nodejs.org or via package manager",
			npm: "npm comes with Node.js - install Node.js first",
			python: "Install Python 3.8+ from python.org or via package manager",
			pip: "pip comes with Python - install Python first",
			claude: "Install Claude CLI from https://claude.ai/download",
		};
		return suggestions[name] || `Install ${name}`;
	}

	private isAutoFixable(name: DependencyName): boolean {
		// pip and npm come with their parent packages
		return !["pip", "npm"].includes(name);
	}

	private createInstallFix(name: DependencyName): FixAction | undefined {
		if (!this.isAutoFixable(name)) return undefined;

		return {
			id: `install-${name}`,
			description: `Install ${this.formatDependencyName(name)}`,
			execute: async (): Promise<FixResult> => {
				const osInfo = await detectOS();
				const methods = getInstallerMethods(name, osInfo);

				if (methods.length === 0) {
					return {
						success: false,
						message: `No auto-install method for ${name} on ${osInfo.platform}`,
					};
				}

				const result = await installDependency(name);
				return {
					success: result.success,
					message: result.message,
					details: result.installedVersion ? `Installed v${result.installedVersion}` : undefined,
				};
			},
		};
	}

	private async checkGit(): Promise<CheckResult> {
		try {
			const { stdout } = await execAsync("git --version");
			const match = stdout.match(/(\d+\.\d+\.\d+)/);
			return {
				id: "git-version",
				name: "Git",
				group: "system",
				status: "pass",
				message: match ? `v${match[1]}` : "Installed",
				autoFixable: false,
			};
		} catch {
			return {
				id: "git-version",
				name: "Git",
				group: "system",
				status: "fail",
				message: "Not installed",
				suggestion: "Install Git from https://git-scm.com/downloads",
				autoFixable: false,
			};
		}
	}

	private async checkGitHubCli(): Promise<CheckResult> {
		try {
			const { stdout } = await execAsync("gh --version");
			const match = stdout.match(/(\d+\.\d+\.\d+)/);
			return {
				id: "gh-cli-version",
				name: "GitHub CLI",
				group: "system",
				status: "pass",
				message: match ? `v${match[1]}` : "Installed",
				autoFixable: true,
				fix: undefined, // Already installed
			};
		} catch {
			return {
				id: "gh-cli-version",
				name: "GitHub CLI",
				group: "system",
				status: "warn",
				message: "Not installed",
				suggestion: "Install: brew install gh (macOS) or winget install GitHub.cli (Windows)",
				autoFixable: true,
				fix: this.createGhCliFix(),
			};
		}
	}

	private createGhCliFix(): FixAction {
		return {
			id: "install-gh-cli",
			description: "Install GitHub CLI",
			execute: async (): Promise<FixResult> => {
				const osInfo = await detectOS();
				let command: string;

				if (osInfo.platform === "darwin" && osInfo.hasHomebrew) {
					command = "brew install gh";
				} else if (osInfo.platform === "linux" && osInfo.hasApt) {
					command = "sudo apt install gh -y";
				} else if (osInfo.platform === "win32") {
					command = "winget install GitHub.cli";
				} else {
					return {
						success: false,
						message: "No auto-install method available",
						details: "Visit https://cli.github.com for installation",
					};
				}

				try {
					await execAsync(command);
					return { success: true, message: "GitHub CLI installed successfully" };
				} catch (error) {
					return {
						success: false,
						message: `Installation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
					};
				}
			},
		};
	}
}
