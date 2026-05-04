/**
 * checker-fixer-parity.ts
 *
 * Generic test helper that asserts detect→fix→detect convergence for any
 * `autoFixable: true` health checker.
 *
 * Usage pattern (TDD):
 *   1. Build a fixture that contains known stale entries.
 *   2. Call `expectFixerConvergence` — it will:
 *      a. Assert the detect function returns at least one finding (fixture is valid).
 *      b. Call the fixer.
 *      c. Assert the detect function now returns zero findings (fixer converged).
 *
 * If the fixer fails to converge the helper throws, proving the bug surfaced by
 * anhhoangpham's report (ck doctor --fix → still 16 stale entries).
 *
 * @see docs/code-standards.md — "Checker/Fixer Parity for autoFixable health checks"
 */

import { expect } from "bun:test";

/**
 * Options for `expectFixerConvergence`.
 *
 * @template TFixture - The settings/config object the checker and fixer operate on.
 * @template TFinding - The individual finding type returned by the detect function.
 */
export interface FixerConvergenceOptions<TFixture, TFinding> {
	/**
	 * Detect function: reads the fixture and returns all current findings.
	 * Must return a non-empty array before the fix is applied (validates the fixture).
	 */
	detect: (fixture: TFixture) => TFinding[] | Promise<TFinding[]>;

	/**
	 * Fix function: mutates the fixture in place (or writes to disk) to resolve findings.
	 * Called once between the two detect passes.
	 */
	fix: (fixture: TFixture) => void | Promise<void>;

	/**
	 * The fixture to pass to both detect and fix.
	 * Typically a settings object, a temp-dir path, or an in-memory structure.
	 */
	fixture: TFixture;
}

/**
 * Assert that a fixer fully resolves everything the detector flags.
 *
 * Fails if:
 * - `detect(fixture)` returns zero findings before fix (bad fixture — test would be vacuous).
 * - `detect(fixture)` returns any findings after fix (fixer did not converge).
 *
 * @throws {Error} If the fixture produces no initial findings (test authoring error).
 * @throws {Error} If the fixer does not converge to zero findings.
 */
export async function expectFixerConvergence<TFixture, TFinding>(
	options: FixerConvergenceOptions<TFixture, TFinding>,
): Promise<void> {
	const { detect, fix, fixture } = options;

	// Phase 1: confirm the fixture is non-trivially stale.
	const before = await detect(fixture);
	expect(before.length).toBeGreaterThan(0);

	// Phase 2: apply the fixer.
	await fix(fixture);

	// Phase 3: re-detect — fixer must have resolved ALL findings.
	const after = await detect(fixture);
	expect(after).toEqual([]);
}
