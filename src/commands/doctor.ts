import * as clack from "@clack/prompts";
import {
	AuthChecker,
	AutoHealer,
	type CheckResult,
	CheckRunner,
	type CheckRunnerOptions,
	type CheckSummary,
	ClaudekitChecker,
	ModuleResolver,
	ProjectChecker,
	ReportGenerator,
	SystemChecker,
} from "../lib/health-checks/index.js";
import { isNonInteractive } from "../utils/environment.js";
import { logger } from "../utils/logger.js";

interface DoctorOptions {
	global?: boolean;
	report?: boolean;
	fix?: boolean;
	checkOnly?: boolean;
	json?: boolean;
}

export async function doctorCommand(options: DoctorOptions = {}): Promise<void> {
	const { global: globalOnly, report, fix, checkOnly, json } = options;

	const runnerOptions: CheckRunnerOptions = {
		fix: fix ?? false,
		checkOnly: checkOnly ?? false,
		json: json ?? false,
		verbose: logger.isVerbose(),
	};

	// Don't show intro in JSON mode
	if (!json) {
		clack.intro("ClaudeKit Health Check");
	}

	// Create and configure runner
	const runner = new CheckRunner(runnerOptions);

	// Register checkers
	runner.registerChecker(new SystemChecker());
	runner.registerChecker(new ClaudekitChecker());
	runner.registerChecker(new AuthChecker());

	// Skip project/module checks if global only
	if (!globalOnly) {
		runner.registerChecker(new ProjectChecker());
		runner.registerChecker(new ModuleResolver());
	}

	// Run all checks
	const summary = await runner.run();

	// Handle --json output
	if (json) {
		const generator = new ReportGenerator();
		console.log(generator.generateJsonReport(summary));
		process.exit(summary.failed > 0 && checkOnly ? 1 : 0);
	}

	// Display results
	displayResults(summary);

	// Handle --report flag
	if (report) {
		const generator = new ReportGenerator();
		const textReport = generator.generateTextReport(summary);
		console.log(`\n${textReport}`);

		const gistResult = await generator.uploadToGist(textReport);
		if (gistResult) {
			logger.info(`Report uploaded: ${gistResult.url}`);
		}
	}

	// Handle --fix flag
	if (fix) {
		const healer = new AutoHealer();
		const healSummary = await healer.healAll(summary.checks);
		displayHealingSummary(healSummary);

		if (healSummary.failed === 0 && healSummary.succeeded > 0) {
			clack.outro("All fixable issues resolved!");
			process.exit(0);
		}
	}

	// Handle --check-only mode exit code
	if (checkOnly && summary.failed > 0) {
		process.exit(1);
	}

	// Default interactive mode: prompt to fix if issues found
	if (!checkOnly && !fix && !report && summary.failed > 0) {
		const fixable = summary.checks.filter((c) => c.autoFixable && c.status !== "pass" && c.fix);

		if (fixable.length > 0 && !isNonInteractive()) {
			const shouldFix = await clack.confirm({
				message: `${fixable.length} issue(s) can be fixed automatically. Fix now?`,
				initialValue: true,
			});

			if (!clack.isCancel(shouldFix) && shouldFix) {
				const healer = new AutoHealer();
				const healSummary = await healer.healAll(summary.checks);
				displayHealingSummary(healSummary);
			}
		}
	}

	// Outro
	if (summary.failed === 0) {
		clack.outro("All checks passed!");
	} else {
		clack.outro(`${summary.failed} issue(s) found`);
	}
}

function displayResults(summary: CheckSummary): void {
	// Group by check group
	const groups = new Map<string, CheckResult[]>();
	for (const check of summary.checks) {
		const group = groups.get(check.group) || [];
		group.push(check);
		groups.set(check.group, group);
	}

	// Display each group
	for (const [groupName, checks] of groups) {
		logger.info("");
		logger.info(`${groupName.toUpperCase()}`);
		logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

		for (const check of checks) {
			const icon = getStatusIcon(check.status);
			logger.info(`${icon} ${check.name}`);
			logger.info(`   ${check.message}`);
			if (check.details) {
				logger.info(`   ${check.details}`);
			}
			if (check.suggestion) {
				logger.info(`   Suggestion: ${check.suggestion}`);
			}
		}
	}

	// Summary line
	logger.info("");
	logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
	logger.info(
		`Summary: ${summary.passed} passed, ${summary.warnings} warnings, ${summary.failed} failed`,
	);
}

function displayHealingSummary(summary: {
	succeeded: number;
	failed: number;
	fixes: Array<{ checkName: string; success: boolean; message: string; error?: string }>;
}): void {
	logger.info("");
	logger.info("Auto-Heal Results");
	logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

	for (const fix of summary.fixes) {
		const icon = fix.success ? "[OK]" : "[FAIL]";
		logger.info(`${icon} ${fix.checkName}`);
		logger.info(`   ${fix.message}`);
		if (fix.error) {
			logger.info(`   Error: ${fix.error}`);
		}
	}

	logger.info("");
	logger.info(`Fixed: ${summary.succeeded}, Failed: ${summary.failed}`);
}

function getStatusIcon(status: string): string {
	switch (status) {
		case "pass":
			return "[PASS]";
		case "warn":
			return "[WARN]";
		case "fail":
			return "[FAIL]";
		default:
			return "[INFO]";
	}
}
