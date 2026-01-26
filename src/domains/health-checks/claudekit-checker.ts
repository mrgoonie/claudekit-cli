import { getClaudeKitSetup } from "@/services/file-operations/claudekit-scanner.js";
import { logger } from "@/shared/logger.js";
import {
	checkActivePlan,
	checkClaudeMd,
	checkCliInstallMethod,
	checkComponentCounts,
	checkEnvKeys,
	checkGlobalDirReadable,
	checkGlobalDirWritable,
	checkGlobalInstall,
	checkHooksExist,
	checkPathRefsValid,
	checkProjectConfigCompleteness,
	checkProjectInstall,
	checkSettingsValid,
	checkSkillsScripts,
} from "./checkers/index.js";
import type { CheckResult, Checker } from "./types.js";

/**
 * ClaudekitChecker validates ClaudeKit installations (global + project)
 * This is a facade that orchestrates individual checker functions.
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

		// CLI installation check
		logger.verbose("ClaudekitChecker: Checking CLI install method");
		results.push(await checkCliInstallMethod());

		// Global and project installation checks
		logger.verbose("ClaudekitChecker: Checking global install");
		results.push(checkGlobalInstall(setup));
		logger.verbose("ClaudekitChecker: Checking project install");
		results.push(checkProjectInstall(setup));

		// CLAUDE.md checks
		logger.verbose("ClaudekitChecker: Checking CLAUDE.md files");
		results.push(...checkClaudeMd(setup, this.projectDir));

		// Active plan check
		logger.verbose("ClaudekitChecker: Checking active plan");
		results.push(checkActivePlan(this.projectDir));

		// Skills checks
		logger.verbose("ClaudekitChecker: Checking skills scripts");
		results.push(...checkSkillsScripts(setup));
		logger.verbose("ClaudekitChecker: Checking component counts");
		results.push(checkComponentCounts(setup));

		// Environment keys check
		logger.verbose("ClaudekitChecker: Checking required environment keys");
		results.push(...(await checkEnvKeys(setup)));

		// Permission checks
		logger.verbose("ClaudekitChecker: Checking global dir readability");
		results.push(await checkGlobalDirReadable());
		logger.verbose("ClaudekitChecker: Checking global dir writability");
		results.push(await checkGlobalDirWritable());

		// Hooks check
		logger.verbose("ClaudekitChecker: Checking hooks directory");
		results.push(await checkHooksExist(this.projectDir));

		// Settings check
		logger.verbose("ClaudekitChecker: Checking settings.json validity");
		results.push(await checkSettingsValid(this.projectDir));

		// Path references check
		logger.verbose("ClaudekitChecker: Checking path references");
		results.push(await checkPathRefsValid(this.projectDir));

		// Config completeness check
		logger.verbose("ClaudekitChecker: Checking project config completeness");
		results.push(await checkProjectConfigCompleteness(setup, this.projectDir));

		logger.verbose("ClaudekitChecker: All checks complete");
		return results;
	}
}
