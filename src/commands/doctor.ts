import {
	AuthChecker,
	AutoHealer,
	CheckRunner,
	type CheckRunnerOptions,
	ClaudekitChecker,
	DoctorUIRenderer,
	NetworkChecker,
	PlatformChecker,
	ReportGenerator,
	SystemChecker,
} from "@/domains/health-checks/index.js";
import { isNonInteractive } from "@/shared/environment.js";
import { logger } from "@/shared/logger.js";
import { confirm, intro, isCancel, outro } from "@/shared/safe-prompts.js";

interface DoctorOptions {
	report?: boolean;
	fix?: boolean;
	checkOnly?: boolean;
	json?: boolean;
	full?: boolean;
}

export async function doctorCommand(options: DoctorOptions = {}): Promise<void> {
	const { report, fix, checkOnly, json, full } = options;

	const runnerOptions: CheckRunnerOptions = {
		fix: fix ?? false,
		checkOnly: checkOnly ?? false,
		json: json ?? false,
		verbose: logger.isVerbose(),
		full: full ?? false,
	};

	// Don't show intro in JSON/report mode
	if (!json && !report) {
		intro("ClaudeKit Health Check");
	}

	// Create and configure runner
	const runner = new CheckRunner(runnerOptions);

	// Register checkers
	runner.registerChecker(new SystemChecker());
	runner.registerChecker(new ClaudekitChecker());
	runner.registerChecker(new AuthChecker());
	runner.registerChecker(new PlatformChecker());
	runner.registerChecker(new NetworkChecker());

	// Run all checks
	const summary = await runner.run();

	// Handle --json output (exit early)
	if (json) {
		const generator = new ReportGenerator();
		console.log(generator.generateJsonReport(summary));
		// Use exitCode instead of exit() to allow stdout to flush properly
		process.exitCode = summary.failed > 0 && checkOnly ? 1 : 0;
		return;
	}

	// Handle --report flag (text report only, no interactive UI)
	if (report) {
		const generator = new ReportGenerator();
		const textReport = generator.generateTextReport(summary);
		console.log(textReport);

		const gistResult = await generator.uploadToGist(textReport);
		if (gistResult) {
			logger.info(`Report uploaded: ${gistResult.url}`);
		}
		return;
	}

	// Display interactive results (pass verbose flag for enhanced output)
	const renderer = new DoctorUIRenderer({ verbose: runnerOptions.verbose });
	renderer.renderResults(summary);

	// Handle --fix flag
	if (fix) {
		const healer = new AutoHealer();
		try {
			const healSummary = await healer.healAll(summary.checks);
			renderer.renderHealingSummary(healSummary);

			if (healSummary.failed === 0 && healSummary.succeeded > 0) {
				outro("All fixable issues resolved!");
				return;
			}
		} catch (error) {
			logger.error(`Auto-fix failed: ${error instanceof Error ? error.message : "Unknown error"}`);
			process.exitCode = 1;
		}
	}

	// Handle --check-only mode exit code
	if (checkOnly && summary.failed > 0) {
		process.exitCode = 1;
	}

	// Default interactive mode: prompt to fix if issues found
	if (!checkOnly && !fix && summary.failed > 0) {
		const fixable = summary.checks.filter((c) => c.autoFixable && c.status !== "pass" && c.fix);

		if (fixable.length > 0 && !isNonInteractive()) {
			const shouldFix = await confirm({
				message: `${fixable.length} issue(s) can be fixed automatically. Fix now?`,
				initialValue: true,
			});

			if (!isCancel(shouldFix) && shouldFix) {
				const healer = new AutoHealer();
				const healSummary = await healer.healAll(summary.checks);
				renderer.renderHealingSummary(healSummary);
			}
		}
	}

	// Outro
	if (summary.failed === 0) {
		outro("All checks passed!");
	} else {
		outro(`${summary.failed} issue(s) found`);
	}
}
