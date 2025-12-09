import { logger } from "../../shared/logger.js";
import type {
	CheckGroup,
	CheckPriority,
	CheckResult,
	CheckRunnerOptions,
	CheckSummary,
	Checker,
} from "./types.js";

/**
 * CheckRunner orchestrates health checks across multiple domain-specific checkers.
 * Supports parallel execution, group filtering, and aggregated summaries.
 */
export class CheckRunner {
	private checkers: Checker[] = [];
	private options: CheckRunnerOptions;

	constructor(options: CheckRunnerOptions = {}) {
		this.options = options;
		logger.verbose("CheckRunner initialized", { options });
	}

	/**
	 * Register a domain-specific checker
	 */
	registerChecker(checker: Checker): void {
		this.checkers.push(checker);
	}

	/**
	 * Register multiple checkers at once
	 */
	registerCheckers(checkers: Checker[]): void {
		for (const checker of checkers) {
			this.registerChecker(checker);
		}
	}

	/**
	 * Run all registered checks in parallel (grouped by domain)
	 * Returns aggregated CheckSummary
	 */
	async run(): Promise<CheckSummary> {
		logger.verbose("Starting health check run");
		const filteredCheckers = this.filterCheckersByGroup();
		logger.verbose(`Running ${filteredCheckers.length} checker(s)`, {
			groups: filteredCheckers.map((c) => c.group),
		});
		const allResults = await this.executeCheckersInParallel(filteredCheckers);
		const filteredResults = this.filterChecksByPriority(allResults);
		logger.verbose("All checks completed, building summary");
		return this.buildSummary(filteredResults);
	}

	/**
	 * Filter checkers by group if groups option is specified
	 */
	private filterCheckersByGroup(): Checker[] {
		if (!this.options.groups || this.options.groups.length === 0) {
			return this.checkers;
		}

		const allowedGroups = new Set<CheckGroup>(this.options.groups);
		return this.checkers.filter((checker) => allowedGroups.has(checker.group));
	}

	/**
	 * Filter checks by priority level
	 */
	private filterChecksByPriority(checks: CheckResult[]): CheckResult[] {
		const includedPriorities = new Set<CheckPriority>(["critical", "standard"]);
		if (this.options.full) {
			includedPriorities.add("extended");
		}
		return checks.filter((check) => {
			const priority = check.priority ?? "standard";
			return includedPriorities.has(priority);
		});
	}

	/**
	 * Execute checkers in parallel - each checker can run independently
	 */
	private async executeCheckersInParallel(checkers: Checker[]): Promise<CheckResult[]> {
		const resultsArrays = await Promise.all(
			checkers.map(async (checker) => {
				logger.verbose(`Starting checker: ${checker.group}`);
				const results = await checker.run();
				logger.verbose(`Completed checker: ${checker.group}`, {
					checkCount: results.length,
				});
				return results;
			}),
		);
		return resultsArrays.flat();
	}

	/**
	 * Build summary from check results
	 */
	private buildSummary(checks: CheckResult[]): CheckSummary {
		let passed = 0;
		let warnings = 0;
		let failed = 0;
		let fixed = 0;

		for (const check of checks) {
			switch (check.status) {
				case "pass":
					passed++;
					break;
				case "warn":
					warnings++;
					break;
				case "fail":
					failed++;
					break;
				// 'info' doesn't count toward pass/fail metrics
			}

			if (check.fixed) {
				fixed++;
			}
		}

		return {
			timestamp: new Date().toISOString(),
			total: checks.length,
			passed,
			warnings,
			failed,
			fixed,
			checks,
		};
	}

	/**
	 * Get current options
	 */
	getOptions(): CheckRunnerOptions {
		return { ...this.options };
	}

	/**
	 * Get registered checkers (for testing/inspection)
	 */
	getCheckers(): Checker[] {
		return [...this.checkers];
	}
}
