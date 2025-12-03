import * as clack from "@clack/prompts";
import {
	AuthChecker,
	AutoHealer,
	CheckRunner,
	type CheckRunnerOptions,
	ClaudekitChecker,
	DoctorUIRenderer,
	ReportGenerator,
	SystemChecker,
} from "../lib/health-checks/index.js";
import { isNonInteractive } from "../utils/environment.js";
import { logger } from "../utils/logger.js";

interface DoctorOptions {
	report?: boolean;
	fix?: boolean;
	checkOnly?: boolean;
	json?: boolean;
}

export async function doctorCommand(options: DoctorOptions = {}): Promise<void> {
	const { report, fix, checkOnly, json } = options;

	const runnerOptions: CheckRunnerOptions = {
		fix: fix ?? false,
		checkOnly: checkOnly ?? false,
		json: json ?? false,
		verbose: logger.isVerbose(),
	};

	// Don't show intro in JSON/report mode
	if (!json && !report) {
		clack.intro("ClaudeKit Health Check");
	}

	// Create and configure runner
	const runner = new CheckRunner(runnerOptions);

	// Register checkers
	runner.registerChecker(new SystemChecker());
	runner.registerChecker(new ClaudekitChecker());
	runner.registerChecker(new AuthChecker());

	// Run all checks
	const summary = await runner.run();

	// Handle --json output (exit early)
	if (json) {
		const generator = new ReportGenerator();
		console.log(generator.generateJsonReport(summary));
		process.exit(summary.failed > 0 && checkOnly ? 1 : 0);
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

	// Display interactive results
	const renderer = new DoctorUIRenderer();
	renderer.renderResults(summary);

	// Handle --fix flag
	if (fix) {
		const healer = new AutoHealer();
		const healSummary = await healer.healAll(summary.checks);
		renderer.renderHealingSummary(healSummary);

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
	if (!checkOnly && !fix && summary.failed > 0) {
		const fixable = summary.checks.filter((c) => c.autoFixable && c.status !== "pass" && c.fix);

		if (fixable.length > 0 && !isNonInteractive()) {
			const shouldFix = await clack.confirm({
				message: `${fixable.length} issue(s) can be fixed automatically. Fix now?`,
				initialValue: true,
			});

			if (!clack.isCancel(shouldFix) && shouldFix) {
				const healer = new AutoHealer();
				const healSummary = await healer.healAll(summary.checks);
				renderer.renderHealingSummary(healSummary);
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
