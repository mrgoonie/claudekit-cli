import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { PathResolver } from "../../utils/path-resolver.js";
import type { CheckResult, Checker, FixAction, FixResult } from "./types.js";

/** ModuleResolver validates skill dependencies via require.resolve() */
export class ModuleResolver implements Checker {
	readonly group = "modules" as const;
	private projectDir: string;

	constructor(projectDir: string = process.cwd()) {
		this.projectDir = projectDir;
	}

	async run(): Promise<CheckResult[]> {
		const results: CheckResult[] = [];

		// Scan global skills: ~/.claude/skills/*/package.json
		const globalSkillsDir = join(PathResolver.getGlobalKitDir(), "skills");
		if (existsSync(globalSkillsDir)) {
			results.push(...this.checkSkillsDir(globalSkillsDir, "global"));
		}

		// Scan project skills: .claude/skills/*/package.json
		const projectSkillsDir = join(this.projectDir, ".claude", "skills");
		if (existsSync(projectSkillsDir)) {
			results.push(...this.checkSkillsDir(projectSkillsDir, "project"));
		}

		// Info result if no skills found
		if (results.length === 0) {
			return [this.makeResult("module-no-skills", "Skills", "info", "No skills directories found")];
		}

		return results;
	}

	private makeResult(
		id: string,
		name: string,
		status: "pass" | "warn" | "fail" | "info",
		message: string,
		extra?: Partial<CheckResult>,
	): CheckResult {
		return { id, name, group: "modules", status, message, autoFixable: false, ...extra };
	}

	private checkSkillsDir(skillsDir: string, scope: "global" | "project"): CheckResult[] {
		const results: CheckResult[] = [];

		try {
			const entries = readdirSync(skillsDir);
			for (const skillName of entries) {
				const skillPath = join(skillsDir, skillName);
				try {
					if (!statSync(skillPath).isDirectory()) continue;
					const result = this.checkSkill(skillPath, skillName, scope);
					if (result) results.push(result);
				} catch {
					/* skip inaccessible entries */
				}
			}
		} catch {
			/* skills dir not readable */
		}

		return results;
	}

	private checkSkill(
		skillPath: string,
		name: string,
		scope: "global" | "project",
	): CheckResult | null {
		const pkgPath = join(skillPath, "package.json");
		if (!existsSync(pkgPath)) return null; // No package.json = not a Node.js skill

		let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
		try {
			pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
		} catch {
			return this.makeResult(
				`module-${scope}-${name}`,
				`Skill: ${name} (${scope})`,
				"warn",
				"Invalid package.json",
			);
		}

		const deps = { ...pkg.dependencies };
		if (Object.keys(deps).length === 0) {
			return this.makeResult(
				`module-${scope}-${name}`,
				`Skill: ${name} (${scope})`,
				"info",
				"No dependencies",
			);
		}

		const missing = this.checkDependencies(deps, skillPath);

		if (missing.length === 0) {
			return this.makeResult(
				`module-${scope}-${name}`,
				`Skill: ${name} (${scope})`,
				"pass",
				`${Object.keys(deps).length} deps OK`,
				{ details: skillPath },
			);
		}

		const truncatedMissing =
			missing.length > 3 ? [...missing.slice(0, 3), `+${missing.length - 3} more`] : missing;
		return this.makeResult(
			`module-${scope}-${name}`,
			`Skill: ${name} (${scope})`,
			"fail",
			`Missing: ${truncatedMissing.join(", ")}`,
			{
				suggestion: `Run: cd "${skillPath}" && npm install`,
				autoFixable: true,
				fix: this.createSkillInstallFix(skillPath, name),
			},
		);
	}

	private checkDependencies(deps: Record<string, string>, skillPath: string): string[] {
		const nodeModulesPath = join(skillPath, "node_modules");
		const missing: string[] = [];

		for (const dep of Object.keys(deps)) {
			try {
				require.resolve(dep, { paths: [nodeModulesPath] });
			} catch (e: unknown) {
				const err = e as { code?: string };
				if (err.code === "MODULE_NOT_FOUND") {
					missing.push(dep);
				}
			}
		}

		return missing;
	}

	private createSkillInstallFix(skillPath: string, name: string): FixAction {
		return {
			id: `fix-skill-${name}`,
			description: `Install dependencies for ${name}`,
			execute: async (): Promise<FixResult> => {
				try {
					// Detect package manager
					const useBun = existsSync(join(skillPath, "bun.lockb"));
					const cmd = useBun ? "bun install" : "npm install";
					execSync(cmd, { cwd: skillPath, stdio: "pipe" });
					return { success: true, message: `Installed deps for ${name} via ${cmd}` };
				} catch (e) {
					return {
						success: false,
						message: `Failed: ${e instanceof Error ? e.message : "Unknown error"}`,
					};
				}
			},
		};
	}
}
