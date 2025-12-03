import { exec } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import type { CheckResult, Checker, FixAction, FixResult } from "./types.js";

const execAsync = promisify(exec);

/** ProjectChecker validates project files (package.json, node_modules, lock files, tsconfig) */
export class ProjectChecker implements Checker {
	readonly group = "project" as const;
	private projectDir: string;

	constructor(projectDir: string = process.cwd()) {
		this.projectDir = projectDir;
	}

	async run(): Promise<CheckResult[]> {
		return [
			this.checkPackageJson(),
			this.checkNodeModules(),
			this.checkLockFile(),
			this.checkTsConfig(),
		];
	}

	private hasPackageJson(): boolean {
		return existsSync(join(this.projectDir, "package.json"));
	}

	private makeResult(
		id: string,
		name: string,
		status: "pass" | "warn" | "fail" | "info",
		message: string,
		extra?: Partial<CheckResult>,
	): CheckResult {
		return { id, name, group: "project", status, message, autoFixable: false, ...extra };
	}

	private checkPackageJson(): CheckResult {
		const pkgPath = join(this.projectDir, "package.json");
		if (!existsSync(pkgPath)) {
			return this.makeResult(
				"project-package-json",
				"package.json",
				"info",
				"Not a Node.js project",
			);
		}

		try {
			const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
			if (!pkg.name || !pkg.version) {
				return this.makeResult(
					"project-package-json",
					"package.json",
					"warn",
					"Missing name/version",
					{
						suggestion: "Add name and version to package.json",
					},
				);
			}
			return this.makeResult(
				"project-package-json",
				"package.json",
				"pass",
				`${pkg.name}@${pkg.version}`,
				{
					details: pkgPath,
				},
			);
		} catch {
			return this.makeResult("project-package-json", "package.json", "fail", "Invalid JSON", {
				suggestion: "Fix syntax errors in package.json",
			});
		}
	}

	private checkNodeModules(): CheckResult {
		if (!this.hasPackageJson()) {
			return this.makeResult("project-node-modules", "node_modules", "info", "N/A");
		}

		const nodeModulesPath = join(this.projectDir, "node_modules");
		if (!existsSync(nodeModulesPath)) {
			return this.makeResult("project-node-modules", "node_modules", "warn", "Not installed", {
				suggestion: "Run: npm install or bun install",
				autoFixable: true,
				fix: this.createInstallFix(),
			});
		}

		try {
			if (!statSync(nodeModulesPath).isDirectory()) {
				return this.makeResult("project-node-modules", "node_modules", "fail", "Not a directory", {
					suggestion: "rm -rf node_modules && npm install",
					autoFixable: true,
					fix: this.createInstallFix(),
				});
			}
			return this.makeResult("project-node-modules", "node_modules", "pass", "Installed", {
				details: nodeModulesPath,
			});
		} catch {
			return this.makeResult("project-node-modules", "node_modules", "warn", "Unable to verify");
		}
	}

	private checkLockFile(): CheckResult {
		if (!this.hasPackageJson()) {
			return this.makeResult("project-lock-file", "Lock File", "info", "N/A");
		}

		const lockFiles = [
			{ name: "bun.lockb", mgr: "bun" },
			{ name: "package-lock.json", mgr: "npm" },
			{ name: "yarn.lock", mgr: "yarn" },
			{ name: "pnpm-lock.yaml", mgr: "pnpm" },
		];

		for (const { name, mgr } of lockFiles) {
			if (existsSync(join(this.projectDir, name))) {
				return this.makeResult("project-lock-file", "Lock File", "pass", `${name} (${mgr})`);
			}
		}

		return this.makeResult("project-lock-file", "Lock File", "warn", "No lock file", {
			suggestion: "Run npm install to generate package-lock.json",
		});
	}

	private checkTsConfig(): CheckResult {
		if (!this.hasPackageJson()) {
			return this.makeResult("project-tsconfig", "tsconfig.json", "info", "N/A");
		}

		const tsconfigPath = join(this.projectDir, "tsconfig.json");
		if (existsSync(tsconfigPath)) {
			return this.makeResult("project-tsconfig", "tsconfig.json", "pass", "Found", {
				details: tsconfigPath,
			});
		}

		// Check if TypeScript project without tsconfig
		try {
			const pkg = JSON.parse(readFileSync(join(this.projectDir, "package.json"), "utf-8"));
			const hasTs = pkg.devDependencies?.typescript || pkg.dependencies?.typescript;
			if (hasTs) {
				return this.makeResult(
					"project-tsconfig",
					"tsconfig.json",
					"warn",
					"Missing (TS detected)",
					{
						suggestion: "Run: npx tsc --init",
					},
				);
			}
		} catch {
			/* ignore */
		}

		return this.makeResult("project-tsconfig", "tsconfig.json", "info", "Not a TypeScript project");
	}

	private createInstallFix(): FixAction {
		return {
			id: "npm-install",
			description: "Install dependencies",
			execute: async (): Promise<FixResult> => {
				try {
					const cmd = existsSync(join(this.projectDir, "bun.lockb"))
						? "bun install"
						: "npm install";
					await execAsync(cmd, { cwd: this.projectDir });
					return { success: true, message: `Installed via ${cmd}` };
				} catch (e) {
					return {
						success: false,
						message: `Failed: ${e instanceof Error ? e.message : "Unknown"}`,
					};
				}
			},
		};
	}
}
