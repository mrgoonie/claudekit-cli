import type { CheckResult, FixAttempt, FixResult, HealingSummary } from "./types.js";

/** AutoHealer executes all fixable checks with timeout protection */
export class AutoHealer {
	private timeout: number;

	constructor(options: { timeout?: number } = {}) {
		this.timeout = options.timeout ?? 30000; // 30s default
	}

	/** Execute all fixable checks, return summary */
	async healAll(checks: CheckResult[]): Promise<HealingSummary> {
		const fixable = checks.filter((c) => c.autoFixable && c.fix && c.status !== "pass");
		const fixes: FixAttempt[] = [];

		for (const check of fixable) {
			const attempt = await this.executeFix(check);
			fixes.push(attempt);

			// Update check in place
			check.fixed = attempt.success;
			if (!attempt.success && attempt.error) {
				check.fixError = attempt.error;
			}
		}

		return {
			totalFixable: fixable.length,
			attempted: fixes.length,
			succeeded: fixes.filter((f) => f.success).length,
			failed: fixes.filter((f) => !f.success).length,
			fixes,
		};
	}

	private async executeFix(check: CheckResult): Promise<FixAttempt> {
		const fix = check.fix;
		if (!fix) {
			return {
				checkId: check.id,
				checkName: check.name,
				fixId: "unknown",
				success: false,
				message: "No fix available",
				error: "Fix action not defined",
				duration: 0,
			};
		}

		const start = Date.now();
		try {
			const result = await Promise.race([fix.execute(), this.createTimeout()]);
			const attempt = this.buildAttempt(check, fix.id, result);
			attempt.duration = Date.now() - start;
			return attempt;
		} catch (e: unknown) {
			const err = e instanceof Error ? e.message : "Unknown error";
			return {
				checkId: check.id,
				checkName: check.name,
				fixId: fix.id,
				success: false,
				message: "Fix failed",
				error: err,
				duration: Date.now() - start,
			};
		}
	}

	private buildAttempt(check: CheckResult, fixId: string, result: FixResult): FixAttempt {
		return {
			checkId: check.id,
			checkName: check.name,
			fixId,
			success: result.success,
			message: result.message,
			error: result.success ? undefined : result.message,
			duration: 0,
		};
	}

	private createTimeout(): Promise<never> {
		return new Promise((_, reject) => {
			setTimeout(() => reject(new Error(`Fix timed out after ${this.timeout}ms`)), this.timeout);
		});
	}
}
